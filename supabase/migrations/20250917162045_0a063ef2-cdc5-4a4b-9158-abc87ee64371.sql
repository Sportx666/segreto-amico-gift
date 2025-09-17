-- Fix the function search path security issue

-- Update the audit function to have a secure search path
CREATE OR REPLACE FUNCTION public.audit_profile_access()
RETURNS trigger 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log any attempts to access profiles (for security monitoring)
  -- This is a placeholder for future audit logging if needed
  RETURN COALESCE(NEW, OLD);
END;
$$;