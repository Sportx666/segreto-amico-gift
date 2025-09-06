-- === 0) Safe helpers ===
create extension if not exists "pgcrypto";

-- === 1) Events: add admin + previous_event link ===
alter table public.events
  add column if not exists admin_profile_id uuid references public.profiles(id),
  add column if not exists previous_event_id uuid references public.events(id);

-- (Optional) make admin required for NEW rows going forward:
-- alter table public.events alter column admin_profile_id set not null;

-- === 2) Membership & pairing integrity ===
-- One membership per participant per event
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'event_members_event_participant_uniq'
  ) then
    alter table public.event_members
      add constraint event_members_event_participant_uniq
      unique (event_id, participant_id);
  end if;
end$$;

-- Exactly one giver/receiver per event; no double assignment
create unique index if not exists assignments_unique_giver_per_event
  on public.assignments(event_id, giver_id);
create unique index if not exists assignments_unique_receiver_per_event
  on public.assignments(event_id, receiver_id);

-- Exclusions: no duplicates (active ones)
create unique index if not exists exclusions_unique_triplet
  on public.exclusions(event_id, giver_id, blocked_id) where active is true;

-- === 3) Wishlists constraints ===
-- (a) Prevent duplicate ASINs in the same wishlist
create unique index if not exists wishlist_items_unique_wishlist_asin
  on public.wishlist_items(wishlist_id, asin);

-- (b) Typically one wishlist per owner per event (remove this if you want multiple lists)
create unique index if not exists wishlists_unique_owner_event
  on public.wishlists(event_id, owner_id);

-- === 4) Convenience views for member-scoped lookups ===
-- Map assignments to event_member IDs for easier UI joins
create or replace view public.v_assignments_by_member as
select
  a.id,
  a.event_id,
  gm.id as giver_member_id,
  rm.id as receiver_member_id,
  a.generated_on
from public.assignments a
join public.event_members gm
  on gm.event_id = a.event_id and gm.participant_id = a.giver_id
join public.event_members rm
  on rm.event_id = a.event_id and rm.participant_id = a.receiver_id;

-- Same for exclusions (active only)
create or replace view public.v_exclusions_by_member as
select
  e.id,
  e.event_id,
  gm.id as giver_member_id,
  rm.id as blocked_member_id,
  e.reason,
  e.created_at
from public.exclusions e
join public.event_members gm
  on gm.event_id = e.event_id and gm.participant_id = e.giver_id
join public.event_members rm
  on rm.event_id = e.event_id and rm.participant_id = e.blocked_id
where e.active is true;

-- === 5) Enable RLS everywhere ===
alter table public.profiles        enable row level security;
alter table public.participants    enable row level security;
alter table public.events          enable row level security;
alter table public.event_members   enable row level security;
alter table public.exclusions      enable row level security;
alter table public.assignments     enable row level security;
alter table public.wishlists       enable row level security;
alter table public.wishlist_items  enable row level security;
alter table public.join_tokens     enable row level security;

-- === 6) RLS policies (minimal, practical) ===

-- Profiles: self-only
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
for select using (id = auth.uid());

-- Participants: see/update your own participant row
drop policy if exists participants_self_read on public.participants;
create policy participants_self_read on public.participants
for select using (profile_id = auth.uid());

-- Events: admin OR member can read; only admin can write
drop policy if exists events_read on public.events;
create policy events_read on public.events
for select using (
  admin_profile_id = auth.uid()
  or exists (
    select 1
    from public.event_members em
    join public.participants pa on pa.id = em.participant_id
    where em.event_id = events.id and pa.profile_id = auth.uid()
  )
);

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
for insert with check (admin_profile_id = auth.uid());

drop policy if exists events_update on public.events;
create policy events_update on public.events
for update using (admin_profile_id = auth.uid());

-- Event members: admin reads/writes; members can read their event’s roster
drop policy if exists em_read on public.event_members;
create policy em_read on public.event_members
for select using (
  exists (
    select 1 from public.events e
    where e.id = event_members.event_id
      and (e.admin_profile_id = auth.uid()
           or exists (
             select 1 from public.event_members em2
             join public.participants pa2 on pa2.id = em2.participant_id
             where em2.event_id = e.id and pa2.profile_id = auth.uid()
           ))
  )
);

drop policy if exists em_write on public.event_members;
create policy em_write on public.event_members
for all using (false) with check (false); -- default deny
-- Admin-only writes:
create policy em_admin_write on public.event_members
for insert with check (exists (select 1 from public.events e where e.id = event_id and e.admin_profile_id = auth.uid()));
create policy em_admin_update on public.event_members
for update using (exists (select 1 from public.events e where e.id = event_id and e.admin_profile_id = auth.uid()));
create policy em_admin_delete on public.event_members
for delete using (exists (select 1 from public.events e where e.id = event_id and e.admin_profile_id = auth.uid()));

-- Exclusions: admin-only write; read for members of the event
drop policy if exists excl_read on public.exclusions;
create policy excl_read on public.exclusions
for select using (
  exists (
    select 1 from public.events e
    where e.id = exclusions.event_id
      and (e.admin_profile_id = auth.uid()
           or exists (
             select 1 from public.event_members em2
             join public.participants pa2 on pa2.id = em2.participant_id
             where em2.event_id = e.id and pa2.profile_id = auth.uid()
           ))
  )
);

drop policy if exists excl_write on public.exclusions;
create policy excl_write on public.exclusions
for all using (false) with check (false); -- default deny
create policy excl_admin_write on public.exclusions
for insert with check (exists (select 1 from public.events e where e.id = event_id and e.admin_profile_id = auth.uid()));
create policy excl_admin_update on public.exclusions
for update using (exists (select 1 from public.events e where e.id = event_id and e.admin_profile_id = auth.uid()));
create policy excl_admin_delete on public.exclusions
for delete using (exists (select 1 from public.events e where e.id = event_id and e.admin_profile_id = auth.uid()));

-- Assignments: giver or admin can read; only admin writes
drop policy if exists asg_read on public.assignments;
create policy asg_read on public.assignments
for select using (
  -- giver is current user
  exists (
    select 1 from public.event_members em
    join public.participants pa on pa.id = em.participant_id
    where em.event_id = assignments.event_id
      and em.participant_id = assignments.giver_id
      and pa.profile_id = auth.uid()
  )
  or
  -- or admin of the event
  exists (select 1 from public.events e where e.id = assignments.event_id and e.admin_profile_id = auth.uid())
);

drop policy if exists asg_write on public.assignments;
create policy asg_write on public.assignments
for all using (false) with check (false);
create policy asg_admin_insert on public.assignments
for insert with check (exists (select 1 from public.events e where e.id = event_id and e.admin_profile_id = auth.uid()));
create policy asg_admin_update on public.assignments
for update using (exists (select 1 from public.events e where e.id = event_id and e.admin_profile_id = auth.uid()));

-- Wishlists: owner or admin read; owner write
drop policy if exists wl_read on public.wishlists;
create policy wl_read on public.wishlists
for select using (
  exists (
    select 1 from public.participants p
    where p.id = wishlists.owner_id and p.profile_id = auth.uid()
  )
  or exists (
    select 1 from public.events e
    where e.id = wishlists.event_id and e.admin_profile_id = auth.uid()
  )
);

drop policy if exists wl_write on public.wishlists;
create policy wl_write on public.wishlists
for all using (false) with check (false);
create policy wl_owner_insert on public.wishlists
for insert with check (
  exists (select 1 from public.participants p where p.id = owner_id and p.profile_id = auth.uid())
);
create policy wl_owner_update on public.wishlists
for update using (
  exists (select 1 from public.participants p where p.id = owner_id and p.profile_id = auth.uid())
);
create policy wl_owner_delete on public.wishlists
for delete using (
  exists (select 1 from public.participants p where p.id = owner_id and p.profile_id = auth.uid())
);

-- Wishlist items: owner read/write; admin read
drop policy if exists wli_read on public.wishlist_items;
create policy wli_read on public.wishlist_items
for select using (
  exists (
    select 1 from public.wishlists w
    join public.participants p on p.id = w.owner_id
    where w.id = wishlist_items.wishlist_id and p.profile_id = auth.uid()
  )
  or exists (
    select 1 from public.wishlists w
    join public.events e on e.id = w.event_id
    where w.id = wishlist_items.wishlist_id and e.admin_profile_id = auth.uid()
  )
);

drop policy if exists wli_write on public.wishlist_items;
create policy wli_write on public.wishlist_items
for all using (false) with check (false);
create policy wli_owner_insert on public.wishlist_items
for insert with check (
  exists (
    select 1 from public.wishlists w
    join public.participants p on p.id = w.owner_id
    where w.id = wishlist_items.wishlist_id and p.profile_id = auth.uid()
  )
);
create policy wli_owner_update on public.wishlist_items
for update using (
  exists (
    select 1 from public.wishlists w
    join public.participants p on p.id = w.owner_id
    where w.id = wishlist_items.wishlist_id and p.profile_id = auth.uid()
  )
);
create policy wli_owner_delete on public.wishlist_items
for delete using (
  exists (
    select 1 from public.wishlists w
    join public.participants p on p.id = w.owner_id
    where w.id = wishlist_items.wishlist_id and p.profile_id = auth.uid()
  )
);

-- Join tokens: admin of event can create/read; anyone can redeem via server endpoint
drop policy if exists jt_admin_read on public.join_tokens;
create policy jt_admin_read on public.join_tokens
for select using (
  exists (select 1 from public.events e where e.id = join_tokens.event_id and e.admin_profile_id = auth.uid())
);
create policy jt_admin_insert on public.join_tokens
for insert with check (
  exists (select 1 from public.events e where e.id = event_id and e.admin_profile_id = auth.uid())
);
