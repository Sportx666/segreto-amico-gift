
-- 1. Tighten is_event_member to require status='joined'
CREATE OR REPLACE FUNCTION public.is_event_member(eid uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_members em
    JOIN public.participants p ON p.id = em.participant_id
    WHERE em.event_id = eid
      AND p.profile_id = uid
      AND em.status = 'joined'
  );
$function$;

-- 2. Revoke EXECUTE on SECURITY DEFINER helpers from anon (and PUBLIC); keep authenticated for RLS use
REVOKE EXECUTE ON FUNCTION public.is_event_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_event_co_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_profile_co_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_event_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_event_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_event_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_co_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_profile_co_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_event_admin(uuid, uuid) TO authenticated;

-- 3. Storage: scope writes to user folder / event-admin folder. Drop broad SELECT listing policies.
DROP POLICY IF EXISTS "Authenticated write avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated write event images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated write wishlist images" ON storage.objects;
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read event images" ON storage.objects;
DROP POLICY IF EXISTS "Public read wishlist images" ON storage.objects;

-- Avatars: user folder = auth.uid()
CREATE POLICY "Avatars: owner write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Avatars: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Avatars: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Event images: first folder = event_id, only admin of that event
CREATE POLICY "Event images: admin write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-images'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.admin_profile_id = auth.uid()
  )
);

CREATE POLICY "Event images: admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'event-images'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.admin_profile_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'event-images'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.admin_profile_id = auth.uid()
  )
);

CREATE POLICY "Event images: admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'event-images'
  AND EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id::text = (storage.foldername(name))[1]
      AND e.admin_profile_id = auth.uid()
  )
);

-- Wishlist images: user folder = auth.uid()
CREATE POLICY "Wishlist images: owner write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'wishlist-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Wishlist images: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'wishlist-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'wishlist-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Wishlist images: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'wishlist-images' AND (storage.foldername(name))[1] = auth.uid()::text);
-- Note: SELECT policies intentionally omitted. Public buckets serve files via direct CDN URL
-- (used by uploadImage's getPublicUrl), which does NOT require a storage.objects SELECT policy.
-- This prevents broad listing of bucket contents while keeping image rendering functional.
