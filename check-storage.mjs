import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStorage() {
  const { data, error } = await supabase
    .storage
    .from('interview-recordings')
    .list();
    
  console.log("Bucket list error:", error?.message);
  console.log("Files in bucket:", data?.map(d => d.name));
  
  // Check policies
  const { data: policies, error: pError } = await supabase.rpc('get_policies_dummy').catch(() => ({ error: { message: 'rpc not found' } }));
  console.log(pError);
}

checkStorage();
