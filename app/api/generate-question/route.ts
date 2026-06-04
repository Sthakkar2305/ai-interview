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

    const isFirstQuestion = !body.previousQuestion || !body.previousAnswer;
    
    let difficultyInstructions = "";
    switch (body.difficulty) {
      case "easy":
        difficultyInstructions = "CRITICAL REQUIREMENT - Difficulty: EASY. You MUST ask very basic, entry-level questions. Focus on simple definitions, general concepts, or straightforward past experiences. Do NOT ask complex scenario questions. The candidate is a beginner.";
        break;
      case "medium":
        difficultyInstructions = "CRITICAL REQUIREMENT - Difficulty: MEDIUM. You MUST ask moderate scenario-based questions, comparisons between technologies, and practical application questions. The candidate has some experience, so push them a little bit but do not be overly harsh.";
        break;
      case "hard":
        difficultyInstructions = "CRITICAL REQUIREMENT - Difficulty: HARD. You MUST ask EXTREMELY DIFFICULT, next-level questions. Ask highly complex architectural questions, extreme edge cases, intense cross-examination, and difficult 'what-if' scenarios. Act like a principal engineer grilling a senior candidate. Scrutinize their previous answer heavily if they made any mistake.";
        break;
      default:
        difficultyInstructions = "CRITICAL REQUIREMENT - Difficulty: MIXED. Adapt dynamically based on the context.";
    }

    const prompt = `You are running a live document-based interview. BE HIGHLY CREATIVE. Never ask the same cliché questions.

Generate exactly one ${isFirstQuestion ? "opening interview question" : "follow-up question"} based on:
- The uploaded document context
- The candidate's requested difficulty level (${body.difficulty || "medium"})
${!isFirstQuestion ? "- The previous question and the candidate's spoken answer" : ""}

Rules:
- ${difficultyInstructions}
- Do not repeat any previously asked question.
- Make it sound like a natural spoken question from a human interviewer.
- Return only valid JSON.

Document excerpt:
${(body.documentContent || "").substring(0, 2500)}

Topics to cover:
${topics.join(", ")}

Previously asked questions (Do NOT repeat these):
${askedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

${isFirstQuestion ? "Since this is the first question, ask a strong introductory question probing one of their core skills or topics from their document." : `Previous question:
${body.previousQuestion}

Previous spoken answer:
${body.previousAnswer}`}

JSON schema:
{
  "question": "single next interview question",
  "expectedKeywords": ["keyword1", "keyword2", "keyword3"]
}`

    const completion = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.9,
      top_p: 0.95,
      max_tokens: 1500,
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
