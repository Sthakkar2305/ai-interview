import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkData() {
  const { data, error } = await supabase
    .from("interviews")
    .select('user_id, title, description')
    .eq('title', 'Job Interview ')

  console.log("Error:", error?.message || "No error");
  console.log("Interviews:", data);
  
  if (data?.length) {
    const { data: profiles } = await supabase.from('profiles').select('*').in('id', data.map(d => d.user_id));
    console.log("Profiles:", profiles);
  }
}

checkData();
