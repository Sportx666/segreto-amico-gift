-- Add avatar and cover image columns
alter table public.profiles add column if not exists avatar_url text;

alter table public.events add column if not exists cover_image_url text;

alter table public.wishlists add column if not exists cover_image_url text;

-- Ensure participants exist for all profiles
insert into public.participants (profile_id)
select p.id from public.profiles p
where not exists (select 1 from public.participants pa where pa.profile_id = p.id);

-- Ensure unique membership per event/participant
alter table public.event_members
  add constraint if not exists event_members_event_participant_key unique (event_id, participant_id);

-- Ensure unique wishlist per event/owner
alter table public.wishlists
  add constraint if not exists wishlists_event_owner_key unique (event_id, owner_id);

-- Create default wishlist for members without one
insert into public.wishlists (event_id, owner_id, title)
select em.event_id, em.participant_id, 'La mia lista'
from public.event_members em
where not exists (
  select 1 from public.wishlists w
  where w.event_id = em.event_id and w.owner_id = em.participant_id
);
