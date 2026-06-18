import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "YOUR_SUPABASE_URL";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "YOUR_SUPABASE_SERVICE_ROLE_KEY";



const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixLatestTerminatedSession() {
  console.log("Fetching the latest terminated session...");
  const { data: sessions, error } = await supabase
    .from('interview_sessions')
    .select('*')
    .eq('session_status', 'terminated')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error fetching session:", error);
    return;
  }

  if (!sessions || sessions.length === 0) {
    console.log("No terminated sessions found.");
    return;
  }

  const session = sessions[0];
  console.log(`Found terminated session: ${session.id}`);
  console.log(`Recording URL: ${session.recording_url || "NONE (Video was not uploaded)"}`);

  // Update session to completed so it can be scored
  console.log("Updating session status to completed and processing_status to pending...");
  const { error: updateError } = await supabase
    .from('interview_sessions')
    .update({
      session_status: 'completed',
      status: 'completed',
      processing_status: 'pending'
    })
    .eq('id', session.id);

  if (updateError) {
    console.error("Error updating session:", updateError);
    return;
  }

  console.log("Triggering background evaluation...");
  try {
    // Note: If you're running locally, you might need to hit http://localhost:3000
    // I'm using localhost assuming the dev server is running, otherwise we hit the production URL.
    const res = await fetch(`http://localhost:3000/api/worker`, { method: "POST" });
    console.log("Worker triggered with status:", res.status);
    console.log("Session has been successfully rescued! Please check your dashboard in a few moments.");
  } catch (err) {
    console.error("Failed to trigger local worker. Trying production worker...", err);
    // fallback if you have a prod worker
  }
}

fixLatestTerminatedSession();
