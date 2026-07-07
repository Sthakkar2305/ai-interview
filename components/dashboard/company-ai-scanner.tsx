"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, Loader2, ScanFace, CheckCircle2, XCircle } from "lucide-react"
import { parseDocument } from "@/lib/document-parser"

export function CompanyAiScanner() {
  const [file, setFile] = useState<File | null>(null)
  
  // ATS Config
  const [jobDescription, setJobDescription] = useState("")
  const [scoreLimit, setScoreLimit] = useState(70)
  
  // Candidate Info
  const [candidateName, setCandidateName] = useState("")
  const [candidateEmail, setCandidateEmail] = useState("")
  
  // Interview Config
  const [title, setTitle] = useState("")
  const [role, setRole] = useState("")
  const [duration, setDuration] = useState(30)
  const [passingMarks, setPassingMarks] = useState(70)
  const [questionCount, setQuestionCount] = useState(5)
  const [scheduledAt, setScheduledAt] = useState("")
  
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ score: number, passed: boolean, message: string } | null>(null)
  const [error, setError] = useState("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError("")
    }
  }

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("Please upload candidate's resume (PDF)")
      return
    }

    setLoading(true)
    setError("")
    setResult(null)

    try {
      const parsedData = await parseDocument(file)
      const resumeText = parsedData.text
      
      const payload = {
        resumeText,
        jobDescription,
        scoreLimit,
        candidateName,
        candidateEmail,
        title,
        role,
        duration,
        passingMarks,
        questionCount,
        scheduledAt,
        documentName: file.name
      }

      const res = await fetch("/api/company-ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to process resume")
      }

      setResult({
        score: data.score,
        passed: data.passed,
        message: data.message
      })
      
      if (data.passed) {
        // Optional: clear form on success
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="group bg-white dark:bg-[#111425] border border-border/40 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-600/5 transition-all duration-300 rounded-2xl p-8 flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-600/10 to-blue-600/10 rounded-full blur-xl group-hover:scale-125 transition-transform" />
      
      <div className="p-4 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl w-fit mb-6 transition-transform group-hover:scale-110">
        <ScanFace className="h-7 w-7" />
      </div>

      <div className="space-y-2 mb-8 relative z-10">
        <h3 className="text-xl font-bold flex items-center gap-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          AI Resume Scanner & Auto-Scheduler
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed max-w-3xl">
          Automatically screen resumes against a score limit. If passed, an interview is scheduled and emailed. Otherwise, a rejection is sent.
        </p>
      </div>

      <div className="relative z-10 flex-1">
        {result ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl animate-in fade-in zoom-in duration-300">
            {result.passed ? (
              <CheckCircle2 className="h-16 w-16 text-indigo-500" />
            ) : (
              <XCircle className="h-16 w-16 text-red-500" />
            )}
            <h3 className="text-3xl font-bold text-foreground">ATS Score: {result.score}<span className="text-xl text-muted-foreground">/100</span></h3>
            <p className="text-muted-foreground font-medium">{result.message}</p>
            <Button onClick={() => setResult(null)} variant="outline" className="mt-6 border-indigo-500/20 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 h-11 px-6">
              Scan Another Resume
            </Button>
          </div>
        ) : (
          <form onSubmit={handleScan} className="space-y-8">
            {error && <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800/30">{error}</div>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              {/* Left Column: ATS & Candidate */}
              <div className="space-y-5">
                <h3 className="font-semibold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b border-indigo-500/20 pb-2">Step 1: ATS Screening</h3>
                <div className="space-y-2">
                  <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Candidate Name</Label>
                  <Input required value={candidateName} onChange={e => setCandidateName(e.target.value)} disabled={loading} className="bg-transparent border-border/50 focus:border-indigo-500/50 h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Candidate Email</Label>
                  <Input type="email" required value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)} disabled={loading} className="bg-transparent border-border/50 focus:border-indigo-500/50 h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Target Job Description</Label>
                  <Textarea required placeholder="Job description for AI context" value={jobDescription} onChange={e => setJobDescription(e.target.value)} disabled={loading} className="bg-transparent border-border/50 focus:border-indigo-500/50 min-h-[100px] resize-none" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">ATS Score Limit (1-100)</Label>
                  <Input type="number" min={1} max={100} required value={scoreLimit} onChange={e => setScoreLimit(Number(e.target.value))} disabled={loading} className="bg-transparent border-border/50 focus:border-indigo-500/50 h-11" />
                  <p className="text-xs text-muted-foreground mt-1">Candidate must score &gt;= this to be scheduled.</p>
                </div>
                <div className="space-y-2 pt-2">
                  <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Upload Candidate Resume (PDF)</Label>
                  <Input type="file" accept=".pdf" required onChange={handleFileChange} disabled={loading} className="bg-transparent border-border/50 focus:border-indigo-500/50 h-11 file:text-indigo-600 dark:file:text-indigo-400 file:h-full file:border-0 file:bg-transparent" />
                </div>
              </div>

              {/* Right Column: Interview Config */}
              <div className="space-y-5">
                <h3 className="font-semibold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b border-indigo-500/20 pb-2">Step 2: Auto-Schedule Config (If Passed)</h3>
                <div className="space-y-2">
                  <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Interview Title</Label>
                  <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Frontend Developer Technical" disabled={loading} className="bg-transparent border-border/50 focus:border-indigo-500/50 h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Role</Label>
                  <Input required value={role} onChange={e => setRole(e.target.value)} disabled={loading} className="bg-transparent border-border/50 focus:border-indigo-500/50 h-11" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Duration (Min)</Label>
                    <Input type="number" required min={5} value={duration} onChange={e => setDuration(Number(e.target.value))} disabled={loading} className="bg-transparent border-border/50 focus:border-indigo-500/50 h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Questions</Label>
                    <Input type="number" required min={1} value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))} disabled={loading} className="bg-transparent border-border/50 focus:border-indigo-500/50 h-11" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Passing Marks (1-100)</Label>
                  <Input type="number" required min={1} max={100} value={passingMarks} onChange={e => setPassingMarks(Number(e.target.value))} disabled={loading} className="bg-transparent border-border/50 focus:border-indigo-500/50 h-11" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Scheduled Date & Time</Label>
                  <Input type="datetime-local" required value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} disabled={loading} className="bg-transparent border-border/50 focus:border-indigo-500/50 h-11" />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-border/40">
              <Button type="submit" className="w-full sm:w-auto h-11 px-8 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold shadow-md" disabled={loading || !file}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? "Analyzing Document and Processing..." : "Scan & Auto-Schedule"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
