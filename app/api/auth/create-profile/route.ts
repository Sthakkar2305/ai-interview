import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import nodemailer from "nodemailer"

export async function POST(request: Request) {
  try {
    const { userId, email, fullName, role } = await request.json()

    const cookieStore = await cookies()
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

    const isCompany = role === "company"
    const status = isCompany ? "pending" : "approved"

    const { error } = await supabase.from("profiles").insert({
      id: userId,
      email,
      full_name: fullName,
    })

    if (error) {
      console.error("[v0] Profile creation error:", error)
      return Response.json({ error: error.message }, { status: 400 })
    }

    if (isCompany) {
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: "no.reply.ai.interviews@gmail.com",
            pass: process.env.SMTP_PASSWORD || "INSERT_APP_PASSWORD_HERE",
          },
        })

        await transporter.sendMail({
          from: '"AI Interview System" <no.reply.ai.interviews@gmail.com>',
          to: "no.reply.ai.interviews@gmail.com", // Sent to admin
          subject: `Action Required: New Company Registration (${fullName})`,
          html: `
            <h2>New Company Registration Requires Approval</h2>
            <p><strong>Name:</strong> ${fullName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p>Please log in to the Super Admin panel to review and approve this company.</p>
          `,
        })
      } catch (emailError) {
        console.error("Failed to send admin notification email:", emailError)
        // We don't fail the profile creation if email fails
      }
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error("[v0] Profile creation error:", error)
    return Response.json({ error: "Failed to create profile" }, { status: 500 })
  }
}
