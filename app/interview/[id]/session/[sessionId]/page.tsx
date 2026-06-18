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
  const fullSessionRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fullSessionChunksRef = useRef<Blob[]>([])
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
  const [isExpired, setIsExpired] = useState(false)
  const [expiryReason, setExpiryReason] = useState("")
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)
  const [canSubmitAnswer, setCanSubmitAnswer] = useState(false)
  const [canSubmitCountdown, setCanSubmitCountdown] = useState(10)
  const [isUploadingVideo, setIsUploadingVideo] = useState(false)

  useEffect(() => {
    if (isAnswering) {
      setCanSubmitAnswer(false)
      setCanSubmitCountdown(10)
      const interval = setInterval(() => {
        setCanSubmitCountdown((prev) => {
          if (prev <= 1) {
            setCanSubmitAnswer(true)
            clearInterval(interval)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isAnswering, questionCount])

  const speakText = (text: string, onEnd?: () => void) => {
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

    const checkSessionAndLoadConfig = async () => {
      setIsCheckingStatus(true)
      try {
        // 1. Fetch the interview session and its base interview from Supabase
        const { data: sessionData, error: sessionErr } = await supabase
          .from("interview_sessions")
          .select(`
            *,
            interviews (
              id,
              title,
              interview_type,
              manual_qa
            )
          `)
          .eq("id", sessionId)
          .single()

        if (sessionErr || !sessionData) {
          setError("Interview session not found. Please return to the dashboard.")
          setIsCheckingStatus(false)
          return
        }

        // 2. Check if the session status is terminated or completed
        if (sessionData.status === "completed" || sessionData.session_status === "completed") {
          setIsExpired(true)
          setExpiryReason("completed")
          setIsCheckingStatus(false)
          return
        }

        if (sessionData.session_status === "terminated") {
          setIsExpired(true)
          setExpiryReason("terminated")
          setIsCheckingStatus(false)
          return
        }

        // 3. Look up the scheduled interview by title to see if it has expired
        const { data: scheduledData } = await supabase
          .from("scheduled_interviews")
          .select("*")
          .eq("title", sessionData.interviews.title)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        const now = new Date()
        if (scheduledData) {
          const expiredAt = new Date(scheduledData.expires_at)
          const scheduledAtDate = new Date(scheduledData.scheduled_at)
          
          // Check if now is past the expiry time
          if (expiredAt < now || scheduledData.status === "expired") {
            setIsExpired(true)
            setExpiryReason("expired")
            setIsCheckingStatus(false)
            return
          }

          // Check if now is way past the scheduled start time (e.g. missed the interview start window by 24 hours or duration)
          const startWindowExpiry = new Date(scheduledAtDate.getTime() + (scheduledData.duration_minutes + 60) * 60 * 1000)
          if (now > startWindowExpiry) {
            setIsExpired(true)
            setExpiryReason("missed")
            setIsCheckingStatus(false)
            return
          }
        }

        // 4. Load or reconstruct config
        const configStr = sessionStorage.getItem(`interview_config_${sessionId}`)
        if (configStr) {
          setConfig(normalizeConfig(JSON.parse(configStr)))
        } else {
          // Reconstruct config from database
          const isManual = sessionData.interviews.interview_type === "manual"
          const manualQa = Array.isArray(sessionData.interviews.manual_qa) ? sessionData.interviews.manual_qa : []

          let docContent = ""
          let docTopics: string[] = []
          let docKeyConcepts: Record<string, string[]> = {}

          if (!isManual) {
            const { data: docData } = await supabase
              .from("document_uploads")
              .select("*")
              .eq("interview_id", interviewId)
              .maybeSingle()

            if (docData) {
              docContent = docData.extracted_content || ""
              docTopics = docData.topics || []
              docKeyConcepts = docData.key_concepts || {}
            }
          }

          setConfig({
            mode: isManual ? "manual" : "document",
            duration: scheduledData?.duration_minutes || 30,
            questionCount: isManual ? manualQa.length : 5,
            difficulty: (scheduledData?.difficulty as any) || "medium",
            documentContent: docContent,
            topics: docTopics,
            keyConcepts: docKeyConcepts,
            manualQa: manualQa as any
          })
        }
      } catch (err: any) {
        console.error("Error loading session:", err)
        setError("An error occurred while loading your session. Please try again.")
      } finally {
        setIsCheckingStatus(false)
      }
    }

    checkSessionAndLoadConfig()

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices()
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices()
      }
    }
  }, [user, authLoading, sessionId, interviewId, router, supabase])

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

  const startInterview = async () => {
    if (!videoEnabled || !stream) {
      setError("Camera and microphone access are strictly required to start the interview.")
      return
    }

    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen()
      } catch (err) {
        setError("Fullscreen is strictly required to start the interview. Please allow fullscreen.")
        return
      }
    }

    setSessionStarted(true)
    askedQuestionsRef.current = []
    
    // Start full session recording
    fullSessionChunksRef.current = []
    try {
      const recorder = new MediaRecorder(stream)
      fullSessionRecorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) fullSessionChunksRef.current.push(event.data)
      }
      recorder.start(1000)
    } catch (recorderError) {
      console.error("Full session recorder fail:", recorderError)
    }

    // Pre-warm the SpeechSynthesis to unlock it for future API responses
    speakText("Starting your interview now. Good luck!")
    
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
    
    // For index === 0, we still call the API to generate a creative opening question 
    // based on the document and difficulty, rather than returning a hardcoded string.

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
        // Extract only the audio tracks so we don't record massive video files
        const audioTracks = stream.getAudioTracks()
        const audioStream = new MediaStream(audioTracks)
        
        const recorder = new MediaRecorder(audioStream)
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

    const processAudio = async () => {
      const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm"
      const audioBlob = new Blob(chunksRef.current, { type: mimeType })
      let transcript = ""

      try {
        const formData = new FormData()
        formData.append("audio", audioBlob)
        formData.append("sessionId", sessionId)
        formData.append("questionId", currentQuestionId)

        const response = await fetch("/api/transcribe", { method: "POST", body: formData })
        const data = (await response.json()) as { transcript?: string, hasMultipleVoices?: boolean }
        transcript = data.transcript || ""

        if (data.hasMultipleVoices) {
          window.dispatchEvent(new Event("multiple_voices_detected"))
        }
      } catch (uploadError) {
        console.error("Upload failed", uploadError)
      } finally {
        setIsProcessing(false)
        await generateNextQuestion(questionCount, transcript)
      }
    }

    if (mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.onstop = processAudio
      mediaRecorderRef.current.stop()
    } else {
      await processAudio()
    }
  }

  const finishInterview = async () => {
    setIsProcessing(true)
    setIsUploadingVideo(true)
    setCurrentQuestion("Generating your results and uploading recording...")
    speakText("Interview complete. Give me a moment to analyze your session and generate your results.")

    try {
      // Stop and upload full session recording
      if (fullSessionRecorderRef.current && fullSessionRecorderRef.current.state !== "inactive") {
        await new Promise<void>((resolve) => {
          if (!fullSessionRecorderRef.current) return resolve();
          fullSessionRecorderRef.current.onstop = async () => {
            const mimeType = fullSessionRecorderRef.current?.mimeType || "video/webm"
            const videoBlob = new Blob(fullSessionChunksRef.current, { type: mimeType })
            const fileName = `${sessionId}-${Date.now()}.webm`
            
            try {
              const { data, error } = await supabase.storage
                .from("interview-recordings")
                .upload(fileName, videoBlob, { contentType: mimeType })
              
              if (!error && data) {
                const { data: publicUrlData } = supabase.storage
                  .from("interview-recordings")
                  .getPublicUrl(fileName)
                
                if (publicUrlData.publicUrl) {
                  await supabase
                    .from("interview_sessions")
                    .update({ recording_url: publicUrlData.publicUrl })
                    .eq("id", sessionId)
                }
              }
            } catch (err) {
              console.error("Video upload failed", err)
            }
            resolve()
          }
          fullSessionRecorderRef.current.stop()
        })
      }

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
    } finally {
      setIsUploadingVideo(false)
    }
  }

  if (authLoading || isCheckingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse font-medium">Verifying session status...</p>
        </div>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-red-500/20 shadow-xl dark:shadow-red-950/10 overflow-hidden bg-white dark:bg-card">
          <div className="h-2 bg-gradient-to-r from-red-500 via-orange-500 to-red-600" />
          <CardContent className="pt-8 pb-8 px-6 text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-2 shadow-inner animate-bounce">
              <ShieldAlert className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {expiryReason === "completed" 
                  ? "Interview Already Completed" 
                  : expiryReason === "terminated"
                  ? "Interview Session Terminated"
                  : "Scheduled Interview Window Closed"}
              </h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                {expiryReason === "completed"
                  ? "This interview session has already been completed and submitted for evaluation. You can view your results on the dashboard."
                  : expiryReason === "terminated"
                  ? "This session was terminated due to policy/proctoring violations. Please contact the recruiter for further details."
                  : "You missed the scheduled interview. Please contact our support team for more info. For now, you will not be able to join any interview."}
              </p>
            </div>

            <div className="bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-950/30 p-4 rounded-xl text-left max-w-md mx-auto">
              <h4 className="text-xs font-bold uppercase text-red-800 dark:text-red-400 mb-1 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> Support Information
              </h4>
              <p className="text-xs text-red-700/80 dark:text-red-300/80 leading-normal">
                Please contact our support team at <span className="font-semibold underline">support@ai-interview.com</span> or reach out to your recruiter to request a rescheduling of your interview slot.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button onClick={() => router.push("/dashboard")} variant="outline" className="w-full sm:w-auto h-11 px-6">
                Return to Dashboard
              </Button>
              <Button 
                onClick={() => window.location.href = "mailto:support@ai-interview.com?subject=Rescheduling Request for Interview"} 
                className="w-full sm:w-auto h-11 px-6 bg-red-600 hover:bg-red-700 text-white"
              >
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !config) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive/50 bg-white dark:bg-card">
          <CardContent className="pt-8 pb-8 px-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-2">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Session Error</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button className="w-full h-11" onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading interview configuration...</p>
        </div>
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
            
            <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg text-sm space-y-3 mb-4">
              <p className="font-bold flex items-center gap-2 text-primary">
                <ShieldAlert className="w-4 h-4" /> Important Interview Rules
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1.5 font-medium ml-1">
                <li><strong className="text-foreground">Do not close or switch tabs.</strong> Doing so will terminate the session.</li>
                <li>Find a <strong className="text-foreground">silent place</strong> with no background noise or voices.</li>
                <li>Ensure <strong className="text-foreground">proper camera lighting</strong> and positioning.</li>
                <li>Ensure <strong className="text-foreground">only your face is visible</strong> (no multiple faces).</li>
                <li><strong className="text-foreground">Do not break eye contact.</strong> You will receive 2 warnings before termination.</li>
              </ul>
            </div>

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
        videoRef={videoRef}
      />
      <header className="p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card">
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
                <span className="text-white">{isUploadingVideo ? "Uploading Recording..." : "Processing..."}</span>
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
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xs font-bold uppercase text-primary">Current Question</h3>
                {currentQuestion && !isProcessing && (
                  <Button variant="outline" size="sm" onClick={() => speakText(currentQuestion)}>
                    Repeat Audio
                  </Button>
                )}
              </div>
              <p className="text-xl font-medium">{currentQuestion || "Preparing..."}</p>
            </CardContent>
          </Card>

          <div className="flex justify-center w-full">
            {isAnswering ? (
              canSubmitAnswer ? (
                <Button variant="destructive" size="lg" onClick={handleAnswerComplete} className="w-full sm:w-40 h-12">
                  Finish Answer
                </Button>
              ) : (
                <Button disabled variant="secondary" size="lg" className="w-full sm:w-60 h-12">
                  Please speak for {canSubmitCountdown}s...
                </Button>
              )
            ) : (
              <Button disabled variant="secondary" size="lg" className="w-full sm:w-40 h-12">
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
