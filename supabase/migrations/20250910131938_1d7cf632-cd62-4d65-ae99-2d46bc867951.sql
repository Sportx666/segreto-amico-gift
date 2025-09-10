-- Fix notifications foreign key to reference auth.users instead of profiles
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_profile_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_profile_id_fkey 
  FOREIGN KEY (profile_id) REFERENCES auth.users(id) ON DELETE CASCADE;