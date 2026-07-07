"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, Loader2, Target, CheckCircle2, ArrowRight } from "lucide-react"
import { parseDocument } from "@/lib/document-parser"

export function CandidateAtsChecker() {
  const [file, setFile] = useState<File | null>(null)
  const [jobDescription, setJobDescription] = useState("")
  const [loading, setLoading] = useState(false)
  const [score, setScore] = useState<number | null>(null)
  const [error, setError] = useState("")

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setScore(null)
      setError("")
    }
  }

  const handleCheckScore = async () => {
    if (!file) {
      setError("Please upload your resume PDF")
      return
    }

    setLoading(true)
    setError("")
    setScore(null)

    try {
      const parsedData = await parseDocument(file)
      const resumeText = parsedData.text
      
      const res = await fetch("/api/candidate-ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobDescription }),
      })

      if (!res.ok) {
        throw new Error("Failed to analyze resume")
      }

      const data = await res.json()
      if (data.score !== undefined) {
        setScore(data.score)
      } else {
        throw new Error(data.error || "Failed to get score")
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="group bg-white dark:bg-[#111425] border border-border/40 hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-600/5 transition-all duration-300 rounded-2xl p-8 flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-600/10 to-indigo-600/10 rounded-full blur-xl group-hover:scale-125 transition-transform" />
      
      <div className="p-4 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-2xl w-fit mb-6 transition-transform group-hover:scale-110">
        <Target className="h-7 w-7" />
      </div>

      <div className="space-y-2 mb-6 relative z-10">
        <h3 className="text-xl font-bold flex items-center gap-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
          ATS Resume Score Checker
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1.5" />
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Upload your resume and an optional target job description to instantly find out your ATS match score (out of 100).
        </p>
      </div>

      <div className="space-y-5 relative z-10 flex-1 flex flex-col justify-end">
        {error && <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800/30">{error}</div>}
        
        {score !== null ? (
          <div className="flex flex-col items-center justify-center p-6 bg-violet-500/5 rounded-xl border border-violet-500/20 space-y-2 animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-2">
               <CheckCircle2 className="h-8 w-8 text-violet-500" />
               <span className="text-4xl font-bold text-foreground">{score}</span>
               <span className="text-xl text-muted-foreground">/ 100</span>
            </div>
            <p className="text-sm font-medium text-violet-600 dark:text-violet-400">Your ATS Match Score</p>
            <Button className="mt-4 w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold shadow-md" onClick={() => setScore(null)}>Check Another Resume</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Target Job Description</Label>
              <Textarea 
                placeholder="Paste the job description here (optional)..."
                value={jobDescription}
                onChange={e => setJobDescription(e.target.value)}
                className="min-h-[80px] bg-transparent border-border/50 focus:border-violet-500/50 resize-none"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground font-semibold text-xs uppercase tracking-wider">Upload Resume (PDF)</Label>
              <div className="flex items-center gap-4">
                <Input 
                  type="file" 
                  accept=".pdf" 
                  onChange={handleFileChange}
                  disabled={loading}
                  className="flex-1 bg-transparent border-border/50 focus:border-violet-500/50 file:text-violet-600 dark:file:text-violet-400"
                />
              </div>
            </div>

            <Button onClick={handleCheckScore} disabled={loading || !file} className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold shadow-md mt-2">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {loading ? "Analyzing Document..." : "Calculate ATS Score"}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
