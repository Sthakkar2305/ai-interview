"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Calendar, Clock, Copy, Loader2, CheckCircle2, ShieldAlert, Upload, FileQuestion, FileText } from "lucide-react"
import { parseDocument } from "@/lib/document-parser"

type InterviewMode = "document" | "manual"

export default function ScheduleInterviewPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const supabase = getSupabaseClient()

  const [mode, setMode] = useState<InterviewMode>("document")
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [parseProgress, setParseProgress] = useState("")

  const [title, setTitle] = useState("")
  const [role, setRole] = useState("")
  const [difficulty, setDifficulty] = useState("medium")
  const [duration, setDuration] = useState(30)
  const [passingMarks, setPassingMarks] = useState(70)
  const [scheduledAt, setScheduledAt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [generatedToken, setGeneratedToken] = useState("")
  const [generatedId, setGeneratedId] = useState("")

  if (authLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
  if (!user) { router.push("/auth/login"); return null; }

  const generateSecureToken = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase() + "-" + Math.random().toString(36).substring(2, 10).toUpperCase()
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

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === "document" && !file) {
      setError("Please select a document")
      return
    }

    setLoading(true)
    setError("")

    try {
      let documentName = null
      let extractedContent = null
      let topics: string[] = []
      let keyConcepts: Record<string, unknown> = {}
      let manualQa = null

      if (mode === "document" && file) {
        setParseProgress("Parsing document...")
        const parsedData = await parseDocument(file)
        documentName = file.name
        extractedContent = parsedData.text
        topics = parsedData.topics
        keyConcepts = parsedData.keyConcepts
        setParseProgress("Creating scheduled interview...")
      } else {
        manualQa = [
          { question: `Tell me about your experience as a ${role}.`, expectedAnswer: "Candidate should discuss relevant experience." },
          { question: "What is your biggest professional achievement?", expectedAnswer: "Candidate should provide a concrete achievement." },
          { question: "How do you handle difficult situations at work?", expectedAnswer: "Candidate should show problem solving and composure." }
       ]
      }

      const token = generateSecureToken()
      const expiry = new Date(scheduledAt)
      expiry.setDate(expiry.getDate() + 7) // expires 7 days after scheduled time

      const { data, error: insertError } = await supabase
        .from("scheduled_interviews")
        .insert([{
          recruiter_id: user.id,
          title,
          role,
          interview_type: mode,
          difficulty,
          duration_minutes: duration,
          scheduled_at: new Date(scheduledAt).toISOString(),
          expires_at: expiry.toISOString(),
          access_token: token,
          status: "scheduled",
          document_name: documentName,
          manual_qa: manualQa,
          passing_marks: passingMarks,
          question_count: config.questionCount,
        }])
        .select()
        .single()

      if (insertError) throw new Error(insertError.message)

      if (mode === "document" && file) {
        setParseProgress("Saving document analysis...")
        // In the existing schema, document_uploads links to an interview_id
        // However, this is a scheduled interview. 
        // Candidate join logic creates the actual interview row when they join. 
        // We will store the extracted content directly on the scheduled_interviews row for now by updating it if we need to, but we already added document_url, document_name, manual_qa. 
        // We need the candidate page to parse this, but wait: the join page just copies manual_qa. 
        // We should add document parsing results to scheduled_interviews if we want the join page to pick it up. 
        // Let's store topics and keyConcepts in manual_qa as a hack, or in question_categories.
        await supabase.from("scheduled_interviews").update({
          question_categories: { topics, keyConcepts, extractedContent }
        }).eq("id", data.id)
      }

      setGeneratedToken(token)
      setGeneratedId(data.id)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || "Failed to schedule interview")
    } finally {
      setLoading(false)
      setParseProgress("")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Schedule Interview</h1>
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>Back to Dashboard</Button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-12">
        {success ? (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardHeader>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <CardTitle className="text-green-700 dark:text-green-400">Interview Scheduled!</CardTitle>
                  <CardDescription>Share these exact credentials with your candidate.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Candidate Join Link</Label>
                <div className="flex gap-2">
                  <Input readOnly value={`${window.location.origin}/join`} />
                  <Button variant="outline" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join`)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Interview ID</Label>
                <div className="flex gap-2">
                  <Input readOnly value={generatedId} className="font-mono" />
                  <Button variant="outline" onClick={() => navigator.clipboard.writeText(generatedId)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Access Token (Password)</Label>
                <div className="flex gap-2">
                  <Input readOnly value={generatedToken} className="font-mono text-primary font-bold" />
                  <Button variant="outline" onClick={() => navigator.clipboard.writeText(generatedToken)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="bg-yellow-500/10 p-4 rounded-lg flex gap-3 text-sm text-yellow-700 dark:text-yellow-400">
                <ShieldAlert className="h-5 w-5 shrink-0" />
                <p><strong>Strict Proctoring Enabled:</strong> This session will monitor the candidate's camera, tabs, and fullscreen status automatically.</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={() => router.push("/dashboard")}>Done</Button>
            </CardFooter>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Interview Configuration</CardTitle>
              <CardDescription>Configure the interview details to generate a secure join link.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSchedule} className="space-y-6">
                {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded">{error}</div>}
                
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
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Number of Questions</Label>
                    <span className="text-sm font-semibold text-primary">{config.questionCount}</span>
                  </div>
                  <Input 
                    type="number" 
                    min={1} 
                    max={50} 
                    value={config.questionCount}
                    onChange={(e) => setConfig({ ...config, questionCount: parseInt(e.target.value) || 5 })}
                    className="max-w-[150px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Interview Title</Label>
                  <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Frontend Developer Q3" disabled={loading} />
                </div>
                
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input required value={role} onChange={e => setRole(e.target.value)} placeholder="e.g. Frontend Developer" disabled={loading} />
                </div>

                {mode === "document" && (
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
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <select 
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={difficulty} onChange={e => setDifficulty(e.target.value)} disabled={loading}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (Minutes)</Label>
                    <Input type="number" required min={5} max={120} value={duration} onChange={e => setDuration(Number(e.target.value))} disabled={loading} />
                  </div>
                  <div className="space-y-2">
                    <Label>Passing Marks</Label>
                    <Input type="number" required min={1} max={100} value={passingMarks} onChange={e => setPassingMarks(Number(e.target.value))} disabled={loading} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Scheduled Date & Time</Label>
                  <Input type="datetime-local" required value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} disabled={loading} />
                </div>

                <Button type="submit" className="w-full" disabled={loading || (mode === "document" && !file)}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? "Processing..." : "Generate Secure Session"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
