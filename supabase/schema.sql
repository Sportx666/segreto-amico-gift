-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.anonymous_aliases (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  nickname text NOT NULL,
  changes_used integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT anonymous_aliases_pkey PRIMARY KEY (id),
  CONSTRAINT anonymous_aliases_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT anonymous_aliases_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id)
);
CREATE TABLE public.assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid,
  giver_id uuid,
  receiver_id uuid,
  generated_on timestamp with time zone DEFAULT now(),
  first_reveal_pending boolean DEFAULT true,
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT assignments_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.participants(id),
  CONSTRAINT assignments_giver_id_fkey FOREIGN KEY (giver_id) REFERENCES public.participants(id)
);
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel = ANY (ARRAY['event'::text, 'pair'::text])),
  assignment_id uuid,
  author_participant_id uuid NOT NULL,
  alias_snapshot text NOT NULL,
  color_snapshot text DEFAULT '#6366f1'::text,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  recipient_participant_id uuid,
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id),
  CONSTRAINT chat_messages_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT chat_messages_recipient_participant_id_fkey FOREIGN KEY (recipient_participant_id) REFERENCES public.participants(id),
  CONSTRAINT chat_messages_author_participant_id_fkey FOREIGN KEY (author_participant_id) REFERENCES public.participants(id)
);
CREATE TABLE public.event_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid,
  participant_id uuid,
  role text DEFAULT 'member'::text,
  status text DEFAULT 'invited'::text CHECK (status = ANY (ARRAY['invited'::text, 'joined'::text, 'declined'::text, 'left'::text])),
  created_at timestamp with time zone DEFAULT now(),
  join_token text,
  anonymous_email text,
  anonymous_name text,
  reveal_shown boolean DEFAULT false,
  display_name text,
  CONSTRAINT event_members_pkey PRIMARY KEY (id),
  CONSTRAINT event_members_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id),
  CONSTRAINT event_members_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date,
  budget numeric,
  amazon_marketplace text DEFAULT 'www.amazon.it'::text,
  join_code text,
  draw_status text DEFAULT 'pending'::text,
  created_at timestamp with time zone DEFAULT now(),
  admin_profile_id uuid,
  previous_event_id uuid,
  cover_image_url text,
  draw_date date,
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_admin_profile_id_fkey FOREIGN KEY (admin_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT events_previous_event_id_fkey FOREIGN KEY (previous_event_id) REFERENCES public.events(id)
);
CREATE TABLE public.exclusions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid,
  giver_id uuid,
  blocked_id uuid,
  reason text,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT exclusions_pkey PRIMARY KEY (id),
  CONSTRAINT exclusions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT exclusions_giver_id_fkey FOREIGN KEY (giver_id) REFERENCES public.participants(id),
  CONSTRAINT exclusions_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES public.participants(id)
);
CREATE TABLE public.join_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  event_id uuid NOT NULL,
  participant_id uuid,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT join_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT join_tokens_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id),
  CONSTRAINT join_tokens_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);
CREATE TABLE public.notification_settings (
  profile_id uuid NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email_assignment boolean NOT NULL DEFAULT true,
  email_chat_digest boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_settings_pkey PRIMARY KEY (profile_id),
  CONSTRAINT notification_settings_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES auth.users(id)
);
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['assignment'::text, 'event'::text, 'chat'::text])),
  title text NOT NULL,
  body text NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES auth.users(id)
);
CREATE TABLE public.participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT participants_pkey PRIMARY KEY (id),
  CONSTRAINT participants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text UNIQUE,
  display_name text,
  family_group text,
  created_at timestamp with time zone DEFAULT now(),
  avatar_url text,
  address text,
  city text,
  postal_code text,
  country text,
  phone text,
  CONSTRAINT profiles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.wishlist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
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
  is_purchased boolean DEFAULT false,
  purchased_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT wishlist_items_pkey PRIMARY KEY (id),
  CONSTRAINT wishlist_items_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT wishlist_items_wishlist_id_fkey FOREIGN KEY (wishlist_id) REFERENCES public.wishlists(id),
  CONSTRAINT wishlist_items_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.participants(id),
  CONSTRAINT wishlist_items_purchased_by_fkey FOREIGN KEY (purchased_by) REFERENCES public.participants(id)
);
CREATE TABLE public.wishlists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid,
  owner_id uuid,
  title text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  cover_image_url text,
  CONSTRAINT wishlists_pkey PRIMARY KEY (id),
  CONSTRAINT wishlists_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.participants(id),
  CONSTRAINT wishlists_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);