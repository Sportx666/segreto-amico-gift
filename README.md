# Amici Segreto - Secret Santa Gift Exchange App

A modern web application for organizing Secret Santa gift exchanges with integrated product search and wishlist management.

## Features

- **Event Management**: Create and manage gift exchange events
- **Smart Draw System**: Automated assignment with exclusion rules and anti-recurrence  
- **Product Search**: Integrated Amazon product search via multiple providers (Rainforest API, PA-API)
- **Wishlist Management**: Create and manage gift wishlists
- **Chat System**: In-app messaging between participants
- **Anonymous Participation**: Support for both authenticated and anonymous users

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Vercel Functions, Supabase
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Product Search**: Pluggable provider system (Rainforest API, Amazon PA-API)

## Quick Setup

### 1. Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Catalog Provider (choose one)
CATALOG_PROVIDER=rainforest  # or 'amazon' or 'none'

# Rainforest API (for Amazon product search)
RAINFOREST_API_KEY=your-rainforest-api-key
RAINFOREST_DOMAIN=amazon.it

# Amazon PA-API (alternative to Rainforest)
AMAZON_API_ENABLED=false
AMZ_ACCESS_KEY=your-access-key-id
AMZ_SECRET_KEY=your-secret-access-key
AMZ_ASSOC_TAG=your-associate-tag
```

### 2. Catalog Provider Setup

#### Option A: Rainforest API (Recommended for development)
1. Sign up at [Rainforest API](https://www.rainforestapi.com/)
2. Get your API key from the dashboard
3. Set `CATALOG_PROVIDER=rainforest` and `RAINFOREST_API_KEY`

#### Option B: Amazon PA-API (Production)
1. Join Amazon Associates program
2. Apply for PA-API access
3. Set `CATALOG_PROVIDER=amazon` and configure PA-API credentials

#### Option C: Mock Data Only
1. Set `CATALOG_PROVIDER=none`
2. The app will use mock product data for testing

### 3. Installation & Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Catalog System

### API Endpoints

#### Search Products
```bash
curl -X POST /api/catalog/search \
  -H "Content-Type: application/json" \
  -d '{"q": "lego", "page": 1}'
```

Response:
```json
{
  "items": [
    {
      "title": "LEGO Creator Set",
      "imageUrl": "https://...",
      "asin": "B07ABC123", 
      "url": "https://www.amazon.it/dp/B07ABC123",
      "price": "49.99",
      "currency": "EUR"
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 10,
  "provider": "rainforest"
}
```

#### Get Product Details
```bash
curl -X POST /api/catalog/item \
  -H "Content-Type: application/json" \
  -d '{"asin": "B07ABC123"}'
```

### Provider Architecture

The catalog system uses a pluggable provider architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend UI   │───▶│  Catalog API    │───▶│   Providers     │
│                 │    │                 │    │                 │
│ - Search        │    │ - /search       │    │ - Rainforest    │
│ - Product Cards │    │ - /item         │    │ - Amazon PA-API │
│ - Wishlist      │    │ - Normalization │    │ - Mock Data     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Switching Between Providers

To switch from Rainforest API to Amazon PA-API later:

1. **Update Environment Variables**:
   ```bash
   # Change provider
   CATALOG_PROVIDER=amazon
   
   # Configure PA-API
   AMAZON_API_ENABLED=true
   AMZ_ACCESS_KEY=your-access-key
   AMZ_SECRET_KEY=your-secret-key
   AMZ_ASSOC_TAG=your-associate-tag
   ```

2. **No Code Changes Required**: The normalized API ensures compatibility

3. **Gradual Migration**: Run both providers and switch via environment variable

### Test Data Seeding

For local development and testing, use the provided seed data:

```bash
# Load test fixtures (after schema setup)
supabase db reset
psql -h localhost -p 54322 -U postgres -d postgres -f supabase/seed_test.sql

# Or using Supabase CLI
supabase db push
supabase db seed
```

### UAT Testing

For smoke testing against UAT environment:

```bash
# Install Playwright (first time only)
npx playwright install

# Run smoke tests (requires .env.uat.local)
npm run test:uat

# Run with browser UI for debugging
npm run test:uat:headed
```

Copy `.env.uat.example` to `.env.uat.local` and configure your UAT environment URLs.

### Reset Test Data (Local/UAT Only)

For clean testing state during development:

```sql
-- Clear all test data and start fresh
SELECT public.reset_test_data();

-- Then reload seed data
\i supabase/seed_test.sql
```

**Test Data Includes:**
- 4 user profiles (1 admin + 3 members) 
- 2 events: "Natale 2024" (open) + "Compleanno Elena" (completed)
- Event memberships, wishlists with items
- Exclusions, assignments, join tokens
- Notifications (read/unread mix)

**Safety Note:** `reset_test_data()` is blocked in production databases.

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

## Project Structure

```
├── api/                    # Vercel Functions
│   ├── catalog/           # Product catalog endpoints
│   ├── amazon/            # Legacy Amazon API
│   └── ...                # Other API endpoints
├── src/
│   ├── components/        # Reusable UI components
│   ├── features/          # Feature-specific components
│   ├── services/          # API services and business logic
│   ├── hooks/             # Custom React hooks
│   └── ...
├── supabase/
│   ├── functions/         # Edge functions
│   ├── migrations/        # Database migrations
│   └── schema.sql         # Database schema
└── ...
```

### Key Services

- `CatalogService` - Product search and details
- `WishlistService` - Wishlist management  
- `EventService` - Event operations
- `ApiService` - Base API client with error handling

## Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main

### Other Platforms

The app can be deployed to any platform supporting:
- Node.js runtime for API functions
- Static hosting for frontend assets
- Environment variable configuration

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

### Catalog Provider Configuration

To enable product search with different providers:

#### Rainforest API (Recommended for Development)
1. **Sign up**: Visit [Rainforest API](https://www.rainforestapi.com/)
2. **Get API Key**: From your dashboard after registration
3. **Configure Environment**:
   ```bash
   CATALOG_PROVIDER=rainforest
   RAINFOREST_API_KEY=your-api-key
   RAINFOREST_DOMAIN=amazon.it  # or amazon.com, amazon.co.uk, etc.
   ```

#### Amazon PA-API (Production)
1. **Create Amazon Associate Account**: Visit [Amazon Associates](https://affiliate-program.amazon.com/)
2. **Apply for PA-API Access**: Visit [Amazon Developer Services](https://webservices.amazon.com/paapi5/documentation/)
3. **Get Credentials**: Access Key ID and Secret Access Key
4. **Configure Environment**:
   ```bash
   CATALOG_PROVIDER=amazon
   AMAZON_API_ENABLED=true
   AMZ_ACCESS_KEY=your-access-key-id
   AMZ_SECRET_KEY=your-secret-access-key
   AMZ_ASSOC_TAG=your-associate-tag
   AMZ_REGION=eu-west-1  # or us-east-1, etc.
   ```

**Important**: PA-API requires approval from Amazon and has strict rate limits. Use Rainforest API for development and testing.

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

### Rate Limiting & Compliance

#### Rainforest API
- Check your plan's request limits
- Implements automatic caching (15 minutes)
- Graceful fallback to mock data on rate limits

#### Amazon PA-API
- Max 1 request per second per Associate Tag
- Max 8,640 requests per day for approved applications  
- Cache responses appropriately (15-30 minutes recommended)

Both providers include proper error handling and user-friendly fallback messages.

**Note**: When using real product data, ensure compliance with affiliate disclosure requirements and local advertising laws.
