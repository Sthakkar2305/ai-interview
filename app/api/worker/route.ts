import { createClient } from "@supabase/supabase-js"
import { evaluateSession } from "@/lib/ai-scoring"
import { NextResponse } from "next/server"

export const maxDuration = 300 // Allow up to 5 minutes on Vercel Pro (defaults to 15s on Hobby)

export async function GET(request: Request) {
  return await processWorkerJob(request)
}

export async function POST(request: Request) {
  return await processWorkerJob(request)
}

async function processWorkerJob(request: Request) {
  // 1. Optional security token check
  const url = new URL(request.url)
  const queryToken = url.searchParams.get("token")
  const headerToken = request.headers.get("authorization")?.replace("Bearer ", "")
  const expectedToken = process.env.CRON_SECRET || process.env.WORKER_SECRET

  if (expectedToken && queryToken !== expectedToken && headerToken !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Initialize Supabase Admin Client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Missing Supabase credentials in environment variables" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false
    }
  })

  const startTime = Date.now()
  let processedCount = 0
  const maxExecutionTime = 4 * 60 * 1000 // 4 minutes

  while (Date.now() - startTime < maxExecutionTime) {
    // 3. Fetch one pending job
    console.log("[Worker Endpoint] Checking for pending evaluation jobs...")
    const { data: job, error: fetchError } = await supabase
      .from("interview_sessions")
      .select("id, interview_id")
      .eq("processing_status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .single()

    if (fetchError || !job) {
      if (fetchError && fetchError.code !== "PGRST116") {
        console.error("[Worker Endpoint] Error fetching jobs:", fetchError.message)
        if (processedCount === 0) return NextResponse.json({ error: fetchError.message }, { status: 500 })
      }
      break // No more jobs
    }

    const sessionId = job.id
    console.log(`[Worker Endpoint] Found pending job: ${sessionId}. Starting processing...`)

  // 4. Update status to processing
  await supabase
    .from("interview_sessions")
    .update({
      processing_status: "processing",
      processing_started_at: new Date().toISOString()
    })
    .eq("id", sessionId)

  try {
    const { data: interviewData } = await supabase
      .from("interviews")
      .select("interview_type, manual_qa")
      .eq("id", job.interview_id)
      .single()

    const mode = interviewData?.interview_type === "manual" ? "manual" : "document"
    const manualQa = Array.isArray(interviewData?.manual_qa) ? interviewData.manual_qa : []

    const { data: docData } = await supabase
      .from("document_uploads")
      .select("extracted_content, topics")
      .eq("interview_id", job.interview_id)
      .single()

    const documentContent = docData?.extracted_content || ""
    const topics = docData?.topics || []

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

    if (!answers || answers.length === 0) {
      console.log(`[Worker Endpoint] No answers found for session ${sessionId}. Marking as completed with 0 score.`)
      await supabase.from("interview_sessions").update({
        overall_score: 0, knowledge_score: 0, communication_score: 0,
        confidence_score: 0, technical_depth_score: 0,
        status: "completed", processing_status: "completed",
        completed_at: new Date().toISOString(), processing_completed_at: new Date().toISOString()
      }).eq("id", sessionId)

      return NextResponse.json({ status: "completed", message: `Zero score assigned for empty session ${sessionId}` })
    }

    const formattedAnswers = answers.map((a: any, index: number) => ({
      question: a.interview_questions?.question_text || manualQa[index]?.question || "Unknown Question",
      answer: a.transcript && a.transcript.trim() !== "" ? a.transcript : "[No audible answer provided]",
      expectedAnswer: mode === "manual" ? manualQa[index]?.expectedAnswer || "" : undefined,
      scores: { overallScore: 0 }
    }))

    console.log(`[Worker Endpoint] Running AI evaluation for session ${sessionId}...`)
    let evaluation = {
      overallScore: 0, knowledgeScore: 0, communicationScore: 0,
      confidenceScore: 0, technicalDepthScore: 0,
      strengths: [] as string[], weaknesses: [] as string[],
      missedConcepts: [] as string[], improvementSuggestions: [] as string[],
      vocabularyUpgrades: {} as Record<string, string>, tipsToImprove: [] as string[]
    }

    // @ts-ignore
    const aiResult = await evaluateSession(formattedAnswers, documentContent, topics, { mode, manualQa })
    evaluation = { ...evaluation, ...aiResult }

    console.log(`[Worker Endpoint] AI Evaluation complete for ${sessionId}. Score: ${evaluation.overallScore}`)

    // 5. Update DB with results
    await supabase.from("interview_sessions").update({
      overall_score: evaluation.overallScore,
      knowledge_score: evaluation.knowledgeScore,
      communication_score: evaluation.communicationScore,
      confidence_score: evaluation.confidenceScore,
      technical_depth_score: evaluation.technicalDepthScore,
      status: "completed",
      processing_status: "completed",
      completed_at: new Date().toISOString(),
      processing_completed_at: new Date().toISOString()
    }).eq("id", sessionId)

    await supabase.from("interview_feedback").delete().eq("session_id", sessionId)
    await supabase.from("interview_feedback").insert({
      session_id: sessionId,
      strengths: evaluation.strengths,
      weaknesses: evaluation.weaknesses,
      missed_concepts: evaluation.missedConcepts,
      improvement_suggestions: evaluation.improvementSuggestions,
      tips_to_improve: evaluation.tipsToImprove,
      vocabulary_upgrades: evaluation.vocabularyUpgrades
    })

    console.log(`[Worker Endpoint] Successfully completed job for session ${sessionId}`)
  } catch (error: any) {
    console.error(`[Worker Endpoint] Job failed for session ${sessionId}:`, error)
    // Mark failed but continue loop for other jobs
    const { data: currentJob } = await supabase.from("interview_sessions").select("retry_count").eq("id", sessionId).single()
    const retryCount = (currentJob?.retry_count || 0) + 1

    if (retryCount >= 3) {
      console.log(`[Worker Endpoint] Max retries reached for session ${sessionId}. Marking as failed.`)
      await supabase.from("interview_sessions").update({
        processing_status: "failed",
        failure_reason: error.message || "Unknown error",
        retry_count: retryCount
      }).eq("id", sessionId)
    } else {
      console.log(`[Worker Endpoint] Retrying job later for session ${sessionId} (Retry ${retryCount}/3)`)
      await supabase.from("interview_sessions").update({
        processing_status: "pending",
        failure_reason: error.message || "Unknown error",
        retry_count: retryCount
      }).eq("id", sessionId)
    }
  }
  processedCount++
}

return NextResponse.json({ status: "success", processed: processedCount })
}
