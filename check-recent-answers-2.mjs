import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRecentAnswers() {
  const { data: answers, error } = await supabase
    .from('interview_answers')
    .select('id, session_id, transcript, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) {
     console.error(error);
     return;
  }
  
  console.log("Recent Answers:");
  answers.forEach(a => {
     console.log(`- [${a.created_at}] Session: ${a.session_id} | Transcript Length: ${a.transcript?.length || 0} | Text: "${a.transcript}"`);
  });
}

checkRecentAnswers();
