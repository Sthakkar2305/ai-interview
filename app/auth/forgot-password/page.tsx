"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase-client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft, MailCheck } from "lucide-react"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const supabase = getSupabaseClient()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (!email) {
        setError("Please enter your email address")
        setLoading(false)
        return
      }

      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to send reset email. Please try again.")
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-primary/20 text-center py-6">
          <CardHeader className="space-y-4">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <MailCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription>
              We've sent a password reset link to <span className="font-bold">{email}</span>. Click the link to update your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/auth/login")} className="w-full">
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>Enter your email and we'll send you a link to reset your password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="smit@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Sending link..." : "Send Reset Link"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <Link href="/auth/login" className="text-muted-foreground hover:text-primary inline-flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" /> Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
