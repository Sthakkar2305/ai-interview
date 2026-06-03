import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').limit(5);
  console.log(data);
  
  // Find sessions without a profile
  const { data: sessions } = await supabase
    .from('interview_sessions')
    .select('id, user_id, profiles(id)');
    
  let unknownCount = 0;
  for (const s of (sessions || [])) {
    if (!s.profiles) {
      console.log("No profile for session user_id:", s.user_id);
      unknownCount++;
    }
  }
  console.log(`Total unknown profiles: ${unknownCount}`);
}

inspectProfiles();
