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
import { Loader2 } from "lucide-react"

export default function SignupPage() {
  const router = useRouter()
  const supabase = getSupabaseClient()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [emailSent, setEmailSent] = useState(false)
  const [role, setRole] = useState("candidate")
  const [companyPending, setCompanyPending] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    setError("")
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setGoogleLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/`,
          data: {
            full_name: fullName,
            role: role,
            status: role === 'company' ? 'pending' : 'approved'
          }
        },
      })

      if (signupError) {
        setError(signupError.message)
        return
      }

      // Create profile record in the database
      if (signupData?.user?.id) {
        try {
          await fetch("/api/auth/create-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: signupData.user.id,
              email,
              fullName,
              role: role,
            }),
          })
        } catch (profileErr) {
          console.error("Failed to create profile:", profileErr)
        }
      }

      // Check if Supabase requires email verification (identities might be empty if unverified)
      if (signupData?.user?.identities?.length === 0 || !signupData.session) {
        if (role === 'company') {
          setCompanyPending(true)
        } else {
          setEmailSent(true)
        }
      } else {
        router.push("/")
        router.refresh()
      }
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-primary/20">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">
            {companyPending ? "Under Review" : emailSent ? "Check your email" : "Create Account"}
          </CardTitle>
          <CardDescription>
            {companyPending
              ? "Team is reviewing your profile."
              : emailSent 
                ? "We've sent an official verification link to your email."
                : "Join the AI Interview Platform to begin your assessment"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {companyPending ? (
            <div className="space-y-6">
              <div className="bg-primary/10 text-primary p-4 rounded-lg text-sm font-medium flex items-start gap-3">
                <span>
                  Team is reviewing your profile. It will take 1-2 working days to confirm your ID. You will get an email once confirmed.
                </span>
              </div>
              <Button className="w-full" onClick={() => router.push("/auth/login")} variant="outline">
                Return to Login
              </Button>
            </div>
          ) : emailSent ? (
            <div className="space-y-6">
              <div className="bg-primary/10 text-primary p-4 rounded-lg text-sm font-medium flex items-start gap-3">
                <span>
                  Please check your inbox at <strong>{email}</strong> for an email from <strong>no.reply.ai.interviews@gmail.com</strong>.
                  Click the secure link to verify your identity. The link expires in 5 minutes.
                </span>
              </div>
              <Button className="w-full" onClick={() => router.push("/auth/login")} variant="outline">
                Return to Login
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSignup} className="space-y-4">
                {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">{error}</div>}

                <div className="space-y-2 pb-2">
                  <Label>I am a:</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900 border p-3 rounded-lg flex-1">
                      <input 
                        type="radio" 
                        name="role" 
                        value="candidate" 
                        checked={role === "candidate"} 
                        onChange={() => setRole("candidate")}
                        className="accent-primary"
                      />
                      <span className="text-sm font-medium">Candidate</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-900 border p-3 rounded-lg flex-1">
                      <input 
                        type="radio" 
                        name="role" 
                        value="company" 
                        checked={role === "company"} 
                        onChange={() => setRole("company")}
                        className="accent-primary"
                      />
                      <span className="text-sm font-medium">Company</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                type="button" 
                className="w-full" 
                onClick={handleGoogleLogin}
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                Google
              </Button>

              <p className="text-sm text-muted-foreground text-center mt-6">
                Already have an account?{" "}
                <Link href="/auth/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
