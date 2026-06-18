import { createClient } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft, User, Calendar, Activity, CheckCircle2, AlertCircle, FileText, Mic, Award, ShieldAlert, Video } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function AdminSessionDetails({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Fetch Session Data
  const { data: session } = await supabase.from("interview_sessions").select("*").eq("id", sessionId).single()
  if (!session) return <div className="p-10 text-center">Session not found.</div>

  // Fetch Profile & Interview
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", session.user_id).single()
  const { data: interview } = await supabase.from("interviews").select("*").eq("id", session.interview_id).single()

  // Fetch Answers & Questions
  const { data: answers } = await supabase.from("interview_answers").select("*").eq("session_id", sessionId).order("created_at", { ascending: true })
  
  const questionIds = answers?.map(a => a.question_id) || []
  let questions: any[] = []
  if (questionIds.length > 0) {
    const { data: qData } = await supabase.from("interview_questions").select("*").in("id", questionIds)
    questions = qData || []
  }

  // Fetch Feedback
  const { data: feedback } = await supabase.from("interview_feedback").select("*").eq("session_id", sessionId).single()

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-20">
      <div className="flex items-center gap-4">
        <Link href="/admin">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Deep Session Analysis</h1>
          <p className="text-sm text-muted-foreground">Detailed breakdown of candidate performance.</p>
        </div>
      </div>

      {/* Candidate Profile Info */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-md border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-violet-500" /> Candidate Identity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile?.full_name || "Unknown"}</div>
            <div className="text-sm text-muted-foreground">{profile?.email || "No Email"}</div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" /> Interview Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-primary">{interview?.title || "Unknown Interview"}</div>
            <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <Calendar className="h-3 w-3" /> {new Date(session.created_at).toLocaleString()}
            </div>
            <div className="mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase
                ${session.status === 'completed' || session.session_status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                  session.session_status === 'terminated' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {session.session_status === 'terminated' ? 'Terminated (Violation)' : session.status}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Score Summary */}
      {(session.status === 'completed' || session.session_status === 'completed') && (
        <Card className="shadow-lg border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> Final Evaluation Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-card p-4 rounded-xl border text-center shadow-sm">
                <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-2">Overall</div>
                <div className="text-4xl font-black text-primary">{session.overall_score || 0}%</div>
              </div>
              <div className="bg-white dark:bg-card p-4 rounded-xl border text-center shadow-sm">
                <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-2">Knowledge</div>
                <div className="text-2xl font-bold">{session.knowledge_score || 0}%</div>
              </div>
              <div className="bg-white dark:bg-card p-4 rounded-xl border text-center shadow-sm">
                <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-2">Communication</div>
                <div className="text-2xl font-bold">{session.communication_score || 0}%</div>
              </div>
              <div className="bg-white dark:bg-card p-4 rounded-xl border text-center shadow-sm">
                <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-2">Tech Depth</div>
                <div className="text-2xl font-bold">{session.technical_depth_score || 0}%</div>
              </div>
              <div className="bg-white dark:bg-card p-4 rounded-xl border text-center shadow-sm">
                <div className="text-xs uppercase font-bold text-muted-foreground tracking-wider mb-2">Confidence</div>
                <div className="text-2xl font-bold">{session.confidence_score || 0}%</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {session.session_status === 'terminated' && (
        <div className="bg-red-50 dark:bg-red-500/10 border-l-4 border-red-500 p-6 rounded-r-lg">
          <h3 className="text-lg font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" /> Severe Violation Detected
          </h3>
          <p className="text-red-600 dark:text-red-300 mt-2 font-medium">
            This interview was forcefully terminated by the Proctoring Engine. Reason: {session.failure_reason}
          </p>
        </div>
      )}

      {/* Session Recording Player */}
      {session.recording_url && (
        <Card className="shadow-lg border-primary/20 overflow-hidden">
          <CardHeader className="bg-primary/5 pb-4 border-b">
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Full Interview Recording
            </CardTitle>
            <CardDescription>Watch the complete video and audio recording of this candidate's session</CardDescription>
          </CardHeader>
          <CardContent className="p-0 bg-black">
            <video 
              controls 
              src={session.recording_url} 
              className="w-full max-h-[600px] object-contain" 
              preload="metadata"
            />
          </CardContent>
        </Card>
      )}

      {/* Deep Feedback Analysis */}
      {feedback && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="shadow-md border-t-4 border-t-emerald-500">
            <CardHeader><CardTitle className="text-emerald-700 dark:text-emerald-400">Core Strengths</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {feedback.strengths?.map((s: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5"/> {s}</li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="shadow-md border-t-4 border-t-orange-500">
            <CardHeader><CardTitle className="text-orange-700 dark:text-orange-400">Areas for Improvement</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {feedback.weaknesses?.map((w: string, i: number) => (
                  <li key={i} className="flex gap-2 text-sm"><AlertCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5"/> {w}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Q&A Transcript */}
      <h2 className="text-xl font-bold mt-8 border-b pb-2 flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" /> Full Q&A Transcript
      </h2>
      
      <div className="space-y-6">
        {answers?.length === 0 && (
          <div className="text-muted-foreground italic bg-muted/30 p-8 text-center rounded-xl">No answers were recorded during this session.</div>
        )}
        {answers?.map((answer, index) => {
          const question = questions.find(q => q.id === answer.question_id)
          return (
            <Card key={answer.id} className="shadow-sm border-l-4 border-l-primary/50 overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-b">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center justify-between">
                  <span>Question {index + 1}</span>
                  {answer.content_score && (
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">Score: {answer.content_score}%</span>
                  )}
                </div>
                <div className="text-lg font-medium">
                  {question?.question_text || "Unknown Question"}
                </div>
              </div>
              <div className="p-4 bg-white dark:bg-card">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Mic className="h-3 w-3" /> Candidate's Spoken Answer
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {answer.transcript || <span className="text-muted-foreground italic">No speech detected or transcribed.</span>}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

    </div>
  )
}
