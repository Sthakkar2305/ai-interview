-- Add INSERT policy to profiles table to allow users to create their own profiles
CREATE POLICY "Users can create their own profile"
ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Add policy to allow service role to create profiles (for server-side operations)
CREATE POLICY "Service role can manage profiles"
ON profiles
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
