import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAnswers() {
  const sessionId = "d8211f3e-8ea7-4968-9c5e-47c4e9cdd6e8"; // Doi Mohmad noor
  
  const { data: answers, error } = await supabase.from('interview_answers').select('*').eq('session_id', sessionId);
  console.log(`Found ${answers?.length} answers for session ${sessionId}`);
  
  if (answers && answers.length > 0) {
      console.log("Answers:", answers.map(a => a.transcript));
  } else {
      console.log("Error:", error);
  }
}

checkAnswers();
