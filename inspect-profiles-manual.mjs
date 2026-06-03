import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectProfiles() {
  const { data: profiles } = await supabase.from('profiles').select('*');
  const { data: sessions } = await supabase.from('interview_sessions').select('*');
  
  let unknownCount = 0;
  for (const s of (sessions || [])) {
    const profile = profiles.find(p => p.id === s.user_id);
    if (!profile) {
      console.log("No profile for session user_id:", s.user_id);
      console.log("Session ID:", s.id, "Started at:", s.created_at);
      
      const { data: { user } } = await supabase.auth.admin.getUserById(s.user_id);
      if (user) {
         console.log("Found in auth.users:", user.email, "Metadata:", user.user_metadata);
      } else {
         console.log("NOT found in auth.users!");
      }
      unknownCount++;
    }
  }
  console.log(`Total unknown profiles: ${unknownCount}`);
}

inspectProfiles();
