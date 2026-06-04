import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkLatestAnswers() {
  const { data: sessions, error: sessionError } = await supabase
    .from('interview_sessions')
    .select('id, user_id, status, overall_score')
    .order('created_at', { ascending: false })
    .limit(3);
    
  if (sessionError) {
    console.error(sessionError);
    return;
  }
  
  for (const session of sessions) {
    console.log(`\nSession: ${session.id} | Score: ${session.overall_score}`);
    
    const { data: answers, error: answerError } = await supabase
      .from('interview_answers')
      .select('transcript, confidence_rating, question_id, created_at')
      .eq('session_id', session.id)
      .order('created_at', { ascending: false });
      
    if (answers && answers.length > 0) {
      answers.forEach(a => {
        console.log(` - Transcript (${a.transcript?.length || 0} chars): "${a.transcript}"`);
      });
    } else {
      console.log(" - No answers found in DB.");
    }
  }
}

checkLatestAnswers();
