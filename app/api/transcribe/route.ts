import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    // 1. Setup Supabase
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )

    // 2. Parse Form Data
    const formData = await request.formData()
    const audioBlob = formData.get("audio") as Blob
    const sessionId = formData.get("sessionId") as string
    const questionId = formData.get("questionId") as string

    if (!audioBlob) return NextResponse.json({ error: "No audio" }, { status: 400 })

    // 3. Send to Deepgram with diarization enabled
    const deepgramResponse = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true", {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": audioBlob.type || "audio/webm",
      },
      body: audioBlob,
    })

    if (!deepgramResponse.ok) {
        const errorText = await deepgramResponse.text()
        console.error("Deepgram Error:", errorText)
        return NextResponse.json({ error: "Transcription failed" }, { status: 500 })
    }

    const data = await deepgramResponse.json()
    const transcript = data.results?.channels[0]?.alternatives[0]?.transcript || ""
    const confidence = data.results?.channels[0]?.alternatives[0]?.confidence || 0
    
    // Check for multiple voices using diarization
    const words = data.results?.channels[0]?.alternatives[0]?.words || []
    const uniqueSpeakers = new Set(words.map((w: any) => w.speaker).filter((s: any) => s !== undefined))
    const hasMultipleVoices = uniqueSpeakers.size > 1

    // 4. Save to Database
    const { error: dbError } = await supabase.from("interview_answers").insert({
      session_id: sessionId,
      question_id: questionId,
      transcript: transcript,
      confidence_rating: confidence
    })

    if (dbError) console.error("DB Save Error:", dbError)

    return NextResponse.json({ transcript, hasMultipleVoices })

  } catch (error) {
    console.error("Transcribe Route Error:", error)
    return NextResponse.json({ error: "Internal Error" }, { status: 500 })
  }
}