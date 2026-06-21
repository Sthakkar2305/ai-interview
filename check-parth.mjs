import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkParth() {
  const { data: profiles, error: pError } = await supabase
    .from("profiles")
    .select('*')
    .ilike('full_name', '%parth%patel%');
    
  if (pError) {
    console.error("Profile Error:", pError);
    return;
  }
  
  console.log("Profiles found:", profiles);
  
  if (profiles && profiles.length > 0) {
    for (const profile of profiles) {
      const { data: sessions, error: sError } = await supabase
        .from("interview_sessions")
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
        
      if (sError) {
        console.error("Session Error for user:", profile.id, sError);
      } else {
        console.log(`Sessions for ${profile.full_name}:`, sessions);
      }
    }
  }
}

checkParth();
