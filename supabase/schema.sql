-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.assignments (
  event_id uuid,
  giver_id uuid,
  receiver_id uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  generated_on timestamp with time zone DEFAULT now(),
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT assignments_giver_id_fkey FOREIGN KEY (giver_id) REFERENCES public.participants(id),
  CONSTRAINT assignments_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.participants(id)
);
CREATE TABLE public.event_members (
  join_token text,
  anonymous_email text,
  anonymous_name text,
  event_id uuid,
  participant_id uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text DEFAULT 'member'::text,
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'invited'::text CHECK (status = ANY (ARRAY['invited'::text, 'joined'::text, 'declined'::text, 'left'::text])),
  CONSTRAINT event_members_pkey PRIMARY KEY (id),
  CONSTRAINT event_members_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT event_members_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id)
);
CREATE TABLE public.events (
  admin_profile_id uuid,
  previous_event_id uuid,
  name text NOT NULL,
  date date,
  budget numeric,
  join_code text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  amazon_marketplace text DEFAULT 'www.amazon.it'::text,
  draw_status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  cover_image_url text,
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_admin_profile_id_fkey FOREIGN KEY (admin_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT events_previous_event_id_fkey FOREIGN KEY (previous_event_id) REFERENCES public.events(id)
);
CREATE TABLE public.exclusions (
  event_id uuid,
  giver_id uuid,
  blocked_id uuid,
  reason text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exclusions_pkey PRIMARY KEY (id),
  CONSTRAINT exclusions_giver_id_fkey FOREIGN KEY (giver_id) REFERENCES public.participants(id),
  CONSTRAINT exclusions_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.participants(id),
  CONSTRAINT exclusions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);
CREATE TABLE public.join_tokens (
  token text NOT NULL UNIQUE,
  event_id uuid NOT NULL,
  participant_id uuid,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT join_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT join_tokens_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id),
  CONSTRAINT join_tokens_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);
CREATE TABLE public.participants (
  profile_id uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT participants_pkey PRIMARY KEY (id),
  CONSTRAINT participants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text UNIQUE,
  display_name text,
  locale text,
  family_group text,
  created_at timestamp with time zone DEFAULT now(),
  avatar_url text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.wishlist_items (
  wishlist_id uuid,
  event_id uuid,
  owner_id uuid,
  title text,
  asin text,
  raw_url text,
  affiliate_url text,
  image_url text,
  price_snapshot text,
  priority integer,
  notes text,
  purchased_by uuid,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  is_purchased boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wishlist_items_pkey PRIMARY KEY (id),
  CONSTRAINT wishlist_items_wishlist_id_fkey FOREIGN KEY (wishlist_id) REFERENCES public.wishlists(id),
  CONSTRAINT wishlist_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.participants(id),
  CONSTRAINT wishlist_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT wishlist_items_purchased_by_fkey FOREIGN KEY (purchased_by) REFERENCES public.participants(id)
);
CREATE TABLE public.wishlists (
  event_id uuid,
  owner_id uuid,
  title text,
  notes text,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  cover_image_url text,
  CONSTRAINT wishlists_pkey PRIMARY KEY (id),
  CONSTRAINT wishlists_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT wishlists_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.participants(id)
);
