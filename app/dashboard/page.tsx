"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { getSupabaseClient } from "@/lib/supabase-client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Loader2, 
  Plus, 
  History, 
  TrendingUp, 
  AlertCircle, 
  Calendar, 
  ArrowRight,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react"

import { ResumeMakerCard } from "@/components/dashboard/resume-maker-card"
import { CandidateAtsChecker } from "@/components/dashboard/candidate-ats-checker"
import { CompanyAiScanner } from "@/components/dashboard/company-ai-scanner"

// Types for our data
type DashboardSession = {
  id: string
  created_at: string
  overall_score: number | null
  status: string
  processing_status?: string
  failure_reason?: string
  interview_id: string
  interviews: {
    title: string
    interview_type: string
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const supabase = getSupabaseClient()

  const [sessions, setSessions] = useState<DashboardSession[]>([])
  const [scheduledInterviews, setScheduledInterviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalInterviews: 0,
    avgScore: 0,
    topScore: 0,
    passedCount: 0,
    failedCount: 0,
    passPercentage: 0
  })
  const [userRole, setUserRole] = useState<string>("candidate")

  // 1. Auth Check & Data Fetching
  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/auth/login")
      return
    }

    const fetchDashboardData = async () => {
      try {
        // Fetch sessions with joined interview details
        const { data, error } = await supabase
          .from("interview_sessions")
          .select(`
            id,
            created_at,
            overall_score,
            status,
            processing_status,
            failure_reason,
            interview_id,
            interviews (
              title,
              interview_type,
              passing_marks
            )
          `)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (error) throw error

        if (data) {
          // Cast data to our type (Supabase types can be tricky with joins)
          const formattedData = data as unknown as DashboardSession[]
          setSessions(formattedData)

          // Calculate Stats
          const completedSessions = formattedData.filter(s => s.status === 'completed' && s.overall_score !== null)
          const totalScore = completedSessions.reduce((acc, curr) => acc + (curr.overall_score || 0), 0)
          
          let passedCount = 0
          let failedCount = 0
          completedSessions.forEach(s => {
            const passingMarks = (s as any).interviews?.passing_marks || 70
            if ((s.overall_score || 0) >= passingMarks) {
              passedCount++
            } else {
              failedCount++
            }
          })
          
          setStats({
            totalInterviews: formattedData.length,
            avgScore: completedSessions.length ? Math.round(totalScore / completedSessions.length) : 0,
            topScore: completedSessions.length ? Math.max(...completedSessions.map(s => s.overall_score || 0)) : 0,
            passedCount,
            failedCount,
            passPercentage: completedSessions.length ? Math.round((passedCount / completedSessions.length) * 100) : 0
          })
        }

        // Fetch Scheduled Interviews created by this user
        const { data: scheduledData, error: scheduledError } = await supabase
          .from("scheduled_interviews")
          .select(`
            id,
            title,
            role,
            status,
            scheduled_at,
            access_token
          `)
          .eq("recruiter_id", user.id)
          .order("created_at", { ascending: false })

        if (!scheduledError && scheduledData) {
          if (scheduledData.length > 0) {
            // Find the linked candidate interviews by matching title and description
            const titles = scheduledData.map((s: any) => s.title)
            
            const { data: candidateInterviews } = await supabase
              .from("interviews")
              .select("id, user_id, title, description")
              .in("title", titles)
              
            const enrichedData = scheduledData.map((schedule: any) => {
              // Find matching interview
              const matchedInterview = candidateInterviews?.find((i: any) => 
                i.title === schedule.title && 
                i.description === `Role: ${schedule.role}`
              )
              
              return { ...schedule, matched_interview: matchedInterview }
            })
            
            // Now fetch sessions and profiles for the matched candidates
            const candidateIds = enrichedData.map((s: any) => s.matched_interview?.user_id).filter(Boolean)
            
            if (candidateIds.length > 0) {
              const { data: candidateSessions } = await supabase
                .from("interview_sessions")
                .select("id, user_id, overall_score, processing_status, status")
                .in("user_id", candidateIds)
                
              const { data: candidateProfiles } = await supabase
                .from("profiles")
                .select("id, full_name")
                .in("id", candidateIds)

              const finalData = enrichedData.map((schedule: any) => {
                const candidateId = schedule.matched_interview?.user_id
                const session = candidateSessions?.find((s: any) => s.user_id === candidateId)
                const profile = candidateProfiles?.find((p: any) => p.id === candidateId)
                return { ...schedule, session, profiles: profile }
              })
              setScheduledInterviews(finalData)
            } else {
              setScheduledInterviews(enrichedData)
            }
          } else {
            setScheduledInterviews(scheduledData)
          }
        }

        // Fetch User Role
        const { data: profileData } = await supabase.from("profiles").select("role").eq("id", user.id).single()
        if (profileData) {
          setUserRole(profileData.role)
        }
      } catch (err) {
        console.error("Error fetching dashboard:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [user, authLoading, router, supabase])

  // Intelligent Polling for processing interviews
  useEffect(() => {
    if (!user) return
    const hasProcessing = sessions.some(s => s.processing_status === "pending" || s.processing_status === "processing")
    if (!hasProcessing) return

    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from("interview_sessions")
        .select(`
          id, created_at, overall_score, status, processing_status, failure_reason, interview_id,
          interviews (title, interview_type, passing_marks)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (!error && data) {
        setSessions(data as unknown as DashboardSession[])
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [sessions, supabase, user])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6 lg:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back! Here is an overview of your interview performance.
            </p>
          </div>
          <Button onClick={() => router.push("/interview/new")} size="lg" className="shadow-lg w-full md:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Start New Interview
          </Button>
        </div>

        {/* Beta Update Modules */}
        {userRole === "candidate" && (
          <div className="grid gap-4 md:grid-cols-2 mb-8">
            <ResumeMakerCard />
            <CandidateAtsChecker />
          </div>
        )}

        {userRole === "company" && (
          <div className="mb-8">
            <CompanyAiScanner />
          </div>
        )}

        {/* Stats Overview Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Interviews</CardTitle>
              <History className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalInterviews}</div>
              <p className="text-xs text-muted-foreground">Lifetime sessions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgScore}%</div>
              <p className="text-xs text-muted-foreground">Across all completed sessions</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Passed Interviews</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.passedCount}</div>
              <p className="text-xs text-muted-foreground">{stats.passPercentage}% pass rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Interviews</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.failedCount}</div>
              <p className="text-xs text-muted-foreground">Did not meet passing marks</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Best Performance</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.topScore}%</div>
              <p className="text-xs text-muted-foreground">Personal record</p>
            </CardContent>
          </Card>
        </div>

        {/* Scheduled Candidates */}
        {scheduledInterviews.length > 0 && (
          <div className="space-y-4 mb-8">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduled Candidates
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {scheduledInterviews.map((schedule) => (
                <Card key={schedule.id} className="flex flex-col border-primary/20 bg-primary/5">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        schedule.status === 'completed' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : schedule.status === 'active'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {schedule.status}
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {new Date(schedule.scheduled_at).toLocaleDateString()}
                      </span>
                    </div>
                    <CardTitle className="text-lg line-clamp-1">
                      {schedule.profiles?.full_name || "Waiting for candidate"}
                    </CardTitle>
                    <CardDescription className="line-clamp-1">
                      {schedule.title} - {schedule.role}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1">
                    {schedule.session ? (
                      schedule.session.processing_status === 'pending' || schedule.session.processing_status === 'processing' ? (
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-medium">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Evaluating AI...
                        </div>
                      ) : schedule.session.status === 'completed' ? (
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold text-primary">{schedule.session.overall_score || 0}</span>
                          <span className="text-sm text-muted-foreground mb-1">/ 100 Score</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-yellow-600 text-sm font-medium">
                          <AlertCircle className="h-4 w-4" />
                          Candidate Interviewing
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                        <Clock className="h-4 w-4" />
                        Not Started Yet
                      </div>
                    )}
                  </CardContent>
                  
                  <div className="p-6 pt-0 mt-auto">
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => {
                        if (schedule.session?.status === 'completed') {
                           router.push(`/interview/${schedule.matched_interview?.id}/session/${schedule.session?.id}/results`)
                        } else {
                           navigator.clipboard.writeText(schedule.access_token)
                           alert("Access Token copied to clipboard: " + schedule.access_token)
                        }
                      }}
                    >
                      {schedule.session?.status === 'completed' ? 'View Results' : 'Copy Token'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Recent History</h2>
          
          {sessions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <div className="bg-primary/10 p-3 rounded-full mb-4">
                  <History className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-lg font-medium">No interviews yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mt-2 mb-6">
                  Upload a resume or job description to generate your first AI mock interview.
                </p>
                <Button onClick={() => router.push("/interview/new")} variant="outline">
                  Create First Interview
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <Card key={session.id} className="flex flex-col hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <div className="flex justify-between items-start mb-2">
                      <div className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        session.processing_status === 'pending' || session.processing_status === 'processing'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 animate-pulse'
                          : session.processing_status === 'failed' || session.status === 'terminated'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : session.status === 'completed' 
                          ? ((session.overall_score || 0) >= ((session as any).interviews?.passing_marks || 70)
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400')
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {session.processing_status === 'pending' || session.processing_status === 'processing'
                          ? 'Under Review'
                          : session.processing_status === 'failed'
                          ? 'Evaluation Failed'
                          : session.status === 'terminated'
                          ? 'Terminated'
                          : session.status === 'completed' ? ((session.overall_score || 0) >= ((session as any).interviews?.passing_marks || 70) ? 'Passed' : 'Failed') : 'In Progress'}
                      </div>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(session.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <CardTitle className="text-lg line-clamp-1" title={session.interviews?.title}>
                      {session.interviews?.title || "Untitled Session"}
                    </CardTitle>
                    <CardDescription className="line-clamp-1">
                      {session.interviews?.interview_type || "Standard Interview"}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1">
                    {session.processing_status === 'pending' || session.processing_status === 'processing' ? (
                      <div className="flex flex-col items-start justify-center text-blue-600 dark:text-blue-400 mb-4 h-[50px]">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm font-medium">AI is analyzing your responses...</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Results will be available shortly.</p>
                      </div>
                    ) : session.processing_status === 'failed' ? (
                      <div className="flex flex-col items-start justify-center text-red-600 mb-4 h-[50px]">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Analysis Failed</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1" title={session.failure_reason || "Unknown Error"}>
                          {session.failure_reason || "We encountered an issue evaluating your answers."}
                        </p>
                      </div>
                    ) : session.status === 'terminated' ? (
                      <div className="flex flex-col items-start justify-center text-red-600 mb-4 h-[50px]">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Session Terminated</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1" title={session.failure_reason || "Proctoring Violation"}>
                          {session.failure_reason || "Proctoring Violation detected"}
                        </p>
                      </div>
                    ) : session.status === 'completed' ? (
                      <div className="flex items-end gap-2 mb-4">
                        <span className="text-3xl font-bold text-primary">{session.overall_score || 0}</span>
                        <span className="text-sm text-muted-foreground mb-1">/ 100 Score</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-yellow-600 mb-4 h-[36px]">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Not evaluated</span>
                      </div>
                    )}
                  </CardContent>

                  <div className="p-6 pt-0 mt-auto">
                    {session.processing_status === 'pending' || session.processing_status === 'processing' ? (
                      <Button className="w-full" disabled variant="outline">
                        Evaluating...
                      </Button>
                    ) : session.processing_status === 'failed' ? (
                      <Button 
                        className="w-full" 
                        variant="destructive"
                        onClick={async () => {
                          // Optimistically update UI
                          setSessions(prev => prev.map(s => 
                            s.id === session.id 
                              ? { ...s, processing_status: 'pending' } 
                              : s
                          ))
                          
                          await fetch("/api/evaluate", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ sessionId: session.id }),
                          })
                        }}
                      >
                        Retry Analysis
                      </Button>
                    ) : session.status === 'completed' ? (
                      <Button 
                        className="w-full group" 
                        variant="default"
                        onClick={() => router.push(`/interview/${session.interview_id}/session/${session.id}/results`)}
                      >
                        View Analysis & Mistakes
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </Button>
                    ) : (
                      <Button 
                        className="w-full" 
                        variant="outline"
                        onClick={() => router.push(`/interview/${session.interview_id}/session/${session.id}`)}
                      >
                        Resume Session
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}