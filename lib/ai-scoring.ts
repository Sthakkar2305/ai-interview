import OpenAI from "openai"
export type InterviewMode = "document" | "manual"

export interface ManualQuestionAnswer {
  question: string
  expectedAnswer: string
}

export interface AnswerEvaluation {
  contentScore: number
  clarityScore: number
  confidenceScore: number
  keywordMatch: number
  overallScore: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
}

export interface SessionEvaluation {
  overallScore: number
  knowledgeScore: number
  communicationScore: number
  confidenceScore: number
  technicalDepthScore: number
  strengths: string[]
  weaknesses: string[]
  missedConcepts: string[]
  improvementSuggestions: string[]
  vocabularyUpgrades: Record<string, string>
  tipsToImprove: string[]
}

export interface EvaluationOptions {
  mode?: InterviewMode
  expectedAnswer?: string
}

export interface SessionAnswer {
  question: string
  answer: string
  scores: Pick<AnswerEvaluation, "overallScore">
  expectedAnswer?: string
}

export interface SessionEvaluationOptions {
  mode?: InterviewMode
  manualQa?: ManualQuestionAnswer[]
}

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY?.replace(/^"|"$/g, ''),
  baseURL: (process.env.DEEPSEEK_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/^"|"$/g, ''),
})

const DEEPSEEK_MODEL = (process.env.DEEPSEEK_MODEL || "meta/llama-3.1-70b-instruct").replace(/^"|"$/g, '')

function clampScore(value: unknown): number {
  const score = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(score)) return 0
  return Math.min(100, Math.max(0, score))
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

function stripMarkdownJson(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced?.[1]) return fenced[1].trim()

  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }

  return trimmed
}

function parseJsonObject<T>(text: string): Partial<T> {
  return JSON.parse(stripMarkdownJson(text)) as Partial<T>
}

function buildAnswerPrompt(
  questionText: string,
  answerText: string,
  expectedKeywords: string[],
  documentContent: string,
  options: EvaluationOptions,
): string {
  if (options.mode === "manual") {
    return `You are an expert interview evaluator grading a Manual Q&A interview.

Question: "${questionText}"
User-provided expected answer: "${options.expectedAnswer || ""}"
Candidate spoken answer: "${answerText}"

Scoring rules:
- Grade contentScore and keywordMatch primarily by semantic alignment with the user-provided expected answer.
- Award high contentScore and keywordMatch when the candidate expresses the same ideas, even if the wording differs.
- Penalize missing, contradictory, or invented claims compared with the expected answer.
- Still evaluate clarityScore and confidenceScore from the candidate's spoken answer quality.

Return only valid JSON with:
- contentScore (0-100)
- clarityScore (0-100)
- confidenceScore (0-100)
- keywordMatch (0-100)
- strengths (array of strings)
- weaknesses (array of strings)
- suggestions (array of strings)`
  }

  return `You are an expert interview evaluator. Evaluate the following answer using the document context.

Question: "${questionText}"
Expected keywords: ${expectedKeywords.join(", ")}
Candidate Answer: "${answerText}"
Context: ${documentContent.substring(0, 1200)}...

Return only valid JSON with:
- contentScore (0-100)
- clarityScore (0-100)
- confidenceScore (0-100)
- keywordMatch (0-100)
- strengths (array of strings)
- weaknesses (array of strings)
- suggestions (array of strings)`
}

export async function evaluateAnswer(
  questionText: string,
  answerText: string,
  expectedKeywords: string[],
  documentContent: string,
  options: EvaluationOptions = {},
): Promise<AnswerEvaluation> {
  try {
    const prompt = buildAnswerPrompt(questionText, answerText, expectedKeywords, documentContent, {
      mode: options.mode || "document",
      expectedAnswer: options.expectedAnswer,
    })

    const completion = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: "You must return your evaluation strictly as a single, valid JSON object. No preamble, no explanation, no conversational text, and no markdown wrapping (do not wrap in ```json)." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      top_p: 0.95,
      max_tokens: 4096,
    })

    const text = completion.choices[0]?.message?.content || ""

    const evaluation = parseJsonObject<AnswerEvaluation>(text)
    const contentScore = clampScore(evaluation.contentScore)
    const clarityScore = clampScore(evaluation.clarityScore)
    const confidenceScore = clampScore(evaluation.confidenceScore)
    const keywordMatch = clampScore(evaluation.keywordMatch)

    return {
      contentScore,
      clarityScore,
      confidenceScore,
      keywordMatch,
      overallScore: contentScore * 0.4 + clarityScore * 0.3 + confidenceScore * 0.2 + keywordMatch * 0.1,
      strengths: asStringArray(evaluation.strengths),
      weaknesses: asStringArray(evaluation.weaknesses),
      suggestions: asStringArray(evaluation.suggestions),
    }
  } catch (error) {
    console.error("[v0] Answer evaluation error:", error)
    return {
      contentScore: 0,
      clarityScore: 0,
      confidenceScore: 0,
      keywordMatch: 0,
      overallScore: 0,
      strengths: [],
      weaknesses: ["AI Service Error"],
      suggestions: [],
    }
  }
}

function buildSessionPrompt(
  answersText: string,
  documentContent: string,
  topics: string[],
  options: SessionEvaluationOptions,
): string {
  if (options.mode === "manual") {
    return `You are a senior technical interviewer evaluating a Manual Q&A interview.

Each question includes a user-provided expected answer. Strictly compare each candidate spoken answer against that expected answer.
Reward semantic alignment, correct details, and complete coverage. Penalize omissions, contradictions, and vague answers.

Answers:
${answersText}

Return only valid JSON with:
- overallScore (0-100)
- knowledgeScore (0-100)
- communicationScore (0-100)
- confidenceScore (0-100)
- technicalDepthScore (0-100)
- strengths (string array)
- weaknesses (string array)
- missedConcepts (string array)
- improvementSuggestions (string array)
- vocabularyUpgrades (object: word -> better word)
- tipsToImprove (string array)`
  }

  return `You are a senior technical interviewer. Evaluate this full document-based interview session.

Topics: ${topics.join(", ")}
Answers:
${answersText}
Document Context: ${documentContent.substring(0, 1800)}...

Return only valid JSON with:
- overallScore (0-100)
- knowledgeScore (0-100)
- communicationScore (0-100)
- confidenceScore (0-100)
- technicalDepthScore (0-100)
- strengths (string array)
- weaknesses (string array)
- missedConcepts (string array)
- improvementSuggestions (string array)
- vocabularyUpgrades (object: word -> better word)
- tipsToImprove (string array)`
}

export async function evaluateSession(
  answers: SessionAnswer[],
  documentContent: string,
  topics: string[],
  options: SessionEvaluationOptions = {},
): Promise<SessionEvaluation> {
  try {
    const mode = options.mode || "document"
    const answersText = answers
      .map((answer, index) => {
        const expected = mode === "manual" ? `\nExpected Answer: ${answer.expectedAnswer || ""}` : ""
        return `Q${index + 1}: ${answer.question}${expected}\nCandidate Answer: ${answer.answer}`
      })
      .join("\n\n")

    const prompt = buildSessionPrompt(answersText, documentContent, topics, { ...options, mode })

    const completion = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: "system", content: "You must return your evaluation strictly as a single, valid JSON object matching the required fields. No preamble, no explanation, no conversational text, and no markdown wrapping (do not wrap in ```json)." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      top_p: 0.95,
      max_tokens: 8192,
    })

    const text = completion.choices[0]?.message?.content || ""

    const evaluation = parseJsonObject<SessionEvaluation>(text)
    const vocabularyUpgrades =
      evaluation.vocabularyUpgrades && typeof evaluation.vocabularyUpgrades === "object"
        ? (evaluation.vocabularyUpgrades as Record<string, string>)
        : {}

    return {
      overallScore: clampScore(evaluation.overallScore),
      knowledgeScore: clampScore(evaluation.knowledgeScore),
      communicationScore: clampScore(evaluation.communicationScore),
      confidenceScore: clampScore(evaluation.confidenceScore),
      technicalDepthScore: clampScore(evaluation.technicalDepthScore),
      strengths: asStringArray(evaluation.strengths),
      weaknesses: asStringArray(evaluation.weaknesses),
      missedConcepts: asStringArray(evaluation.missedConcepts),
      improvementSuggestions: asStringArray(evaluation.improvementSuggestions),
      vocabularyUpgrades,
      tipsToImprove: asStringArray(evaluation.tipsToImprove),
    }
  } catch (error) {
    console.error("[v0] Session evaluation error:", error)
    throw error
  }
}
