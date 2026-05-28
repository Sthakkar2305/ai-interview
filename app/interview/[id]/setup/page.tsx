"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, AlertCircle, CheckCircle2, Settings } from "lucide-react"
import type { Database } from "@/lib/supabase-client"

type Interview = Database["public"]["Tables"]["interviews"]["Row"]
type DocumentUpload = Database["public"]["Tables"]["document_uploads"]["Row"]

interface InterviewConfig {
  duration: number
  questionCount: number
  difficulty: "easy" | "medium" | "hard" | "mixed"
  includeStressQuestions: boolean
  questionType: "paraphrased" | "scenario-based" | "mixed"
}

type ManualQaItem = {
  question: string
  expectedAnswer: string
}

export default function InterviewSetupPage() {
  const router = useRouter()
  const params = useParams()
  const { user, loading: authLoading } = useAuth()
  const supabase = getSupabaseClient()
  const interviewId = params.id as string

  const [interview, setInterview] = useState<Interview | null>(null)
  const [document, setDocument] = useState<DocumentUpload | null>(null)
  const [config, setConfig] = useState<InterviewConfig>({
    duration: 30,
    questionCount: 5,
    difficulty: "medium",
    includeStressQuestions: false,
    questionType: "mixed",
  })

  const [loading, setLoading] = useState(true)
  const [startingSession, setStartingSession] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/auth/login")
      return
    }

    const fetchInterviewData = async () => {
      try {
        // Fetch interview
        const { data: interviewData, error: interviewError } = await supabase
          .from("interviews")
          .select("*")
          .eq("id", interviewId)
          .eq("user_id", user.id)
          .single()

        if (interviewError) {
          setError(interviewError.message)
          return
        }

        setInterview(interviewData)

        if (interviewData.interview_type === "manual") {
          const manualQa = Array.isArray(interviewData.manual_qa) ? interviewData.manual_qa : []
          setConfig((current) => ({ ...current, questionCount: manualQa.length || current.questionCount }))
        } else {
          // Fetch document
          const { data: docData, error: docError } = await supabase
            .from("document_uploads")
            .select("*")
            .eq("interview_id", interviewId)
            .single()

          if (docError) {
            setError(docError.message)
            return
          }

          setDocument(docData)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load interview data")
      } finally {
        setLoading(false)
      }
    }

    fetchInterviewData()
  }, [user, authLoading, interviewId, supabase, router])

  const handleStartInterview = async () => {
    if (!interview) return
    const isManual = interview.interview_type === "manual"
    if (!isManual && !document) return

    setStartingSession(true)
    setError("")

    try {
      // Create interview session
      const { data: sessionData, error: sessionError } = await supabase
        .from("interview_sessions")
        .insert([
          {
            interview_id: interviewId,
            user_id: user!.id,
            status: "in_progress",
          },
        ])
        .select()
        .single()

      if (sessionError) {
        setError(sessionError.message)
        setStartingSession(false)
        return
      }

      const manualQa = Array.isArray(interview.manual_qa) ? (interview.manual_qa as ManualQaItem[]) : []

      sessionStorage.setItem(
        `interview_config_${sessionData.id}`,
        JSON.stringify({
          ...config,
          mode: isManual ? "manual" : "document",
          questionCount: isManual ? manualQa.length : config.questionCount,
          documentContent: document?.extracted_content || "",
          topics: document?.topics || [],
          keyConcepts: document?.key_concepts || {},
          manualQa,
        }),
      )

      router.push(`/interview/${interviewId}/session/${sessionData.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start interview")
      setStartingSession(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!interview || (interview.interview_type !== "manual" && !document)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">Interview Not Found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {error || "The interview data could not be loaded"}
                </p>
                <Button className="mt-4" onClick={() => router.push("/")}>
                  Back to Home
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Interview Setup</h1>
          <Button variant="ghost" onClick={() => router.push("/")}>
            Back
          </Button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle>Interview Configuration</CardTitle>
                <CardDescription>Customize your interview experience before starting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-lg flex gap-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>{error}</div>
                  </div>
                )}

                {/* Duration */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Interview Duration</Label>
                    <span className="text-sm font-semibold text-primary">{config.duration} minutes</span>
                  </div>
                  <div className="flex gap-2">
                    {[15, 30, 45, 60].map((duration) => (
                      <Button
                        key={duration}
                        variant={config.duration === duration ? "default" : "outline"}
                        size="sm"
                        onClick={() => setConfig({ ...config, duration })}
                        className={config.duration === duration ? "" : "bg-transparent"}
                      >
                        {duration}m
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Question Count */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Number of Questions</Label>
                    <span className="text-sm font-semibold text-primary">{config.questionCount}</span>
                  </div>
                  <div className="flex gap-2">
                    {[3, 5, 7, 10].map((count) => (
                      <Button
                        key={count}
                        variant={config.questionCount === count ? "default" : "outline"}
                        size="sm"
                        onClick={() => setConfig({ ...config, questionCount: count })}
                        className={config.questionCount === count ? "" : "bg-transparent"}
                      >
                        {count}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Difficulty Level */}
                <div className="space-y-3">
                  <Label className="text-base">Difficulty Level</Label>
                  <RadioGroup
                    value={config.difficulty}
                    onValueChange={(value) => setConfig({ ...config, difficulty: value as typeof config.difficulty })}
                  >
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted">
                      <RadioGroupItem value="easy" id="easy" />
                      <Label htmlFor="easy" className="flex-1 cursor-pointer font-normal">
                        <span className="font-semibold">Easy</span> - Basic concepts and foundational questions
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted">
                      <RadioGroupItem value="medium" id="medium" />
                      <Label htmlFor="medium" className="flex-1 cursor-pointer font-normal">
                        <span className="font-semibold">Medium</span> - Balanced mix of difficulty levels
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted">
                      <RadioGroupItem value="hard" id="hard" />
                      <Label htmlFor="hard" className="flex-1 cursor-pointer font-normal">
                        <span className="font-semibold">Hard</span> - Advanced and challenging questions
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted">
                      <RadioGroupItem value="mixed" id="mixed" />
                      <Label htmlFor="mixed" className="flex-1 cursor-pointer font-normal">
                        <span className="font-semibold">Mixed</span> - Progressive difficulty progression
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Question Type */}
                <div className="space-y-3">
                  <Label className="text-base">Question Format</Label>
                  <RadioGroup
                    value={config.questionType}
                    onValueChange={(value) =>
                      setConfig({ ...config, questionType: value as typeof config.questionType })
                    }
                  >
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted">
                      <RadioGroupItem value="paraphrased" id="paraphrased" />
                      <Label htmlFor="paraphrased" className="flex-1 cursor-pointer font-normal">
                        <span className="font-semibold">Paraphrased Questions</span> - Rewording of concepts
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted">
                      <RadioGroupItem value="scenario-based" id="scenario-based" />
                      <Label htmlFor="scenario-based" className="flex-1 cursor-pointer font-normal">
                        <span className="font-semibold">Scenario-Based</span> - Real-world application questions
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg hover:bg-muted">
                      <RadioGroupItem value="mixed" id="mixed-type" />
                      <Label htmlFor="mixed-type" className="flex-1 cursor-pointer font-normal">
                        <span className="font-semibold">Mixed Format</span> - Combination of both types
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Stress Questions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted">
                    <Label className="flex-1 cursor-pointer font-normal">
                      <span className="font-semibold">Include Stress Questions</span>
                      <p className="text-sm text-muted-foreground mt-1">
                        Adds challenging hypothetical questions to test critical thinking
                      </p>
                    </Label>
                    <input
                      type="checkbox"
                      checked={config.includeStressQuestions}
                      onChange={(e) => setConfig({ ...config, includeStressQuestions: e.target.checked })}
                      className="w-5 h-5 rounded border-input cursor-pointer"
                    />
                  </div>
                </div>

                <Button onClick={handleStartInterview} disabled={startingSession} className="w-full mt-8" size="lg">
                  {startingSession && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {startingSession ? "Starting Interview..." : "Start Interview"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Summary Panel */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="border-secondary/20 bg-secondary/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Interview Title</p>
                  <p className="font-semibold text-foreground">{interview.title}</p>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-muted-foreground">{interview.interview_type === "manual" ? "Mode" : "Document"}</p>
                  <p className="font-semibold text-foreground truncate">
                    {interview.interview_type === "manual" ? "Manual Q&A" : document?.file_name}
                  </p>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Duration</span>
                    <span className="font-semibold">{config.duration} min</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Questions</span>
                    <span className="font-semibold">{config.questionCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Difficulty</span>
                    <span className="font-semibold capitalize">{config.difficulty}</span>
                  </div>
                </div>

                {document?.topics && document.topics.length > 0 && (
                  <div className="border-t border-border pt-4">
                    <p className="text-muted-foreground mb-2">Topics Detected</p>
                    <div className="flex flex-wrap gap-2">
                      {document.topics.slice(0, 3).map((topic, idx) => (
                        <span key={idx} className="bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">
                          {topic}
                        </span>
                      ))}
                      {document.topics.length > 3 && (
                        <span className="bg-muted text-muted-foreground text-xs px-2.5 py-1 rounded-full">
                          +{document.topics.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="border-t border-border pt-4 flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold text-foreground">Ready to Start</p>
                    <p className="text-muted-foreground">Your interview is configured and ready to begin</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
