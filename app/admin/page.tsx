import { createClient } from "@supabase/supabase-js"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Video, Activity, ShieldCheck, Search } from "lucide-react"
import { DeleteUserButton, DeleteSessionButton } from "@/components/admin/DeleteButtons"

// Force dynamic rendering so stats are always fresh on page load
export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  
  // Use raw supabase-js client with Service Role Key to strictly bypass RLS
  // Do NOT pass cookies, or else Supabase will downgrade to the user's RLS permissions
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )

  // Fetch all profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })

  // Fetch all interviews (templates)
  const { data: interviews } = await supabase
    .from("interviews")
    .select("*")

  // Fetch all sessions (WITHOUT JOINS to avoid PostgREST FK errors)
  const { data: rawSessions } = await supabase
    .from("interview_sessions")
    .select("*")
    .order("created_at", { ascending: false })

  // Manually join the data to ensure it works regardless of database FK constraints
  const sessions = rawSessions?.map(session => {
    const profile = profiles?.find(p => p.id === session.user_id)
    const interview = interviews?.find(i => i.id === session.interview_id)
    return {
      ...session,
      profiles: profile || { full_name: "Unknown", email: "Unknown" },
      interviews: interview || { title: "Unknown Interview" }
    }
  }) || []

  const totalUsers = profiles?.length || 0
  const totalInterviews = interviews?.length || 0
  const totalSessions = sessions?.length || 0
  
  const completedSessions = sessions?.filter(s => s.status === 'completed' || s.session_status === 'completed') || []
  const avgScore = completedSessions.length > 0 
    ? completedSessions.reduce((acc, s) => acc + (s.overall_score || 0), 0) / completedSessions.length 
    : 0

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text">
          Global Dashboard
        </h1>
        <p className="text-muted-foreground mt-2 text-lg">
          Monitor all candidates, interviews, and detailed AI scoring across the platform.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-violet-500 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Registered Users</CardTitle>
            <Users className="h-5 w-5 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-blue-500 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Interview Types</CardTitle>
            <Video className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalInterviews}</div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-amber-500 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Total Sessions</CardTitle>
            <Activity className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalSessions}</div>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-emerald-500 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Global Average</CardTitle>
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{avgScore.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Across {completedSessions.length} completed sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Grid for Profiles and Sessions */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
        
        {/* User Profiles Table */}
        <Card className="lg:col-span-5 shadow-lg border-border/40">
          <CardHeader className="border-b bg-slate-50/50 dark:bg-card/50 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Profile Database
            </CardTitle>
            <CardDescription>All user accounts created on the platform.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col h-[600px] overflow-y-auto">
              {profiles?.map((profile, index) => {
                const userSessions = rawSessions?.filter(s => s.user_id === profile.id) || []
                return (
                <div key={profile.id} className={`flex items-center justify-between p-4 ${index !== 0 ? 'border-t' : ''} hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors`}>
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {(profile.full_name || profile.email || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-sm">{profile.full_name || "Unknown User"}</div>
                      <div className="text-xs text-muted-foreground">{profile.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="text-sm font-bold text-primary">{userSessions.length} Interviews</div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mt-0.5">
                        Joined: {new Date(profile.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {profile.email !== 'sthakkar837@gmail.com' && (
                      <DeleteUserButton userId={profile.id} userName={profile.full_name || profile.email} />
                    )}
                  </div>
                </div>
              )})}
              {profiles?.length === 0 && (
                <div className="text-center text-muted-foreground p-8 flex flex-col items-center">
                  <Search className="h-8 w-8 mb-2 opacity-20" />
                  No users found in database.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sessions Activity Log */}
        <Card className="lg:col-span-7 shadow-lg border-border/40">
          <CardHeader className="border-b bg-slate-50/50 dark:bg-card/50 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> Session Audit Log
            </CardTitle>
            <CardDescription>Real-time view of all interview attempts and scores.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="flex flex-col h-[600px] overflow-y-auto bg-slate-50/20 dark:bg-transparent">
              {sessions?.map((session, index) => (
                <div key={session.id} className={`flex flex-col gap-3 p-5 ${index !== 0 ? 'border-t' : ''} hover:bg-white dark:hover:bg-slate-900/40 transition-colors`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{session.profiles?.full_name || "Unknown"}</span>
                        <span className="text-xs text-muted-foreground">({session.profiles?.email})</span>
                      </div>
                      <div className="text-sm font-medium text-violet-600 dark:text-violet-400 mt-1">
                        {session.interviews?.title || "Untitled Interview"}
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
                        ${session.status === 'completed' || session.session_status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 
                          session.session_status === 'terminated' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'}`}>
                        {session.session_status === 'terminated' ? 'Terminated' : session.status}
                      </span>
                      <div className="text-xs text-muted-foreground mt-2 font-mono">
                        {new Date(session.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Detailed Scores */}
                  {(session.status === 'completed' || session.session_status === 'completed') && (
                    <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2">
                      <div className="bg-slate-100 dark:bg-slate-900/80 p-2.5 rounded-lg border border-border/50 text-center">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Overall</div>
                        <div className="font-extrabold text-lg text-primary">{session.overall_score || 0}%</div>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-900/80 p-2.5 rounded-lg border border-border/50 text-center">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Knowledge</div>
                        <div className="font-bold text-sm mt-1">{session.knowledge_score || 0}%</div>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-900/80 p-2.5 rounded-lg border border-border/50 text-center">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Comm.</div>
                        <div className="font-bold text-sm mt-1">{session.communication_score || 0}%</div>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-900/80 p-2.5 rounded-lg border border-border/50 text-center">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Tech</div>
                        <div className="font-bold text-sm mt-1">{session.technical_depth_score || 0}%</div>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-900/80 p-2.5 rounded-lg border border-border/50 text-center">
                        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Confidence</div>
                        <div className="font-bold text-sm mt-1">{session.confidence_score || 0}%</div>
                      </div>
                    </div>
                  )}

                  {/* Violation Warning */}
                  {session.session_status === 'terminated' && (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-center gap-2 font-medium">
                      <ShieldCheck className="h-4 w-4" />
                      Policy Violation: {session.failure_reason || "Unknown rule broken"}
                    </div>
                  )}
                  
                  {/* Actions */}
                  <div className="mt-2 pt-2 flex justify-between items-center">
                    <DeleteSessionButton sessionId={session.id} />
                    <a href={`/admin/sessions/${session.id}`} className="text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded transition-colors flex items-center gap-1">
                      View Deep Analysis &rarr;
                    </a>
                  </div>
                </div>
              ))}
              {sessions?.length === 0 && (
                <div className="text-center text-muted-foreground p-10 flex flex-col items-center">
                  <Activity className="h-8 w-8 mb-2 opacity-20" />
                  No interview sessions recorded yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
