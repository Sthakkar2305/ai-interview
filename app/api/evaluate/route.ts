import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import { type InterviewMode, type ManualQuestionAnswer } from "@/lib/ai-scoring"

export const maxDuration = 300 // Allow up to 5 minutes for evaluation

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()
    const cookieStore = await cookies()
    
    // 1. Initialize Supabase Admin Client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )

    // 2. Fetch Session & Document Data
    const { data: sessionData, error: sessionError } = await supabase
      .from("interview_sessions")
      .select("interview_id, user_id")
      .eq("id", sessionId)
      .single()

    if (sessionError || !sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // 3. Fetch Interview Mode
    const { data: interviewData } = await supabase
      .from("interviews")
      .select("interview_type, manual_qa")
      .eq("id", sessionData.interview_id)
      .single()

    const mode: InterviewMode = interviewData?.interview_type === "manual" ? "manual" : "document"
    const manualQa = Array.isArray(interviewData?.manual_qa)
      ? (interviewData.manual_qa as ManualQuestionAnswer[])
      : []

    // 4. Fetch The Real Document Content
    const { data: docData } = await supabase
      .from("document_uploads")
      .select("extracted_content, topics")
      .eq("interview_id", sessionData.interview_id)
      .single()

    const documentContent = docData?.extracted_content || ""
    const topics = docData?.topics || []

    // 5. Fetch User's Actual Answers
    const { data: answers } = await supabase
      .from("interview_answers")
      .select(`
        transcript, 
        confidence_rating,
        question_id,
        interview_questions ( question_text )
      `)
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })

    // --- LOGIC FIX: Handle Empty Sessions ---
    if (!answers || answers.length === 0) {
      await saveZeroScore(supabase, sessionId)
      return NextResponse.json({ success: true, score: 0, status: "completed", message: "No answers recorded" })
    }

    // Instead of blocking for 20 minutes, queue the job
    const { error: updateError } = await supabase
      .from("interview_sessions")
      .update({
        processing_status: "pending",
        status: "completed" // Set basic status so UI knows interview is done, but results are pending
      })
      .eq("id", sessionId)

    if (updateError) {
      console.error("DB Update Error (Queueing):", updateError)
      return NextResponse.json({ error: "Failed to queue evaluation" }, { status: 500 })
    }

    // Wait for the worker to process it immediately, since maxDuration is 300s
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
      const workerRes = await fetch(`${baseUrl}/api/worker`, { method: "POST" });
      if (!workerRes.ok) {
        console.error("Worker returned non-ok status:", await workerRes.text());
      }
    } catch (e) {
      console.error("Failed to trigger or await worker:", e);
    }

    return NextResponse.json({ success: true, status: "completed" }, { status: 200 })

  } catch (error) {
    console.error("Critical Route Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

// Helper to save a 0 score without calling AI
async function saveZeroScore(supabase: any, sessionId: string) {
  await supabase.from("interview_sessions").update({
    overall_score: 0,
    knowledge_score: 0,
    communication_score: 0,
    confidence_score: 0,
    technical_depth_score: 0,
    status: "completed",
    processing_status: "completed",
    completed_at: new Date().toISOString(),
    processing_completed_at: new Date().toISOString()
  }).eq("id", sessionId)

  await supabase.from("interview_feedback").delete().eq("session_id", sessionId)
  await supabase.from("interview_feedback").insert({
    session_id: sessionId,
    strengths: ["None"],
    weaknesses: ["No answers recorded"],
    improvement_suggestions: ["Please ensure your microphone is working and you speak clearly."],
    tips_to_improve: ["Attempt the questions to get a score."]
  })
}
