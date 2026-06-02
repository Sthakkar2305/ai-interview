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

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>

              <p className="text-sm text-muted-foreground text-center mt-4">
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
