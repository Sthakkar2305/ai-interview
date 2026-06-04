import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function triggerWorker() {
  // Try calling the worker endpoint on their live site
  // If they are on vercel:
  console.log("Triggering worker on vercel...");
  try {
     const vRes = await fetch("https://ai-interview-xi-eight.vercel.app/api/worker", { method: "POST" });
     console.log("Vercel Worker Status:", vRes.status);
  } catch (e) {
     console.error(e);
  }
  
  // Try on render if we know the URL, but we don't know the exact render URL. 
  // We can just fetch the 'pending' sessions and see if they exist.
  const { data: pending } = await supabase.from('interview_sessions').select('id, processing_status, status').eq('processing_status', 'pending');
  console.log("Pending sessions:", pending);
}

triggerWorker();
