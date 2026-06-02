"use client"

import { useAuth } from "@/lib/auth-context"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Loader2, 
  Sparkles, 
  ArrowRight, 
  ShieldCheck, 
  UploadCloud, 
  Video, 
  BarChart3, 
  LogOut, 
  ArrowUpRight, 
  GraduationCap, 
  CheckCircle,
  Briefcase,
  History,
  Settings,
  Target
} from "lucide-react"

import logo from "../public/icon.png"

export default function Home() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground mt-3 animate-pulse">Initializing platform...</p>
      </div>
    )
  }

  // Unauthenticated State - Spectacular Premium Landing Page
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0c0f1d] text-foreground relative overflow-hidden flex flex-col">
        {/* Modern 3D Mesh Blur Backgrounds */}
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-violet-600/10 to-indigo-600/10 rounded-full blur-3xl -z-10 animate-pulse duration-[8000ms]" />
        <div className="absolute bottom-10 right-1/4 w-[600px] h-[600px] bg-gradient-to-br from-blue-600/10 to-purple-600/10 rounded-full blur-3xl -z-10 animate-pulse duration-[10000ms]" />

        {/* Premium Sticky Navigation */}
        <nav className="border-b border-border/40 sticky top-0 bg-slate-50/75 dark:bg-[#0c0f1d]/75 backdrop-blur-md z-50">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src={logo.src} alt="Logo" className="h-18 w-18 rounded-lg" /> 
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text">
                AI Interview <span className="text-violet-600 dark:text-violet-400">Platform</span>
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <Link href="/auth/login">
                <Button variant="ghost" className="font-semibold hover:bg-slate-100 dark:hover:bg-slate-800/50">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/signup">
                <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-indigo-600/20">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Hero & Authentication Splitting */}
        <main className="flex-1 max-w-7xl mx-auto px-6 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center z-10">
          {/* Left Column: Platform Showcase */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-300 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" /> Next-Generation AI Assessments
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-foreground">
              Supercharge Your <br />
              <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 dark:from-violet-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                Interview Performance
              </span>
            </h1>

            <p className="text-muted-foreground text-lg md:text-xl max-w-2xl leading-relaxed">
              Ace your next job interview using our advanced generative AI simulator. Get realistic questions, full video/audio proctoring, and comprehensive grading reports.
            </p>

            {/* Feature Highlights with Modern Icons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Custom Role Parsing</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">Upload a resume or job description to tailor questions dynamically.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg">
                  <Video className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Live Simulation</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">Interactive webcam and voice simulator with strict proctoring feedback.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-lg">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Comprehensive Feedback</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">Instant scoring dashboards identifying key strengths and mistakes.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-lg">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Anti-Cheating Guard</h4>
                  <p className="text-sm text-muted-foreground mt-0.5">Proctoring engine protecting assessment integrity automatically.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sleek Authentication CTA Card */}
          <div className="lg:col-span-5 flex justify-center">
            <Card className="w-full max-w-md border-primary/10 shadow-2xl backdrop-blur-md bg-white/80 dark:bg-[#12162a]/90 relative overflow-hidden rounded-2xl">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-purple-500" />
              <CardHeader className="text-center pt-8 pb-4">
                <CardTitle className="text-2xl font-bold">Secure Gate</CardTitle>
                <CardDescription>Join or sign in to begin your assessment immediately.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2 pb-8">
                <Link href="/auth/login" className="block w-full">
                  <Button className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold text-md shadow-lg shadow-indigo-600/15 group">
                    Sign In to Account
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Link href="/auth/signup" className="block w-full">
                  <Button variant="outline" className="w-full h-12 border-violet-500/20 hover:border-violet-500/40 bg-transparent text-foreground hover:bg-slate-50 dark:hover:bg-slate-800/30 text-md font-semibold">
                    Create New Account
                  </Button>
                </Link>

                <div className="border-t border-border/40 my-6 pt-6 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" /> 100% Secure
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" /> Proctoring Enabled
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-yellow-500" /> AI Powered
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        {/* Small Professional Footer */}
        <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground z-10 bg-slate-50/50 dark:bg-[#0c0f1d]/50">
          <p>© {new Date().getFullYear()} AI Interview Platform. All rights reserved. Powered by state-of-the-art Generative AI.</p>
          <div className="mt-2 flex justify-center gap-4">
            <Link href="/terms" className="hover:underline hover:text-foreground transition-colors">Terms & Conditions</Link>
            <Link href="/privacy" className="hover:underline hover:text-foreground transition-colors">Privacy Policy</Link>
          </div>
        </footer>
      </div>
    )
  }

  // Authenticated State - Luxury Recruiter / Candidate Launchpad
  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090b14] text-foreground flex flex-col relative overflow-hidden">
      {/* Dynamic glow mesh backdrops */}
      <div className="absolute top-0 right-10 w-[400px] h-[400px] bg-primary/5 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl -z-10" />

      {/* Modern Authenticated Navigation */}
      <nav className="border-b border-border/40 bg-white/70 dark:bg-[#0d0f19]/75 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl text-white shadow-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              AI Interview <span className="text-violet-600 dark:text-violet-400">Platform</span>
            </span>
          </div>

          <Button 
            variant="ghost" 
            onClick={handleSignOut} 
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-2 font-semibold"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </nav>

      {/* Workspace Hub */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-12 lg:py-16 w-full z-10 space-y-12">
        
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/40">
          <div>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight">
              Welcome back, <span className="bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 bg-clip-text text-transparent">{user.user_metadata?.full_name || user.email}</span> 👋
            </h1>
            <p className="text-muted-foreground text-sm lg:text-base mt-1.5">
              Launch a new mock interview session, manage schedules, or review your historical evaluations.
            </p>
          </div>
          
          <div className="flex gap-3">
            <Button onClick={() => router.push("/dashboard")} variant="outline" className="font-semibold h-11 px-5 border-border">
              Go to Dashboard
            </Button>
          </div>
        </div>

        {/* Action Panel Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Action A: Create / Start New Mock Interview */}
          {(!user.user_metadata?.role || user.user_metadata?.role === 'candidate') && (
            <div 
              onClick={() => router.push("/interview/new")} 
              className="group cursor-pointer bg-white dark:bg-[#111425] border border-border/40 hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-600/5 transition-all duration-300 rounded-2xl p-8 flex flex-col relative overflow-hidden md:col-span-2 lg:col-span-1"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-violet-600/10 to-indigo-600/10 rounded-full blur-xl group-hover:scale-125 transition-transform" />
            
            <div className="p-4 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-2xl w-fit mb-6 transition-transform group-hover:scale-110">
              <GraduationCap className="h-7 w-7" />
            </div>

            <div className="space-y-2 flex-1">
              <h3 className="text-xl font-bold flex items-center gap-2 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                Practice New Interview
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1.5" />
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Configure your mock interview immediately. Upload a resume, specify job titles, select question count and difficulty to test your skills in real-time.
              </p>
            </div>
            
            <div className="mt-8">
              <Button className="w-full h-11 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold shadow-md">
                Configure & Start
              </Button>
            </div>
            </div>
          )}

          {/* Action B: Recruiter Schedulers */}
          {user.user_metadata?.role === 'company' && (
            <div 
              onClick={() => router.push("/dashboard/schedule")} 
              className="group cursor-pointer bg-white dark:bg-[#111425] border border-border/40 hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-600/5 transition-all duration-300 rounded-2xl p-8 flex flex-col relative overflow-hidden md:col-span-2 lg:col-span-1"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-600/10 to-blue-600/10 rounded-full blur-xl group-hover:scale-125 transition-transform" />

            <div className="p-4 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl w-fit mb-6 transition-transform group-hover:scale-110">
              <Briefcase className="h-7 w-7" />
            </div>

            <div className="space-y-2 flex-1">
              <h3 className="text-xl font-bold flex items-center gap-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Schedule Candidate Interview
                <ArrowUpRight className="h-5 w-5 transition-transform group-hover:translate-y-[-2px] group-hover:translate-x-[2px]" />
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Generate secure session tokens for candidates. Set strict proctoring guidelines, configure standard templates, and track candidate submissions.
              </p>
            </div>

            <div className="mt-8">
              <Button variant="outline" className="w-full h-11 border-indigo-500/20 hover:border-indigo-500/40 bg-transparent font-semibold">
                Open Schedule Portal
              </Button>
            </div>
            </div>
          )}

        </div>

        {/* Dashboard History Quicklink Section */}
        <div 
          onClick={() => router.push("/dashboard")}
          className="group cursor-pointer bg-gradient-to-r from-slate-100 to-slate-50 dark:from-[#0f1220] dark:to-[#0b0d17] border border-border/40 hover:border-primary/40 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 transition-all duration-300"
        >
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="p-3 bg-primary/10 text-primary rounded-xl transition-transform group-hover:scale-110">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-foreground">Review Performance History</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Explore detailed scoring graphs, view transcript timelines, and improve mistakes.</p>
            </div>
          </div>
          <Button variant="ghost" className="font-semibold text-primary hover:bg-primary/5 gap-1 group-hover:translate-x-1 transition-transform">
            View History <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

      </main>
      
      {/* Footer */}
      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground bg-white/40 dark:bg-black/10">
        <p>© {new Date().getFullYear()} AI Interview Platform. All rights reserved. Powered by state-of-the-art Generative AI.</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link href="/terms" className="hover:underline hover:text-foreground transition-colors">Terms & Conditions</Link>
          <Link href="/privacy" className="hover:underline hover:text-foreground transition-colors">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  )
}
