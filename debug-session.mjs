import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSession() {
  const email = "candidate_d46xlz0wkv@temp.ai-interviews.com";
  
  const { data: profile } = await supabase.from('profiles').select('*').eq('email', email).single();
  
  const { data: sessions } = await supabase.from('interview_sessions').select('*').eq('user_id', profile.id);

  if (sessions && sessions.length > 0) {
    const sessionId = sessions[0].id;
    // 3. Get responses
    const { data: responses, error } = await supabase.from('interview_responses').select('*').eq('session_id', sessionId);
    if (error) {
       console.error("Error fetching responses:", error);
       return;
    }
    console.log(`Found ${responses.length} responses for session ${sessionId}`);
    
    // We can also check if there are any questions for this session
    const { data: questions, error: qErr } = await supabase.from('interview_questions').select('*').eq('session_id', sessionId);
    if (qErr) {
       console.error("Error fetching questions:", qErr);
    } else {
       console.log(`Found ${questions.length} questions for session ${sessionId}`);
       console.log(JSON.stringify(questions, null, 2));
    }

    if (responses.length > 0) {
       console.log(JSON.stringify(responses, null, 2));
    }
  }
}

checkSession();
