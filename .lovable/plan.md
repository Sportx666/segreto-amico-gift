
## Goal
Let a user permanently delete their own account from Profile → Account Settings, with a strong confirmation, server-side cleanup of related data, immediate sign-out, and a block preventing the same email from signing up again.

## UX

In `src/components/AccountSettings.tsx`, add a new "Danger zone" section under the existing security actions:

- Destructive outline button: "Delete my account"
- Clicking it opens an `AlertDialog` (shadcn) with:
  - Title: "Delete account permanently?"
  - Warning list (i18n):
    - All your events you administer will be deleted
    - Your wishlists, messages, notifications, push tokens, profile data will be removed
    - You will no longer be able to sign in with this email
    - This action cannot be undone
  - A text input requiring the user to type `DELETE` (or their email) to enable the confirm button
  - Cancel + Confirm (destructive) buttons
- On confirm: call the edge function, show toast, then sign out and redirect to `/`.

All strings added to `src/i18n/it.json` and `src/i18n/en.json` under `account.delete.*`.

## Backend — new edge function `delete-account`

File: `supabase/functions/delete-account/index.ts`

- Validates JWT from `Authorization` header using the anon client (`supabase.auth.getUser(token)`).
- Uses a service-role client to:
  1. Look up the user's `participants.id`s for cleanup of cross-referenced rows.
  2. Delete dependent rows the user owns or authored (RLS-bypassing, in this order to respect references):
     - `notifications` where `profile_id = user.id`
     - `notification_settings` where `profile_id = user.id`
     - `push_tokens` where `profile_id = user.id`
     - `chat_messages` where `author_participant_id` in user's participants
     - `private_chats` where user is anonymous or exposed participant
     - `anonymous_aliases` where `participant_id` in user's participants
     - `wishlist_items` and `wishlists` owned by user's participants
     - `assignments` and `exclusions` referencing user's participants → easier: delete events the user admins (cascades nothing automatically since there are no FKs, so explicitly delete `assignments`, `exclusions`, `event_members`, `wishlist_items`, `wishlists`, `join_tokens`, `chat_messages`, `private_chats`, `notifications` for those `event_id`s, then `events`).
     - `event_members` where `participant_id` in user's participants (leaves other events but removes their membership)
     - `participants` where `profile_id = user.id`
     - `profiles` where `id = user.id`
  3. Add the email to a new `blocked_emails` table (see migration).
  4. `supabase.auth.admin.deleteUser(user.id)` to remove the auth record.
- Returns `{ ok: true }`. CORS + zod input validation (no body needed, but validate method).

## Database migration

1. Create `blocked_emails` table:
   ```
   id uuid pk default gen_random_uuid()
   email text unique not null  (stored lowercased)
   reason text default 'account_deleted'
   created_at timestamptz default now()
   ```
   RLS enabled; no policies (only service role / triggers access it).

2. Create a `SECURITY DEFINER` trigger on `auth.users` BEFORE INSERT that rejects signups whose `lower(email)` exists in `public.blocked_emails`. (Adding a trigger on `auth.users` is the only minimal touch to the auth schema; allowed because we are not modifying schema structure, only attaching one trigger function.)

   Function `public.prevent_blocked_email_signup()` raises an exception with a clear message ("This email cannot be used to register again.") when a match is found.

3. Helper RPC (optional) `public.delete_my_account_data()` is NOT used — all deletion happens in the edge function with the service role for clearer auditability and error handling.

## Client wiring

- New component `src/components/DeleteAccountDialog.tsx` containing the AlertDialog + confirmation input.
- Imported and rendered from `AccountSettings.tsx`.
- On success: `await supabase.auth.signOut()` then `window.location.href = "/"`.
- Errors surfaced via `sonner` toast.

## Secrets
None new. Uses existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` already configured.

## Out of scope
- No "soft delete" / 30-day grace period (can be added later behind a flag).
- No admin override to un-block an email — manual SQL removal from `blocked_emails` if needed.

## Files touched

- new `supabase/functions/delete-account/index.ts`
- new `src/components/DeleteAccountDialog.tsx`
- edit `src/components/AccountSettings.tsx` (add danger zone)
- edit `src/i18n/it.json`, `src/i18n/en.json` (strings)
- new migration: `blocked_emails` table + auth.users signup trigger
