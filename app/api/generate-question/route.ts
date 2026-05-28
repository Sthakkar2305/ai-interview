import OpenAI from "openai"
import { type NextRequest, NextResponse } from "next/server"

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY?.replace(/^"|"$/g, ''),
  baseURL: (process.env.DEEPSEEK_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/^"|"$/g, ''),
})

const DEEPSEEK_MODEL = (process.env.DEEPSEEK_MODEL || "meta/llama-3.1-70b-instruct").replace(/^"|"$/g, '')

interface GenerateQuestionBody {
  documentContent?: string
  topics?: string[]
  keyConcepts?: Record<string, string[]>
  previousQuestion?: string
  previousAnswer?: string
  askedQuestions?: string[]
  difficulty?: "easy" | "medium" | "hard" | "mixed"
}

function stripMarkdownJson(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced?.[1]) return fenced[1].trim()

  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1)

  return trimmed
}

function fallbackQuestion(topics: string[], askedQuestions: string[]): string {
  const topic = topics.find((item) => !askedQuestions.some((question) => question.toLowerCase().includes(item.toLowerCase())))
  return `Can you explain a practical example from your experience that demonstrates ${topic || "one of the key concepts in the document"}?`
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateQuestionBody
    const topics = Array.isArray(body.topics) ? body.topics.filter((topic): topic is string => typeof topic === "string") : []
    const keyConcepts = body.keyConcepts && typeof body.keyConcepts === "object" ? body.keyConcepts : {}
    const askedQuestions = Array.isArray(body.askedQuestions)
      ? body.askedQuestions.filter((question): question is string => typeof question === "string")
      : []

    if (!body.previousQuestion || !body.previousAnswer) {
      return NextResponse.json(
        { question: fallbackQuestion(topics, askedQuestions), expectedKeywords: topics.slice(0, 4) },
        { status: 200 },
      )
    }

    const prompt = `You are running a live document-based interview.

Generate exactly one next follow-up question based on:
- The uploaded document context
- The previous question
- The candidate's previous spoken answer
- The requested difficulty

Rules:
- Do not repeat any previously asked question.
- Keep the question concise and interview-ready.
- Ask a follow-up that probes deeper into the document and the candidate's response.
- Return only valid JSON.

Document excerpt:
${(body.documentContent || "").substring(0, 2500)}

Topics:
${topics.join(", ")}

Key concepts:
${Object.values(keyConcepts).flat().join(", ")}

Previously asked questions:
${askedQuestions.map((question, index) => `${index + 1}. ${question}`).join("\n")}

Previous question:
${body.previousQuestion}

Previous spoken answer:
${body.previousAnswer}

Difficulty: ${body.difficulty || "medium"}

JSON schema:
{
  "question": "single next interview question",
  "expectedKeywords": ["keyword or concept", "keyword or concept"]
}`

    const completion = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 1,
      top_p: 0.95,
      max_tokens: 8192,
      chat_template_kwargs: { thinking: true },
      stream: true,
    } as any)

    let text = ""
    for await (const chunk of (completion as any)) {
      const content = chunk.choices[0]?.delta?.content || ""
      if (content) text += content
    }

    const parsed = JSON.parse(stripMarkdownJson(text)) as { question?: unknown; expectedKeywords?: unknown }
    const question = typeof parsed.question === "string" && parsed.question.trim() ? parsed.question.trim() : ""
    const expectedKeywords = Array.isArray(parsed.expectedKeywords)
      ? parsed.expectedKeywords.filter((keyword): keyword is string => typeof keyword === "string")
      : topics.slice(0, 4)

    return NextResponse.json({
      question: question || fallbackQuestion(topics, askedQuestions),
      expectedKeywords,
    })
  } catch (error) {
    console.error("[v0] Generate question error:", error)
    return NextResponse.json(
      {
        question: "Can you expand on your previous answer and connect it to a specific concept from the document?",
        expectedKeywords: [],
      },
      { status: 200 },
    )
  }
}
