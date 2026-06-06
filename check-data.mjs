import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
  const { data, error } = await supabase
    .from("scheduled_interviews")
    .select('*')

  console.log("Error:", error?.message || "No error");
  console.log("Data length:", data?.length);
  if (data?.length) {
    console.log("Sample:", data[0]);
  }
}

checkData();
