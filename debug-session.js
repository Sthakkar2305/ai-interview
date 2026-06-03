import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSession() {
  const email = "candidate_d46xlz0wkv@temp.ai-interviews.com";
  
  // 1. Get user id from profiles
  const { data: profile } = await supabase.from('profiles').select('*').eq('email', email).single();
  if (!profile) {
    console.log("Profile not found for " + email);
    return;
  }
  
  // 2. Get session
  const { data: sessions } = await supabase.from('interview_sessions').select('*').eq('user_id', profile.id);
  console.log("Sessions:", JSON.stringify(sessions, null, 2));

  if (sessions && sessions.length > 0) {
    const sessionId = sessions[0].id;
    // 3. Get responses
    const { data: responses } = await supabase.from('interview_responses').select('*').eq('session_id', sessionId);
    console.log(`Found ${responses.length} responses for session ${sessionId}`);
    console.log(JSON.stringify(responses, null, 2));
  }
}

checkSession();
