"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function verifyAndCreateAnonymousCandidate(interviewId: string, token: string, fullName: string) {
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          return []
        },
      },
    })

    // 1. Verify credentials against scheduled_interviews
    const { data: interviewData, error: interviewError } = await supabase
      .from("scheduled_interviews")
      .select("*")
      .eq("id", interviewId)
      .eq("access_token", token)
      .single()

    if (interviewError || !interviewData) {
      return { error: "Invalid Interview ID or Access Token" }
    }

    if (interviewData.status !== 'scheduled') {
      return { error: "This interview token has already been used by a candidate." }
    }

    const now = new Date()
    if (new Date(interviewData.expires_at) < now) {
      return { error: "This interview session has expired." }
    }

    // 2. Generate temporary credentials
    const randomSuffix = Math.random().toString(36).substring(2, 12)
    const dummyEmail = `candidate_${randomSuffix}@temp.ai-interviews.com`
    const dummyPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10) + "A1!"

    // 3. Create the temporary user in auth.users using the Admin API
    const { data: userData, error: createError } = await supabase.auth.admin.createUser({
      email: dummyEmail,
      password: dummyPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "candidate",
        is_anonymous: true
      }
    })

    if (createError) {
      console.error("[v0] Temp user creation error:", createError)
      return { error: "Failed to initialize interview session." }
    }

    // Wait, the profile creation trigger might fail if the profile is not created by the DB trigger.
    // If the DB trigger handles profile creation for auth.users, we don't need to do it here. 
    // We already have a profile trigger? Let's assume we do or we can just insert it.
    // Wait, our signup page manually created the profile via an API route! We should manually create it here just in case.
    
    await supabase.from("profiles").insert({
      id: userData.user.id,
      email: dummyEmail,
      full_name: fullName
    }).select().single()

    // Return the credentials so the client can log in
    return { 
      success: true,
      email: dummyEmail, 
      password: dummyPassword,
      interviewData: {
        title: interviewData.title,
        role: interviewData.role,
        interview_type: interviewData.interview_type,
        manual_qa: interviewData.manual_qa,
        passing_marks: interviewData.passing_marks,
        question_categories: interviewData.question_categories,
        question_count: interviewData.question_count
      }
    }
  } catch (err: any) {
    console.error("[v0] Verification error:", err)
    return { error: "An unexpected error occurred." }
  }
}
