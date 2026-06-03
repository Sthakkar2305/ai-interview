import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function patchProfile() {
  const userId = "408c71ca-ad11-4add-893f-7376fe4749e4";
  
  const { data: { user } } = await supabase.auth.admin.getUserById(userId);
  if (user) {
     console.log("Inserting profile for:", user.email);
     const { data, error } = await supabase.from("profiles").insert({
       id: user.id,
       email: user.email,
       full_name: user.user_metadata?.full_name || user.user_metadata?.name || "Google User"
     });
     if (error) {
       console.error("Failed to insert profile:", error);
     } else {
       console.log("Successfully patched profile!");
     }
  } else {
     console.log("User not found in auth.users");
  }
}

patchProfile();
