import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function testQuery() {
  const { data, error } = await supabase
    .from("interview_sessions")
    .select(`
      *,
      profiles ( email, full_name ),
      interviews ( title )
    `)
    
  if (error) {
    console.error("Query Error:", error)
  } else {
    console.log("Sessions Count:", data?.length)
    console.log("Data:", JSON.stringify(data, null, 2))
  }
}

testQuery()
