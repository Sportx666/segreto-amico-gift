-- Remove locale field and add shipping information to profiles table
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS locale,
ADD COLUMN address text,
ADD COLUMN city text,
ADD COLUMN postal_code text,
ADD COLUMN country text,
ADD COLUMN phone text;