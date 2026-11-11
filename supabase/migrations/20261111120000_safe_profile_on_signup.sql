-- Profile row on signup, safe to run more than once.
--
-- Live database (checked 11 Nov 2026): public.handle_new_user does not exist.
-- The only trigger on auth.users is prevent_blocked_email_signup_trg.
-- public.profiles columns are id, display_name, created_at, avatar_url.
-- One auth user has no profile row.
--
-- A fresh replay of the September 2025 migrations recreates handle_new_user
-- with an INSERT into profiles.email, a column that was later dropped. This
-- migration replaces that function. It does not insert email.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
      NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
      'User'
    )
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Clients do not call this. The auth role that inserts users still needs EXECUTE.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;
-- auth.users inserts run as supabase_auth_admin, which is not a superuser.
-- The trigger still checks EXECUTE for that role. Do not grant anon or authenticated.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill the auth users who never got a profile row.
INSERT INTO public.profiles (id, display_name)
SELECT
  u.id,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'display_name', ''),
    NULLIF(split_part(COALESCE(u.email, ''), '@', 1), ''),
    'User'
  )
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Rollback (does not delete profile rows already written):
--   DROP TRIGGER on_auth_user_created ON auth.users;
--   DROP FUNCTION public.handle_new_user();
