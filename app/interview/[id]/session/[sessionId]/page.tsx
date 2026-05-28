"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Loader2, ShieldAlert } from "lucide-react"
import { ProctoringEngine } from "@/components/proctoring/ProctoringEngine"
import { InterviewTimer } from "@/components/interview/InterviewTimer"

type InterviewMode = "document" | "manual"

interface ManualQaItem {
  question: string
  expectedAnswer: string
}

interface InterviewConfig {
  mode: InterviewMode
  duration: number
  questionCount: number
  difficulty: "easy" | "medium" | "hard" | "mixed"
  documentContent: string
  topics: string[]
  keyConcepts: Record<string, string[]>
  manualQa: ManualQaItem[]
}

interface GeneratedQuestion {
  question: string
  expectedKeywords: string[]
}

const FALLBACK_TOPICS = [
  "your professional background",
  "a challenging technical problem you solved",
  "your experience with teamwork",
  "your preferred working style",
  "a recent project you are proud of",
]

function normalizeConfig(value: unknown): InterviewConfig {
  const raw = value as Partial<InterviewConfig>
  const manualQa = Array.isArray(raw.manualQa) ? raw.manualQa : []

  return {
    mode: raw.mode === "manual" ? "manual" : "document",
    duration: typeof raw.duration === "number" ? raw.duration : 30,
    questionCount:
      typeof raw.questionCount === "number" ? raw.questionCount : raw.mode === "manual" ? manualQa.length : 5,
    difficulty: raw.difficulty || "medium",
    documentContent: typeof raw.documentContent === "string" ? raw.documentContent : "",
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    keyConcepts: raw.keyConcepts && typeof raw.keyConcepts === "object" ? raw.keyConcepts : {},
    manualQa,
  }
}

function getQuestionPool(config: InterviewConfig): string[] {
  const concepts = Object.values(config.keyConcepts || {}).flat()
  if (concepts.length > 0) return concepts
  if (config.topics.length > 0) return config.topics
  return FALLBACK_TOPICS
}

function getOpeningDocumentQuestion(config: InterviewConfig): GeneratedQuestion {
  const pool = getQuestionPool(config)
  const currentTopic = pool[0] || FALLBACK_TOPICS[0]
  return {
    question: `Based on your resume, tell me about your experience with ${currentTopic}.`,
    expectedKeywords: [currentTopic],
  }
}

export default function InterviewSessionPage() {
  const router = useRouter()
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
  const supabase = getSupabaseClient()

  const interviewId = params.id as string
  const sessionId = params.sessionId as string

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const askedQuestionsRef = useRef<string[]>([])
  const currentQuestionRef = useRef("")

  const [stream, setStream] = useState<MediaStream | null>(null)
  const [config, setConfig] = useState<InterviewConfig | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState("")
  const [currentQuestionId, setCurrentQuestionId] = useState("")
  const [questionCount, setQuestionCount] = useState(0)
  const [videoEnabled, setVideoEnabled] = useState(false)
  const [isAnswering, setIsAnswering] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [sessionStarted, setSessionStarted] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [countdownToQuestion, setCountdownToQuestion] = useState(0)
  const [error, setError] = useState("")
  const [isTerminated, setIsTerminated] = useState(false)

  const speakText = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.95
      utterance.pitch = 1.0

      const voices = window.speechSynthesis.getVoices()
      let preferredVoice = voices.find(
        (voice) =>
          voice.lang === "en-IN" &&
          (voice.name.includes("Google") ||
            voice.name.includes("Natural") ||
            voice.name.includes("Female") ||
            voice.name.includes("Male")),
      )

      if (!preferredVoice) preferredVoice = voices.find((voice) => voice.lang === "en-IN")
      if (!preferredVoice) {
        preferredVoice = voices.find(
          (voice) =>
            voice.lang === "en-GB" &&
            (voice.name.includes("Google") ||
              voice.name.includes("Natural") ||
              voice.name.includes("Female") ||
              voice.name.includes("Male")),
        )
      }
      if (!preferredVoice) preferredVoice = voices.find((voice) => voice.lang === "en-GB")

      if (preferredVoice) {
        utterance.voice = preferredVoice
        utterance.lang = preferredVoice.lang
      } else {
        utterance.lang = "en-IN"
      }

      window.speechSynthesis.speak(utterance)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push("/auth/login")
      return
    }

    const configStr = sessionStorage.getItem(`interview_config_${sessionId}`)
    if (configStr) {
      setConfig(normalizeConfig(JSON.parse(configStr)))
    } else {
      setError("Configuration missing. Please go back to the dashboard.")
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices()
      }
    }
  }, [user, authLoading, sessionId, router])

  useEffect(() => {
    const initMedia = async () => {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        })
        setStream(newStream)
        setVideoEnabled(true)
        if (videoRef.current) videoRef.current.srcObject = newStream
      } catch (err) {
        console.error("Media Error:", err)
        setError("Camera/Microphone access denied. Please allow permissions.")
      }
    }

    if (!stream && !authLoading) initMedia()

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop())
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [authLoading, stream])

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream, sessionStarted, isAnswering, currentQuestion])

  // Timer logic is now handled by InterviewTimer component

  const startInterview = () => {
    setSessionStarted(true)
    askedQuestionsRef.current = []
    void generateNextQuestion(0)
  }

  const saveQuestion = async (questionText: string, expectedKeywords: string[]) => {
    let qId = `temp_${Date.now()}`

    try {
      const { data, error: questionError } = await supabase
        .from("interview_questions")
        .insert({
          interview_id: interviewId,
          question_text: questionText,
          difficulty_level: config?.difficulty || "medium",
          expected_keywords: expectedKeywords,
        })
        .select()
        .single()

      if (questionError) {
        console.error("Question save failed:", questionError)
      }

      if (data) qId = data.id
    } catch (questionError) {
      console.error("Question save failed:", questionError)
    }

    return qId
  }

  const generateDocumentQuestion = async (index: number, previousAnswer?: string): Promise<GeneratedQuestion> => {
    if (!config) return getOpeningDocumentQuestion(normalizeConfig({}))
    if (index === 0) return getOpeningDocumentQuestion(config)

    const response = await fetch("/api/generate-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentContent: config.documentContent,
        topics: config.topics,
        keyConcepts: config.keyConcepts,
        previousQuestion: currentQuestionRef.current,
        previousAnswer: previousAnswer || "",
        askedQuestions: askedQuestionsRef.current,
        difficulty: config.difficulty,
      }),
    })

    const data = (await response.json()) as Partial<GeneratedQuestion>
    return {
      question:
        typeof data.question === "string" && data.question.trim()
          ? data.question.trim()
          : "Can you expand on your previous answer and connect it to another concept from the document?",
      expectedKeywords: Array.isArray(data.expectedKeywords) ? data.expectedKeywords : [],
    }
  }

  const getNextQuestion = async (index: number, previousAnswer?: string): Promise<GeneratedQuestion> => {
    if (!config) return { question: "", expectedKeywords: [] }

    if (config.mode === "manual") {
      const manualItem = config.manualQa[index]
      return {
        question: manualItem?.question || "",
        expectedKeywords: [],
      }
    }

    return generateDocumentQuestion(index, previousAnswer)
  }

  const generateNextQuestion = async (index: number, previousAnswer?: string) => {
    if (!config) return

    if (index >= config.questionCount) {
      await finishInterview()
      return
    }

    setCountdownToQuestion(3)
    setIsProcessing(config.mode === "document" && index > 0)

    try {
      const generated = await getNextQuestion(index, previousAnswer)

      if (!generated.question) {
        await finishInterview()
        return
      }

      setCurrentQuestion(generated.question)
      currentQuestionRef.current = generated.question
      askedQuestionsRef.current = [...askedQuestionsRef.current, generated.question]
      speakText(generated.question)

      const questionId = await saveQuestion(generated.question, generated.expectedKeywords)
      setIsProcessing(false)

      const interval = setInterval(() => {
        setCountdownToQuestion((previous) => {
          if (previous <= 1) {
            clearInterval(interval)
            startRecordingQuestion(generated.question, questionId, index)
            return 0
          }
          return previous - 1
        })
      }, 1000)
    } catch (questionError) {
      console.error("Generate question failed:", questionError)
      setIsProcessing(false)
      setError("Unable to generate the next question. Please try again.")
    }
  }

  const startRecordingQuestion = (text: string, qId: string, index: number) => {
    setCurrentQuestion(text)
    setCurrentQuestionId(qId)
    setQuestionCount(index + 1)

    const seconds = Math.max(30, Math.floor((config!.duration * 60) / config!.questionCount))
    setTimeRemaining(seconds)

    setIsAnswering(true)
    chunksRef.current = []

    if (stream) {
      try {
        const recorder = new MediaRecorder(stream)
        mediaRecorderRef.current = recorder
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data)
        }
        recorder.start()
      } catch (recorderError) {
        console.error("Recorder fail:", recorderError)
      }
    }
  }

  const handleAnswerComplete = async () => {
    if (!mediaRecorderRef.current || isProcessing) return

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
    }

    setIsAnswering(false)
    setIsProcessing(true)

    if (mediaRecorderRef.current.state === "recording") mediaRecorderRef.current.stop()
    await new Promise((resolve) => setTimeout(resolve, 500))

    const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" })
    let transcript = ""

    try {
      const formData = new FormData()
      formData.append("audio", audioBlob)
      formData.append("sessionId", sessionId)
      formData.append("questionId", currentQuestionId)

      const response = await fetch("/api/transcribe", { method: "POST", body: formData })
      const data = (await response.json()) as { transcript?: string }
      transcript = data.transcript || ""
    } catch (uploadError) {
      console.error("Upload failed", uploadError)
    } finally {
      setIsProcessing(false)
      await generateNextQuestion(questionCount, transcript)
    }
  }

  const finishInterview = async () => {
    setIsProcessing(true)
    setCurrentQuestion("Generating your results...")
    speakText("Interview complete. Give me a moment to analyze your session and generate your results.")

    try {
      await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })

      await supabase
        .from("interview_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", sessionId)

      router.push(`/dashboard`)
    } catch (finishError) {
      console.error("Finish error", finishError)
      router.push(`/dashboard`)
    }
  }

  if (authLoading || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  if (!sessionStarted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Ready?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-lg flex gap-3">
                <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}
            <div className="aspect-video bg-black rounded relative overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
            </div>
            <Button onClick={startInterview} disabled={!videoEnabled || config.questionCount === 0} className="w-full">
              Start Interview
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isTerminated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-500 shadow-lg shadow-red-500/20">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <CardTitle className="text-2xl font-bold text-red-600">Interview Terminated</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">Your interview has been automatically terminated due to repeated proctoring violations.</p>
            <p className="text-sm">This event has been logged and the recruiter will be notified.</p>
            <Button onClick={() => router.push("/dashboard")} variant="outline" className="w-full mt-4">
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ProctoringEngine 
        sessionId={sessionId} 
        isActive={sessionStarted && !isTerminated} 
        onTerminate={() => setIsTerminated(true)} 
      />
      <header className="p-4 border-b flex justify-between items-center bg-card">
        <div>
          <h1 className="font-bold">Live Interview</h1>
          <p className="text-xs text-muted-foreground capitalize">{config.mode} mode</p>
        </div>
        <div className="flex gap-4 items-center">
          {isAnswering && config && (
            <InterviewTimer 
              durationSeconds={Math.max(30, Math.floor((config.duration * 60) / config.questionCount))} 
              onTimeUp={handleAnswerComplete} 
              resetKey={questionCount} 
            />
          )}
          <span className="text-sm">
            Q {questionCount}/{config.questionCount}
          </span>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
        <div className="lg:col-span-2 space-y-6">
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-lg border">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />

            {countdownToQuestion > 0 && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                <span className="text-9xl font-bold text-white">{countdownToQuestion}</span>
              </div>
            )}

            {isProcessing && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 flex-col gap-2">
                <Loader2 className="h-10 w-10 animate-spin text-white" />
                <span className="text-white">Processing...</span>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-lg flex gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <h3 className="text-xs font-bold uppercase text-primary mb-2">Current Question</h3>
              <p className="text-xl font-medium">{currentQuestion || "Preparing..."}</p>
            </CardContent>
          </Card>

          <div className="flex justify-center">
            {isAnswering ? (
              <Button variant="destructive" size="lg" onClick={handleAnswerComplete} className="w-40 h-12">
                Finish Answer
              </Button>
            ) : (
              <Button disabled variant="secondary" size="lg" className="w-40 h-12">
                Listening...
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round((Math.max(0, questionCount - 1) / config.questionCount) * 100)}%</span>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${(Math.max(0, questionCount - 1) / config.questionCount) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
