import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("id")

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session ID" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
    )

    const { data: sessionData, error } = await supabase
      .from("interview_sessions")
      .select("processing_status, status")
      .eq("id", sessionId)
      .single()

    if (error || !sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    // Default to 'pending' if it hasn't been set yet
    const processingStatus = sessionData.processing_status || "pending"

    return NextResponse.json({ 
      success: true, 
      processing_status: processingStatus,
      status: sessionData.status
    })

  } catch (error) {
    console.error("Status Check Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
