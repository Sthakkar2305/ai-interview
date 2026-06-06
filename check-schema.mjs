import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
  const { data, error } = await supabase
    .rpc('get_schema_info'); // if this RPC doesn't exist, we just query tables
    
  // Alternatively, just query one row from interviews
  const { data: interview } = await supabase.from('interviews').select('*').limit(1);
  console.log("Interview keys:", interview && interview.length ? Object.keys(interview[0]) : "No interviews");
  
  const { data: session } = await supabase.from('interview_sessions').select('*').limit(1);
  console.log("Session keys:", session && session.length ? Object.keys(session[0]) : "No sessions");
}

checkSchema();
