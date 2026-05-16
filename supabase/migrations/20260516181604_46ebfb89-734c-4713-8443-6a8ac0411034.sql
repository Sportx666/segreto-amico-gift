
-- 1. Blocked emails table
CREATE TABLE IF NOT EXISTS public.blocked_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT 'account_deleted',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_emails ENABLE ROW LEVEL SECURITY;
-- No policies => only service role can access.

-- 2. Trigger function: prevent signup with blocked email
CREATE OR REPLACE FUNCTION public.prevent_blocked_email_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.blocked_emails WHERE email = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'This email cannot be used to register again.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach trigger on auth.users (BEFORE INSERT)
DROP TRIGGER IF EXISTS prevent_blocked_email_signup_trg ON auth.users;
CREATE TRIGGER prevent_blocked_email_signup_trg
BEFORE INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_blocked_email_signup();
