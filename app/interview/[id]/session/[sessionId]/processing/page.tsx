"use client"

import { useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function ProcessingPage() {
  const router = useRouter()
  const params = useParams()
  const { user, loading: authLoading } = useAuth()

  const interviewId = params.id as string
  const sessionId = params.sessionId as string

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/auth/login")
      return
    }

    // Simulate processing delay
    const timer = setTimeout(() => {
      router.push(`/interview/${interviewId}/session/${sessionId}/results`)
    }, 3000)

    return () => clearTimeout(timer)
  }, [user, authLoading, router, interviewId, sessionId])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Evaluating Your Interview
          </CardTitle>
          <CardDescription>Our AI is analyzing your responses and generating personalized feedback</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">Transcribing audio responses...</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Evaluating content quality...</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <div className="h-2 w-2 rounded-full bg-muted-foreground" />
              <span className="text-sm text-muted-foreground">Generating feedback report...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
