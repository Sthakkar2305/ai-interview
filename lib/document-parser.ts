// pdfjs-dist is imported dynamically inside parsePdf to prevent SSR DOMMatrix errors

interface ParsedDocument {
  text: string
  topics: string[]
  keyConcepts: Record<string, string[]>
  difficultyAssessment: string
}

export async function parseDocument(file: File): Promise<ParsedDocument> {
  let text = ""

  try {
    if (file.type === "application/pdf") {
      text = await parsePdf(file)
    } else if (
      file.type === "application/msword" ||
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      text = await parseDocx(file)
    } else {
      throw new Error("Unsupported file type")
    }
  } catch (err) {
    console.error("Parser Error:", err)
    // Return empty but safe object if parsing fails completely
    return {
        text: "",
        topics: [],
        keyConcepts: {},
        difficultyAssessment: "Medium"
    }
  }

  // Analyze the text to extract topics and concepts
  const analysis = analyzeContent(text)

  return {
    text,
    topics: analysis.topics,
    keyConcepts: analysis.keyConcepts,
    difficultyAssessment: analysis.difficultyAssessment,
  }
}

async function parsePdf(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  if (typeof window !== "undefined") {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }

  const arrayBuffer = await file.arrayBuffer()
  
  // FIXED: Add font config to prevent crashes on complex PDFs
  const loadingTask = pdfjsLib.getDocument({ 
    data: arrayBuffer,
    useSystemFonts: true,
    disableFontFace: true
  })

  const pdf = await loadingTask.promise
  let text = ""

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const textContent = await page.getTextContent()
    // Join with spaces to prevent word concatenation
    const pageText = textContent.items.map((item: any) => item.str).join(" ")
    text += pageText + "\n"
  }

  return text
}

async function parseDocx(file: File): Promise<string> {
  // Simple DOCX text extraction
  return await file.text()
}

function analyzeContent(text: string): {
  topics: string[]
  keyConcepts: Record<string, string[]>
  difficultyAssessment: string
} {
  const lines = text.split("\n")
  const topics: string[] = []
  const keyConcepts: Record<string, string[]> = {}

  // 1. Look for Key Concepts (Technical terms, Skills)
  // This regex looks for common Resume/Tech keywords
  const conceptPattern = /\b(React|Angular|Vue|Node\.js|Python|Java|C\+\+|AWS|Docker|Kubernetes|SQL|NoSQL|System Design|Microservices|API|Restful|GraphQL|TypeScript)\b/gi
  
  const foundConcepts = [...new Set(text.match(conceptPattern) || [])]
  
  if (foundConcepts.length > 0) {
      keyConcepts["technical_skills"] = foundConcepts
      topics.push(...foundConcepts.slice(0, 5)) // Add top skills as topics
  }

  // 2. Look for Header-like topics
  const topicPattern = /(?:Experience|Education|Projects|Summary|Skills|Background)[\s:]*([^.\n]+)/gi
  let match
  while ((match = topicPattern.exec(text)) !== null) {
    const topic = match[1].trim()
    if (topic.length > 3 && topic.length < 50) {
      topics.push(topic)
    }
  }

  // Assess difficulty
  const wordCount = text.split(/\s+/).length
  const technicalTerms = foundConcepts.length

  let difficultyAssessment = "Medium"
  if (technicalTerms > 10) difficultyAssessment = "Advanced"
  else if (wordCount < 200) difficultyAssessment = "Basic"

  // Ensure unique topics
  const uniqueTopics = Array.from(new Set(topics)).slice(0, 10)

  return {
    topics: uniqueTopics,
    keyConcepts,
    difficultyAssessment,
  }
}