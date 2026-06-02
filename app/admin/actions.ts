"use server"

import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const verifyAdminAndGetClient = async () => {
  const cookieStore = await cookies()
  
  // 1. Verify the current authenticated user via standard SSR client
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {}
      }
    }
  )

  const { data: { user } } = await authClient.auth.getUser()
  if (!user || user.email !== "sthakkar8370@gmail.com") {
    throw new Error("Unauthorized: Only the Super Admin can perform this action.")
  }

  // 2. Return a pure Service Role client to bypass RLS for the deletion
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function deleteUserAction(userId: string) {
  try {
    const adminClient = await verifyAdminAndGetClient()
    
    // Deleting from auth.users automatically cascades to public.profiles 
    // and all their related interview_sessions if the DB is set up correctly.
    const { error } = await adminClient.auth.admin.deleteUser(userId)
    
    if (error) throw error
    return { success: true }
  } catch (err: any) {
    console.error("Delete user failed:", err)
    return { success: false, error: err.message || "Failed to delete user" }
  }
}

export async function deleteSessionAction(sessionId: string) {
  try {
    const adminClient = await verifyAdminAndGetClient()
    
    const { error } = await adminClient.from("interview_sessions").delete().eq("id", sessionId)
    
    if (error) throw error
    return { success: true }
  } catch (err: any) {
    console.error("Delete session failed:", err)
    return { success: false, error: err.message || "Failed to delete session" }
  }
}

export async function approveCompanyAction(userId: string) {
  try {
    const adminClient = await verifyAdminAndGetClient()
    
    // Fetch the user first to get their existing metadata
    const { data: { user }, error: fetchError } = await adminClient.auth.admin.getUserById(userId)
    if (fetchError || !user) throw fetchError || new Error("User not found")
      
    const newMetadata = { ...user.user_metadata, status: 'approved' }

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
      user_metadata: newMetadata
    })
    
    if (error) throw error
    return { success: true }
  } catch (err: any) {
    console.error("Approve company failed:", err)
    return { success: false, error: err.message || "Failed to approve company" }
  }
}
