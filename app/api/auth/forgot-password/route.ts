import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import nodemailer from "nodemailer"

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 })
    }

    const cookieStore = await cookies()
    // Use the service role key to bypass RLS and generate an admin link
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

    // Get the origin of the current request to build the correct redirect URL
    const origin = request.headers.get("origin") || "http://localhost:3000"
    const redirectTo = `${origin}/auth/update-password`

    // Generate the recovery link (this bypasses Supabase's internal SMTP server)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email.trim().toLowerCase(),
      options: {
        redirectTo: redirectTo
      }
    })

    if (linkError) {
      console.error("Failed to generate recovery link:", linkError)
      return Response.json({ error: linkError.message }, { status: 400 })
    }

    const recoveryUrl = linkData.properties.action_link

    // Send the email manually using Nodemailer
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: "techgaravi1@gmail.com",
        pass: process.env.SMTP_PASSWORD || "INSERT_APP_PASSWORD_HERE",
      },
    })

    await transporter.sendMail({
      from: '"AI Interview Platform" <techgaravi1@gmail.com>',
      to: email,
      subject: "Reset Your Password",
      html: `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 0; margin: 0; }
  .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; }
  .header { background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%); padding: 30px 40px; text-align: center; }
  .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
  .content { padding: 40px; text-align: center; }
  .content p { color: #374151; font-size: 16px; line-height: 24px; margin-bottom: 24px; }
  .button { display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; margin: 10px 0; }
  .footer { background-color: #f3f4f6; padding: 24px 40px; text-align: center; font-size: 12px; color: #6b7280; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>AI Interview Platform</h1>
    </div>
    <div class="content">
      <h2 style="color: #111827; margin-top: 0; font-size: 22px;">Password Reset Request</h2>
      <p style="text-align: left;">Hello,</p>
      <p style="text-align: left;">We received a request to reset your password for the AI Interview Platform. To choose a new password and regain access to your account, please click the button below.</p>
      
      <a href="${recoveryUrl}" class="button">Reset Password</a>
      
      <p style="font-size: 14px; color: #dc2626; margin-top: 24px; font-weight: 600;">This secure link will expire in exactly 5 minutes.</p>
    </div>
    <div class="footer">
      <p>If you did not request this password reset, you can safely ignore this email.</p>
      <p>&copy; 2026 AI Interview Platform. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
      `,
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error("Forgot password API error:", error)
    return Response.json({ error: "Failed to process password reset request" }, { status: 500 })
  }
}
