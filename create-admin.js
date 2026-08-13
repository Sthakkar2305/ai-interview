import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function createSuperAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'sthakkar8370@gmail.com'
  const adminPassword = process.env.ADMIN_PASSWORD
  
  if (!adminPassword) {
    console.error("ADMIN_PASSWORD environment variable is not defined in .env!")
    return
  }

  console.log("Creating Super Admin account...")
  
  const { data, error } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true, // Auto-confirms the email so no verification link is needed
    user_metadata: { full_name: 'Super Admin' }
  })

  if (error) {
    if (error.message.includes('already been registered')) {
      console.log("User already exists. Updating password and confirming email just in case...")
      const { data: users } = await supabase.auth.admin.listUsers()
      const user = users.users.find(u => u.email === adminEmail)
      if (user) {
        await supabase.auth.admin.updateUserById(user.id, { password: adminPassword, email_confirm: true })
        console.log("Password reset to the configured ADMIN_PASSWORD and email confirmed!")
      }
    } else {
      console.error("Failed to create user:", error)
    }
  } else {
    console.log("Super Admin created successfully!")
    
    // Also ensure profile exists
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email: adminEmail,
      full_name: 'Super Admin'
    }, { onConflict: 'id' })
    console.log("Profile created!")
  }
}

createSuperAdmin()
