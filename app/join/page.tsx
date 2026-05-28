"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Loader2, ShieldCheck, Video } from "lucide-react"

export default function JoinInterviewPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const supabase = getSupabaseClient()

  const [interviewId, setInterviewId] = useState("")
  const [token, setToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      // Typically candidates might have anonymous accounts or we force them to sign in.
      router.push("/auth/login?redirect=/join")
      return
    }

    setLoading(true)
    setError("")

    try {
      // Verify the scheduled interview
      const { data: interviewData, error: interviewError } = await supabase
        .from("scheduled_interviews")
        .select("*")
        .eq("id", interviewId)
        .eq("access_token", token)
        .single()

      if (interviewError || !interviewData) {
        throw new Error("Invalid Interview ID or Access Token")
      }

      if (interviewData.status === 'completed' || interviewData.status === 'terminated') {
        throw new Error("This interview session has already ended.")
      }

      const now = new Date()
      if (new Date(interviewData.expires_at) < now) {
        throw new Error("This interview session has expired.")
      }

      // Instead of creating the 'interviews' table row manually, we can directly create a session
      // if the system expects an interview_id pointing to the 'interviews' table, 
      // we need to mirror the scheduled interview into the 'interviews' table first for the foreign key.
      
      const { data: baseInterview, error: baseError } = await supabase
        .from("interviews")
        .insert([{
          user_id: user.id, // Candidate owns this instance
          title: interviewData.title,
          description: `Role: ${interviewData.role}`,
          interview_type: interviewData.interview_type,
          manual_qa: interviewData.manual_qa,
        }])
        .select()
        .single()

      if (baseError) throw new Error("Failed to initialize interview instance: " + baseError.message)

      // Create session
      const { data: sessionData, error: sessionError } = await supabase
        .from("interview_sessions")
        .insert([{
          interview_id: baseInterview.id,
          user_id: user.id,
          status: "in_progress",
        }])
        .select()
        .single()

      if (sessionError) throw new Error("Failed to start session: " + sessionError.message)

      let topics: string[] = []
      let keyConcepts: Record<string, unknown> = {}
      let documentContent = ""

      if (interviewData.interview_type === "document" && interviewData.question_categories) {
        const qc = interviewData.question_categories as any
        topics = qc.topics || []
        keyConcepts = qc.keyConcepts || {}
        documentContent = qc.extractedContent || ""
      }

      // Store config in session storage so the interview page can read it immediately
      sessionStorage.setItem(
        `interview_config_${sessionData.id}`,
        JSON.stringify({
          duration: interviewData.duration_minutes,
          questionCount: Array.isArray(interviewData.manual_qa) ? interviewData.manual_qa.length : 5,
          difficulty: interviewData.difficulty,
          mode: interviewData.interview_type,
          manualQa: interviewData.manual_qa || [],
          topics,
          keyConcepts,
          documentContent
        }),
      )

      // Update scheduled_interviews status
      await supabase
        .from("scheduled_interviews")
        .update({ status: 'active', candidate_id: user.id })
        .eq("id", interviewId)

      // Jump straight into the interview!
      router.push(`/interview/${baseInterview.id}/session/${sessionData.id}`)
    } catch (err: any) {
      setError(err.message || "Failed to join interview")
      setLoading(false)
    }
  }

  if (authLoading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
            <Video className="w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Join Interview</CardTitle>
          <CardDescription>Enter your credentials to start the assessment.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleJoin} className="space-y-5">
            {error && <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded font-medium">{error}</div>}
            
            <div className="space-y-2">
              <Label>Interview ID</Label>
              <Input 
                required 
                value={interviewId} 
                onChange={e => setInterviewId(e.target.value)} 
                placeholder="00000000-0000-0000-0000-000000000000" 
                className="font-mono text-sm"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Access Token</Label>
              <Input 
                required 
                type="password"
                value={token} 
                onChange={e => setToken(e.target.value)} 
                placeholder="Enter secure token" 
                className="font-mono text-sm"
              />
            </div>

            <div className="bg-blue-500/10 p-4 rounded-lg flex items-start gap-3 mt-6">
              <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="text-xs text-blue-800 dark:text-blue-300">
                <p className="font-semibold mb-1">Strict Proctoring Enabled</p>
                <p>Your camera and screen activity will be monitored throughout the interview. Please ensure you are in a quiet, well-lit room.</p>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-md mt-2" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {loading ? "Verifying..." : "Start Interview Immediately"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
