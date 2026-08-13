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

You must return a valid JSON object with the following fields:
1. "score": An integer between 0 and 100 representing the ATS score.
2. "improvements": An array of objects, where each object has:
   - "id": A unique short string identifier (e.g. "imp-1", "imp-2", "imp-3").
   - "originalText": The exact matching phrase or sentence from the resume text below that needs improvement. This MUST be an EXACT, case-sensitive substring from the provided resume text. If there is a general issue, select the closest sentence or section header (e.g. "SKILLS" or "Experience") that is present.
   - "suggestedChange": A specific, actionable recommendation to improve this exact text.
   - "type": One of "metrics", "formatting", "keywords", or "clarity".

Ensure your response is valid JSON. Do NOT wrap it in \`\`\`json markdown blocks, just return the raw JSON object.

Resume Text:
${resumeText.substring(0, 6000)}
`

    const completion = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1200,
    } as any)

    const resultText = completion.choices[0]?.message?.content?.trim() || "{}"
    
    let score = 0
    let improvements: Array<{ id: string; originalText: string; suggestedChange: string; type: string }> = []

    try {
      const cleanedJSON = resultText.replace(/^```json\s*/i, "").replace(/```$/, "").trim()
      const parsed = JSON.parse(cleanedJSON)
      
      score = typeof parsed.score === "number" ? parsed.score : parseInt(parsed.score, 10) || 0
      improvements = Array.isArray(parsed.improvements) ? parsed.improvements : []
    } catch (e) {
      console.warn("Failed to parse AI JSON response:", resultText, e)
      const match = resultText.match(/"score"\s*:\s*(\d+)/) || resultText.match(/\d+/)
      score = match ? parseInt(match[1] || match[0], 10) : 0
    }

    return NextResponse.json({ 
      score: Math.min(100, Math.max(0, score)),
      improvements: improvements.length > 0 ? improvements : [
        {
          id: "imp-default-1",
          originalText: "Summary",
          suggestedChange: "Add more target keywords related to the job description to improve discoverability.",
          type: "keywords"
        },
        {
          id: "imp-default-2",
          originalText: "Experience",
          suggestedChange: "Incorporate more metric-based results (e.g., efficiency gain %, revenue increases, project speed-up).",
          type: "metrics"
        }
      ]
    })
  } catch (error) {
    console.error("ATS Score error:", error)
    return NextResponse.json({ error: "Failed to calculate ATS score" }, { status: 500 })
  }
}
