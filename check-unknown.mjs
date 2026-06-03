import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkUnknownSessions() {
  const { data: sessions, error } = await supabase
    .from('interview_sessions')
    .select('id, user_id, status, session_status, created_at, profiles(id, email, full_name)')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
    console.error(error);
    return;
  }
  
  for (const session of sessions) {
    if (!session.profiles) {
      console.log("UNKNOWN SESSION FOUND:", JSON.stringify(session, null, 2));
      // Check if user exists in auth.users
      const { data: { user } } = await supabase.auth.admin.getUserById(session.user_id);
      if (user) {
        console.log("Auth user exists for this session:", user.email);
      } else {
        console.log("Auth user DOES NOT EXIST for this user_id:", session.user_id);
      }
    }
  }
}

checkUnknownSessions();
