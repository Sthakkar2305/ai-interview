export interface DeepgramConfig {
  apiKey: string
  model: string
  language: string
}

interface TranscriptionResult {
  transcript: string
  confidence: number
  words: Array<{
    word: string
    confidence: number
    start_time: number
    end_time: number
  }>
}

let deepgramConfig: DeepgramConfig | null = null

export function initializeDeepgram(apiKey: string) {
  deepgramConfig = {
    apiKey,
    model: "nova-2",
    language: "en",
  }
}

export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
  if (!deepgramConfig) {
    throw new Error("Deepgram not initialized. Call initializeDeepgram first.")
  }

  try {
    const formData = new FormData()
    formData.append("audio", audioBlob)

    const response = await fetch("https://api.deepgram.com/v1/listen", {
      method: "POST",
      headers: {
        Authorization: `Token ${deepgramConfig.apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Deepgram API error: ${response.statusText}`)
    }

    const data = await response.json()

    // Extract transcript from Deepgram response
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""
    const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0
    const words = data.results?.channels?.[0]?.alternatives?.[0]?.words || []

    return {
      transcript,
      confidence,
      words,
    }
  } catch (error) {
    console.error("[v0] Deepgram transcription error:", error)
    throw error
  }
}

export async function transcribeAudioUrl(audioUrl: string): Promise<TranscriptionResult> {
  if (!deepgramConfig) {
    throw new Error("Deepgram not initialized. Call initializeDeepgram first.")
  }

  try {
    const response = await fetch("https://api.deepgram.com/v1/listen", {
      method: "POST",
      headers: {
        Authorization: `Token ${deepgramConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: audioUrl,
      }),
    })

    if (!response.ok) {
      throw new Error(`Deepgram API error: ${response.statusText}`)
    }

    const data = await response.json()

    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""
    const confidence = data.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0
    const words = data.results?.channels?.[0]?.alternatives?.[0]?.words || []

    return {
      transcript,
      confidence,
      words,
    }
  } catch (error) {
    console.error("[v0] Deepgram transcription error:", error)
    throw error
  }
}
