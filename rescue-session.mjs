import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function rescueSession() {
  const sessionId = "2ff938a9-66ab-44b8-9496-58ef2e12039f";
  
  // 1. Check answers
  const { data: answers, error } = await supabase.from('interview_answers').select('*').eq('session_id', sessionId);
  console.log(`Found ${answers?.length} answers for session ${sessionId}`);
  
  if (error) {
     console.error("Error:", error);
     return;
  }
  
  if (answers && answers.length > 0) {
      // 2. Set to pending
      console.log("Setting to completed + pending processing...");
      await supabase.from("interview_sessions").update({
        processing_status: "pending",
        status: "completed"
      }).eq("id", sessionId);
      
      console.log("Triggering worker...");
      const res = await fetch(`https://ai-interview-xi-eight.vercel.app/api/worker`, { method: "POST" });
      console.log("Worker response:", res.status);
      console.log("Successfully queued for background evaluation on Vercel.");
  } else {
      console.log("No answers found. Setting to zero score.");
      await supabase.from("interview_sessions").update({
        overall_score: 0,
        knowledge_score: 0,
        communication_score: 0,
        confidence_score: 0,
        technical_depth_score: 0,
        status: "completed",
        processing_status: "completed",
        completed_at: new Date().toISOString()
      }).eq("id", sessionId);
  }
}

rescueSession();
