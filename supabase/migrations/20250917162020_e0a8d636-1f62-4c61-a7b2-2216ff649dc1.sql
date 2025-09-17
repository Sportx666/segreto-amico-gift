-- Fix duplicate and confusing RLS policies on profiles table for better security

-- 1. Drop the redundant/duplicate SELECT policies
DROP POLICY IF EXISTS "Users can view only their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own full profile" ON public.profiles;

-- 2. Create a single, clear, and secure SELECT policy
CREATE POLICY "profiles_select_own_only" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (id = auth.uid());

-- 3. Add DELETE policy for completeness (currently missing)
CREATE POLICY "profiles_delete_own_only" 
ON public.profiles 
FOR DELETE 
TO authenticated
USING (id = auth.uid());

-- 4. Ensure the existing INSERT and UPDATE policies are correctly named and secure
-- (They already exist and are properly configured)

-- 5. Add a comment to document the security model
COMMENT ON TABLE public.profiles IS 'User profile data with RLS - users can only access their own profile';

-- 6. Create a security function to validate profile data access (for audit purposes)
CREATE OR REPLACE FUNCTION public.audit_profile_access()
RETURNS trigger AS $$
BEGIN
  -- Log any attempts to access profiles (for security monitoring)
  -- This is a placeholder for future audit logging if needed
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Add trigger for audit logging (currently just a placeholder)
-- Uncomment if you want to enable audit logging in the future
-- CREATE TRIGGER profile_audit_trigger
--   AFTER SELECT OR INSERT OR UPDATE OR DELETE ON public.profiles
--   FOR EACH ROW EXECUTE FUNCTION public.audit_profile_access();