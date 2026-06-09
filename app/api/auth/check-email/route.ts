import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 })
    }

    const cookieStore = await cookies()
    // Use the service role key to bypass RLS and securely check the profiles table
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    })

    // Check if the email already exists in the profiles table
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("email", email.trim().toLowerCase())
      .single()

    // If data exists, the email is already registered
    if (data) {
      return Response.json({ exists: true })
    }

    return Response.json({ exists: false })
  } catch (error) {
    // If .single() finds no rows, it throws an error. This means the email does not exist.
    return Response.json({ exists: false })
  }
}
