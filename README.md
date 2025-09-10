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

### Supabase Configuration

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

### Amazon Affiliate Configuration

To enable Amazon affiliate links and product search:

1. **Create Amazon Associate Account**: Visit [Amazon Associates](https://affiliate-program.amazon.com/) and sign up
2. **Get Associate Tag**: Your unique tracking ID (e.g., `yourtag-21`)
3. **Apply for Product Advertising API**: Visit [Amazon Developer Services](https://webservices.amazon.com/paapi5/documentation/)
4. **Create PA-API credentials**: Get Access Key ID and Secret Access Key

Required environment variables:
- `AMZ_ACCESS_KEY`: Your PA-API Access Key ID
- `AMZ_SECRET_KEY`: Your PA-API Secret Access Key  
- `AMZ_ASSOC_TAG`: Your Amazon Associate tracking ID
- `AMZ_REGION`: AWS region (e.g., `eu-west-1` for Europe, `us-east-1` for US)
- `AMAZON_API_ENABLED`: Set to `true` to use real API (default: `false` for mock data)

**Important**: PA-API v5 requires approval from Amazon. During development, the system uses mock data by default.

In deployment (e.g., Vercel), add the server-side variables in your Project → Settings → Environment Variables and redeploy.

### Localhost caveat

WhatsApp on a phone will not open `localhost` links generated from your desktop. To test invite links from a mobile device, either:

- set `VITE_PUBLIC_BASE_URL` (and `PUBLIC_BASE_URL`) to a Vercel Preview URL, or
- use a tunnel like ngrok and configure the environment variables accordingly.

### Debugging permissions

Enable debug mode by adding `?debug=1` to the URL. You can also POST to `/api/debug/rls` with your `Authorization: Bearer <access_token>` header and body `{ eventId }` to verify if your current session can insert into `participants` and `event_members` under RLS.

## Database migrations

To apply the latest database changes, run the SQL file in `supabase/migrations/20250908000000_profile_images.sql` on your Supabase instance.

```sh
psql $SUPABASE_DB_URL -f supabase/migrations/20250908000000_profile_images.sql
```

Run this SQL after pulling the repository to ensure your database schema is up to date.

## OAuth Configuration (Google/Facebook)

To enable social authentication with Google and Facebook:

### Google OAuth Setup

1. **Create Google Cloud Project**: Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **Enable Google+ API**: Navigate to APIs & Services → Library → search for "Google+ API"
3. **Create OAuth Credentials**:
   - Go to APIs & Services → Credentials
   - Click "Create Credentials" → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized JavaScript origins: Add your domain(s)
   - Authorized redirect URIs: Add `https://yourproject.supabase.co/auth/v1/callback`
4. **Configure Supabase**:
   - Go to Supabase Dashboard → Authentication → Providers
   - Enable Google provider
   - Add your Client ID and Client Secret
   - Set redirect URL to your app's auth callback

### Facebook OAuth Setup

1. **Create Facebook App**: Go to [Facebook Developers](https://developers.facebook.com/)
2. **Add Facebook Login Product**: Configure OAuth redirect URIs
3. **Get App ID & Secret**: From app settings
4. **Configure Supabase**:
   - Enable Facebook provider in Supabase Dashboard
   - Add App ID and App Secret
   - Set redirect URL

### OAuth Implementation Example

```typescript
// Sign in with Google
const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });
};

// Sign in with Facebook  
const signInWithFacebook = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'facebook',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`
    }
  });
};

// Handle OAuth callback and token exchange
const handleOAuthCallback = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (data?.session) {
    // User is authenticated, redirect to main app
    window.location.href = '/';
  }
};
```

### Token-based Join Flow Integration

For invite links that require OAuth authentication:

```typescript
// In your /join/:token handler
const handleJoinWithOAuth = async (token: string, provider: 'google' | 'facebook') => {
  // Store token in sessionStorage for after OAuth
  sessionStorage.setItem('pendingJoinToken', token);
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback?join=true`
    }
  });
};

// In your OAuth callback handler
const handleOAuthCallbackWithJoin = async () => {
  const { data, error } = await supabase.auth.getSession();
  const pendingToken = sessionStorage.getItem('pendingJoinToken');
  
  if (data?.session && pendingToken) {
    // Process the join token now that user is authenticated
    const response = await fetch('/api/join/redeem', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: pendingToken })
    });
    
    sessionStorage.removeItem('pendingJoinToken');
    
    if (response.ok) {
      const { eventId } = await response.json();
      window.location.href = `/events/${eventId}`;
    }
  }
};
```

## Compliance & Legal Notes

### Amazon Affiliate Disclosure

This application uses Amazon affiliate links. **Legal requirements**:

- **Proper Attribution**: Display "As an Amazon Associate, we earn from qualifying purchases" or similar disclosure
- **No Link Cloaking**: All affiliate links must be clearly identifiable as Amazon links
- **Transparency**: Users must understand they're being redirected to Amazon
- **Geographic Compliance**: Ensure compliance with local advertising laws

The app includes proper disclosure in the UI. Do not modify affiliate URLs to hide their nature.

### Data Privacy

- **User Consent**: GDPR compliance includes cookie/tracking consent
- **Data Retention**: Implement appropriate data retention policies
- **Third-party Services**: Ensure all integrated services (Amazon, Google, Facebook) comply with privacy laws
- **User Rights**: Provide mechanisms for data export/deletion

### Rate Limiting

Amazon PA-API has strict rate limits:
- Max 1 request per second per Associate Tag
- Max 8,640 requests per day for approved applications
- Cache responses appropriately (15-30 minutes recommended)

The server-side proxy implements caching to respect these limits.
