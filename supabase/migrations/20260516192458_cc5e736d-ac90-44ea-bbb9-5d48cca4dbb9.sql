
-- 1. Create profile_private
CREATE TABLE public.profile_private (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text,
  country text,
  postal_code text,
  city text,
  address text,
  family_group text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_private_select_self"
  ON public.profile_private FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "profile_private_insert_self"
  ON public.profile_private FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "profile_private_update_self"
  ON public.profile_private FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "profile_private_delete_self"
  ON public.profile_private FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

CREATE TRIGGER profile_private_updated_at
  BEFORE UPDATE ON public.profile_private
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Backfill from existing profiles
INSERT INTO public.profile_private (profile_id, phone, country, postal_code, city, address, family_group)
SELECT id, phone, country, postal_code, city, address, family_group
FROM public.profiles
WHERE phone IS NOT NULL
   OR country IS NOT NULL
   OR postal_code IS NOT NULL
   OR city IS NOT NULL
   OR address IS NOT NULL
   OR family_group IS NOT NULL
ON CONFLICT (profile_id) DO NOTHING;

-- 3. Drop the sensitive columns from public profiles
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS country,
  DROP COLUMN IF EXISTS postal_code,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS family_group;

-- 4. Recreate get_own_profile to join profile_private
DROP FUNCTION IF EXISTS public.get_own_profile();
CREATE OR REPLACE FUNCTION public.get_own_profile()
 RETURNS TABLE(
   id uuid,
   display_name text,
   avatar_url text,
   family_group text,
   address text,
   city text,
   postal_code text,
   country text,
   phone text
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    p.id,
    p.display_name,
    p.avatar_url,
    pp.family_group,
    pp.address,
    pp.city,
    pp.postal_code,
    pp.country,
    pp.phone
  FROM public.profiles p
  LEFT JOIN public.profile_private pp ON pp.profile_id = p.id
  WHERE p.id = auth.uid();
$function$;
REVOKE EXECUTE ON FUNCTION public.get_own_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_profile() TO authenticated;

-- 5. Restrict event_members.anonymous_email at the column level.
--    Authenticated clients can still see all OTHER columns (subject to RLS),
--    but the email is admin-only via get_event_member_emails().
REVOKE SELECT ON public.event_members FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, event_id, participant_id, role, status,
  display_name, anonymous_name, join_token, created_at
) ON public.event_members TO authenticated;
-- Keep UPDATE/INSERT/DELETE grants as they were (default = all columns; RLS enforces row scope)
GRANT INSERT, UPDATE, DELETE ON public.event_members TO authenticated;

-- 6. Admin-only function returning invite emails for an event
CREATE OR REPLACE FUNCTION public.get_event_member_emails(_event_id uuid)
 RETURNS TABLE(member_id uuid, anonymous_email text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = _event_id AND e.admin_profile_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: not event admin';
  END IF;

  RETURN QUERY
    SELECT em.id, em.anonymous_email
    FROM public.event_members em
    WHERE em.event_id = _event_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_event_member_emails(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_member_emails(uuid) TO authenticated;
