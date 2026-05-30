"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getSupabaseClient } from "@/lib/supabase-client"
import { AlertCircle, FileQuestion, FileText, Loader2, Upload } from "lucide-react"
import { parseDocument } from "@/lib/document-parser"

type InterviewMode = "document" | "manual"

interface ManualQaItem {
  question: string
  expectedAnswer: string
}

const QUESTION_COUNTS = [3, 5, 7] as const

function createManualQa(count: number, existing: ManualQaItem[] = []): ManualQaItem[] {
  return Array.from({ length: count }, (_, index) => existing[index] || { question: "", expectedAnswer: "" })
}

export default function NewInterviewPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const supabase = getSupabaseClient()

  const [mode, setMode] = useState<InterviewMode>("document")
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [manualQuestionCount, setManualQuestionCount] = useState<(typeof QUESTION_COUNTS)[number]>(3)
  const [manualQa, setManualQa] = useState<ManualQaItem[]>(createManualQa(3))
  const [difficulty, setDifficulty] = useState("medium")
  const [duration, setDuration] = useState(30)
  const [passingMarks, setPassingMarks] = useState(70)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [dragActive, setDragActive] = useState(false)
  const [parseProgress, setParseProgress] = useState("")

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    router.push("/auth/login")
    return null
  }

  const setQuestionCount = (count: (typeof QUESTION_COUNTS)[number]) => {
    setManualQuestionCount(count)
    setManualQa((current) => createManualQa(count, current))
  }

  const updateManualQa = (index: number, field: keyof ManualQaItem, value: string) => {
    setManualQa((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)))
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles && droppedFiles[0]) {
      validateAndSetFile(droppedFiles[0])
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    if (
      selectedFile.type === "application/pdf" ||
      selectedFile.type === "application/msword" ||
      selectedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      setFile(selectedFile)
      setError("")
    } else {
      setError("Please upload a PDF or Word document (DOCX, DOC)")
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0])
    }
  }

  const createManualInterview = async () => {
    const normalizedQa = manualQa.map((item) => ({
      question: item.question.trim(),
      expectedAnswer: item.expectedAnswer.trim(),
    }))

    const missingIndex = normalizedQa.findIndex((item) => !item.question || !item.expectedAnswer)
    if (missingIndex >= 0) {
      setError(`Please complete both fields for question ${missingIndex + 1}`)
      return
    }

    setLoading(true)
    setParseProgress("Creating manual interview...")

    const { data: interviewData, error: interviewError } = await supabase
      .from("interviews")
      .insert([
        {
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          document_name: null,
          interview_type: "manual",
          manual_qa: normalizedQa,
          passing_marks: passingMarks,
        },
      ])
      .select()
      .single()

    if (interviewError) {
      setError(interviewError.message)
      setLoading(false)
      setParseProgress("")
      return
    }

    setParseProgress("Initializing session...")

    const { data: sessionData, error: sessionError } = await supabase
      .from("interview_sessions")
      .insert([
        {
          interview_id: interviewData.id,
          user_id: user.id,
          status: "in_progress",
        },
      ])
      .select()
      .single()

    if (sessionError) {
      setError(sessionError.message)
      setLoading(false)
      setParseProgress("")
      return
    }

    sessionStorage.setItem(
      `interview_config_${sessionData.id}`,
      JSON.stringify({
        duration: duration,
        questionCount: normalizedQa.length,
        difficulty: difficulty,
        mode: "manual",
        manualQa: normalizedQa,
      }),
    )

    router.push(`/interview/${interviewData.id}/session/${sessionData.id}`)
  }

  const createDocumentInterview = async () => {
    if (!file) {
      setError("Please select a document")
      return
    }

    setLoading(true)
    setParseProgress("Parsing document...")

    const parsedData = await parseDocument(file)
    setParseProgress("Creating interview...")

    const { data: interviewData, error: interviewError } = await supabase
      .from("interviews")
      .insert([
        {
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          document_name: file.name,
          interview_type: "document",
          manual_qa: null,
          passing_marks: passingMarks,
        },
      ])
      .select()
      .single()

    if (interviewError) {
      setError(interviewError.message)
      setLoading(false)
      setParseProgress("")
      return
    }

    setParseProgress("Saving document analysis...")

    const { error: docError } = await supabase.from("document_uploads").insert([
      {
        user_id: user.id,
        interview_id: interviewData.id,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type.includes("pdf") ? "pdf" : "docx",
        extracted_content: parsedData.text,
        topics: parsedData.topics,
        key_concepts: parsedData.keyConcepts,
        difficulty_assessment: parsedData.difficultyAssessment,
      },
    ])

    if (docError) {
      setError(docError.message)
      setLoading(false)
      setParseProgress("")
      return
    }

    router.push(`/interview/${interviewData.id}/setup`)
    router.refresh()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!title.trim()) {
      setError("Please enter an interview title")
      return
    }

    try {
      if (mode === "manual") {
        await createManualInterview()
      } else {
        await createDocumentInterview()
      }
    } catch (err) {
      console.error("[v0] Error:", err)
      setError(err instanceof Error ? err.message : "An error occurred while creating the interview")
    } finally {
      setLoading(false)
      setParseProgress("")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">AI Interview Platform</h1>
          <Button variant="ghost" onClick={() => router.push("/")}>
            Back
          </Button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Start New Interview</h2>
            <p className="text-muted-foreground">Upload a source document or write exact manual questions</p>
          </div>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle>Interview Details</CardTitle>
              <CardDescription>Choose how the interview should be generated</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-4 rounded-lg flex gap-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>{error}</div>
                  </div>
                )}

                {parseProgress && (
                  <div className="bg-primary/10 text-primary text-sm p-4 rounded-lg flex gap-3 items-center">
                    <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
                    <div>{parseProgress}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                  <Button
                    type="button"
                    variant={mode === "document" ? "default" : "ghost"}
                    className="gap-2"
                    onClick={() => setMode("document")}
                    disabled={loading}
                  >
                    <Upload className="h-4 w-4" />
                    Upload Document
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "manual" ? "default" : "ghost"}
                    className="gap-2"
                    onClick={() => setMode("manual")}
                    disabled={loading}
                  >
                    <FileQuestion className="h-4 w-4" />
                    Manual Q&A
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Interview Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Software Engineer Role Interview"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Input
                    id="description"
                    placeholder="e.g., Mock interview for senior software engineer position"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="passingMarks">Passing Marks (0-100)</Label>
                  <Input
                    id="passingMarks"
                    type="number"
                    min={1}
                    max={100}
                    value={passingMarks}
                    onChange={(e) => setPassingMarks(Number(e.target.value))}
                    disabled={loading}
                    required
                  />
                </div>

                {mode === "document" ? (
                  <div className="space-y-3">
                    <Label>Upload Interview Content</Label>
                    <div
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        dragActive
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-primary/2"
                      }`}
                    >
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={handleFileChange}
                        disabled={loading}
                        className="hidden"
                        id="fileInput"
                      />

                      <label htmlFor="fileInput" className="cursor-pointer block">
                        <div className="flex flex-col items-center gap-2">
                          {file ? (
                            <>
                              <FileText className="h-12 w-12 text-primary" />
                              <p className="font-semibold text-foreground">{file.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                              <Button type="button" variant="outline" size="sm" className="mt-2 bg-transparent">
                                Choose Different File
                              </Button>
                            </>
                          ) : (
                            <>
                              <Upload className="h-12 w-12 text-muted-foreground" />
                              <p className="font-semibold text-foreground">Drag and drop your document here</p>
                              <p className="text-sm text-muted-foreground">or click to browse</p>
                              <p className="text-xs text-muted-foreground mt-1">PDF, DOC, or DOCX files accepted</p>
                            </>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="difficulty">Difficulty</Label>
                        <select
                          id="difficulty"
                          value={difficulty}
                          onChange={(e) => setDifficulty(e.target.value)}
                          disabled={loading}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="duration">Duration (Minutes)</Label>
                        <Input
                          id="duration"
                          type="number"
                          min={5}
                          max={120}
                          value={duration}
                          onChange={(e) => setDuration(Number(e.target.value))}
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="questionCount">Number of Questions</Label>
                      <select
                        id="questionCount"
                        value={manualQuestionCount}
                        onChange={(e) => setQuestionCount(Number(e.target.value) as (typeof QUESTION_COUNTS)[number])}
                        disabled={loading}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {QUESTION_COUNTS.map((count) => (
                          <option key={count} value={count}>
                            {count}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-4">
                      {manualQa.map((item, index) => (
                        <div key={index} className="rounded-lg border border-border p-4 space-y-3">
                          <div className="flex items-center gap-2 font-semibold">
                            <FileQuestion className="h-4 w-4 text-primary" />
                            Question {index + 1}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`manual-question-${index}`}>Question</Label>
                            <Textarea
                              id={`manual-question-${index}`}
                              value={item.question}
                              onChange={(e) => updateManualQa(index, "question", e.target.value)}
                              placeholder="Type the exact question the interviewer should ask"
                              disabled={loading}
                              rows={2}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`manual-answer-${index}`}>Expected Answer</Label>
                            <Textarea
                              id={`manual-answer-${index}`}
                              value={item.expectedAnswer}
                              onChange={(e) => updateManualQa(index, "expectedAnswer", e.target.value)}
                              placeholder="Type the answer the candidate should be evaluated against"
                              disabled={loading}
                              rows={4}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={loading || (mode === "document" && !file)}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Processing..." : mode === "manual" ? "Start Interview Immediately" : "Continue to Interview Setup"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
