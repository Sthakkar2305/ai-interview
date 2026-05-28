"use client"

import { useAuth } from "@/lib/auth-context"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function Home() {
  const { user, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted">
        <div className="flex flex-col items-center justify-center min-h-screen px-4">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold text-primary">AI Interview</h1>
              <h1 className="text-4xl font-bold text-foreground">Platform</h1>
              <p className="text-muted-foreground text-lg">Professional AI-powered video interviews</p>
            </div>

            <Card className="border-primary/20">
              <CardHeader className="space-y-1">
                <CardTitle>Get Started</CardTitle>
                <CardDescription>Sign in or create an account to begin your interview</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Link href="/auth/login" className="w-full">
                  <Button className="w-full" size="lg">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/signup" className="w-full">
                  <Button variant="outline" className="w-full bg-transparent" size="lg">
                    Create Account
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 pt-4">
              <Card className="border-secondary/20">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <div className="text-2xl">📄</div>
                    <div>
                      <p className="font-semibold">Upload Content</p>
                      <p className="text-sm text-muted-foreground">Share PDF or Word documents</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-secondary/20">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <div className="text-2xl">🎥</div>
                    <div>
                      <p className="font-semibold">Live Interview</p>
                      <p className="text-sm text-muted-foreground">Answer AI-generated questions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-secondary/20">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <div className="text-2xl">📊</div>
                    <div>
                      <p className="font-semibold">Get Feedback</p>
                      <p className="text-sm text-muted-foreground">Receive detailed evaluation and scores</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">AI Interview Platform</h1>
          <Button variant="ghost" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Welcome back, {user.email}</h2>
            <p className="text-muted-foreground">Start a new interview or review your previous sessions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link href="/interview/new" className="no-underline">
              <Card className="cursor-pointer hover:border-primary/50 transition-colors h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">➕</span>
                    New Interview
                  </CardTitle>
                  <CardDescription>Upload a document and start a new interview session</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full">Start New Interview</Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard" className="no-underline">
              <Card className="cursor-pointer hover:border-primary/50 transition-colors h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">📊</span>
                    My Interviews
                  </CardTitle>
                  <CardDescription>View past interviews and detailed feedback reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full bg-transparent">
                    View Dashboard
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
