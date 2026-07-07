import OpenAI from "openai"
import { type NextRequest, NextResponse } from "next/server"

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY?.replace(/^"|"$/g, ''),
  baseURL: (process.env.DEEPSEEK_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/^"|"$/g, ''),
})

const DEEPSEEK_MODEL = (process.env.DEEPSEEK_MODEL || "meta/llama-3.1-70b-instruct").replace(/^"|"$/g, '')

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { resumeText, jobDescription } = body

    if (!resumeText) {
      return NextResponse.json({ error: "Missing resume text" }, { status: 400 })
    }

    const prompt = `You are an expert ATS (Applicant Tracking System).
Evaluate the following resume text.
${jobDescription ? `Compare it against this target job description:\n${jobDescription}` : "Evaluate it based on general professional standards since no job description was provided."}

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
    
    // Extract first number
    const match = resultText.match(/\d+/)
    const score = match ? parseInt(match[0], 10) : 0

    return NextResponse.json({ score: Math.min(100, Math.max(0, score)) })
  } catch (error) {
    console.error("ATS Score error:", error)
    return NextResponse.json({ error: "Failed to calculate ATS score" }, { status: 500 })
  }
}
