# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/75ce866e-c026-45ce-b336-e9513a194ba3

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/75ce866e-c026-45ce-b336-e9513a194ba3) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/75ce866e-c026-45ce-b336-e9513a194ba3) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Environment variables

Set the following variables for Supabase:

- `VITE_SUPABASE_URL`: Public project URL (client-side)
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Publishable anon key (client-side)
- `SUPABASE_URL`: Project URL (server-side; same as above)
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (server-side; privileged)
 - `SUPABASE_ANON_KEY` (optional): Anon key for the debug API to run RLS checks using your session token.

Where to find these in Supabase:

- In your Supabase Dashboard: Project Settings → API
  - Project URL → use for `VITE_SUPABASE_URL` and `SUPABASE_URL`
  - anon public key → use for `VITE_SUPABASE_PUBLISHABLE_KEY`
  - service_role secret → use for `SUPABASE_SERVICE_ROLE_KEY` (do not expose client-side)

In deployment (e.g., Vercel), add the server-side variables in your Project → Settings → Environment Variables and redeploy.

### Debugging permissions

Enable debug mode by adding `?debug=1` to the URL. You can also POST to `/api/debug/rls` with your `Authorization: Bearer <access_token>` header and body `{ eventId }` to verify if your current session can insert into `participants` and `event_members` under RLS.

## Database migrations

To apply the latest database changes, run the SQL file in `supabase/migrations/20250908000000_profile_images.sql` on your Supabase instance.

```sh
psql $SUPABASE_DB_URL -f supabase/migrations/20250908000000_profile_images.sql
```

Run this SQL after pulling the repository to ensure your database schema is up to date.
