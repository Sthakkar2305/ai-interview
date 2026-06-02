import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function sync() {
  console.log("Starting user sync...")
  
  // 1. Fetch all auth users (admin requires service role)
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) {
    console.error("Failed to fetch auth users:", error)
    return
  }
  
  const users = data.users
  console.log(`Found ${users.length} users in auth.users`)
  
  // 2. Upsert into profiles
  let count = 0
  for (const user of users) {
    const { error: insertError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || user.email.split('@')[0]
    }, { onConflict: 'id' })
    
    if (insertError) {
      console.error(`Error inserting ${user.email}:`, insertError)
    } else {
      console.log(`Synced: ${user.email}`)
      count++
    }
  }
  
  console.log(`Successfully synced ${count} out of ${users.length} users into public.profiles!`)
}

sync()
