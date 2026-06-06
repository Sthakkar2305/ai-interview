import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testQuery() {
  const { data, error } = await supabase
    .from("scheduled_interviews")
    .select(`
      id,
      title,
      role,
      status,
      scheduled_at,
      access_token,
      candidate_id,
      profiles ( full_name )
    `)
    .limit(1)

  console.log("Error:", error?.message || "No error");
  console.log("Data:", data);
}

testQuery();
