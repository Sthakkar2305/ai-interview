import OpenAI from "openai"
import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import nodemailer from "nodemailer"

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY?.replace(/^"|"$/g, ''),
  baseURL: (process.env.DEEPSEEK_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/^"|"$/g, ''),
})

const DEEPSEEK_MODEL = (process.env.DEEPSEEK_MODEL || "meta/llama-3.1-70b-instruct").replace(/^"|"$/g, '')

function generateSecureToken() {
  return Math.random().toString(36).substring(2, 10).toUpperCase() + "-" + Math.random().toString(36).substring(2, 10).toUpperCase()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      resumeText, 
      jobDescription, 
      scoreLimit, 
      candidateName, 
      candidateEmail,
      title,
      role,
      duration,
      passingMarks,
      questionCount,
      scheduledAt,
      documentName 
    } = body

    if (!resumeText || !candidateEmail) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // 1. Get Recruiter Session
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
        }
      }
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Evaluate Resume
    const prompt = `You are an expert ATS (Applicant Tracking System).
Evaluate the following resume text against this target job description:
${jobDescription || "Evaluate based on general professional standards for the role: " + role}

Return ONLY a single integer between 0 and 100 representing the ATS score. Do not provide any other text, explanation, or markdown formatting.

Resume Text:
${resumeText.substring(0, 6000)}
`

    const completion = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 10,
    } as any)

    const resultText = completion.choices[0]?.message?.content?.trim() || "0"
    const match = resultText.match(/\d+/)
    const score = match ? parseInt(match[0], 10) : 0
    const finalScore = Math.min(100, Math.max(0, score))

    const isPassed = finalScore >= scoreLimit

    // 3. Setup Nodemailer
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: "techgaravi1@gmail.com",
        pass: process.env.SMTP_PASSWORD || "",
      },
    })

    const origin = request.headers.get("origin") || "http://localhost:3000"

    // 4. Handle Pass / Fail
    if (isPassed) {
      // Schedule Interview
      const token = generateSecureToken()
      const expiry = new Date(scheduledAt)
      expiry.setDate(expiry.getDate() + 7)

      const manualQa = [
        { question: `Tell me about your experience as a ${role}.`, expectedAnswer: "Candidate should discuss relevant experience." },
        { question: "What is your biggest professional achievement?", expectedAnswer: "Candidate should provide a concrete achievement." },
        { question: "How do you handle difficult situations at work?", expectedAnswer: "Candidate should show problem solving and composure." }
      ]

      const { data: insertData, error: insertError } = await supabase
        .from("scheduled_interviews")
        .insert([{
          recruiter_id: user.id,
          title: title || "Auto-Scheduled Interview",
          role,
          interview_type: "manual",
          difficulty: "medium",
          duration_minutes: duration,
          scheduled_at: new Date(scheduledAt).toISOString(),
          expires_at: expiry.toISOString(),
          access_token: token,
          status: "scheduled",
          document_name: documentName,
          manual_qa: manualQa,
          passing_marks: passingMarks,
          question_count: questionCount,
        }])
        .select()
        .single()

      if (insertError) {
        throw new Error("Failed to schedule interview in database")
      }

      const joinLink = `${origin}/join`

      // Send Acceptance Email
      await transporter.sendMail({
        from: '"AI Interview Platform" <techgaravi1@gmail.com>',
        to: candidateEmail,
        subject: "Interview Invitation - " + title,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #4f46e5;">Congratulations ${candidateName || ''}!</h2>
            <p>Your resume has been successfully reviewed, and we would like to invite you to the next stage.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Interview Role:</strong> ${role}</p>
              <p><strong>Scheduled Date:</strong> ${new Date(scheduledAt).toLocaleString()}</p>
              <p><strong>Join Link:</strong> <a href="${joinLink}">${joinLink}</a></p>
              <p><strong>Interview ID:</strong> ${insertData.id}</p>
              <p><strong>Access Token:</strong> <span style="color: #4f46e5; font-weight: bold;">${token}</span></p>
            </div>
            <p>Please make sure you have a working camera and microphone before joining.</p>
            <p>Best regards,<br/>The Recruiting Team</p>
          </div>
        `
      })

      return NextResponse.json({ 
        score: finalScore, 
        passed: true, 
        message: "Resume scored above limit. Interview scheduled and email sent." 
      })

    } else {
      // Send Rejection Email
      await transporter.sendMail({
        from: '"AI Interview Platform" <techgaravi1@gmail.com>',
        to: candidateEmail,
        subject: "Application Update - " + role,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Hello ${candidateName || 'Candidate'},</h2>
            <p>Thank you for taking the time to apply for the <strong>${role}</strong> position.</p>
            <p>While your background is impressive, we have decided not to move forward with your application at this time.</p>
            <p>We wish you all the best in your job search and future professional endeavors.</p>
            <p>Best regards,<br/>The Recruiting Team</p>
          </div>
        `
      })

      return NextResponse.json({ 
        score: finalScore, 
        passed: false, 
        message: "Resume scored below limit. Rejection email sent." 
      })
    }

  } catch (error) {
    console.error("Company ATS error:", error)
    return NextResponse.json({ error: "Failed to process resume scan" }, { status: 500 })
  }
}
