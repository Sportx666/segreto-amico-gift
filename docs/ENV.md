# Environment Variables Documentation

## Migration Summary

This document outlines the environment variable consolidation and centralization implemented to improve configuration management.

### Key Changes

1. **Central Configuration**: All environment variables now flow through `src/config/env.ts`
2. **Standardized Naming**: Consistent naming convention across client/server variables
3. **Google Ads Integration**: Updated to use publisher code `pub-9283228458809671`
4. **Type Safety**: Full TypeScript support for configuration values

### Environment Variable Inventory

| Old Name | New Name | Purpose | Required | Type |
|----------|----------|---------|----------|------|
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `VITE_SUPABASE_ANON_KEY` | Supabase client auth | Yes | Client |
| `VITE_AMAZON_PARTNER_TAG` | Server-side `AMZ_ASSOC_TAG` | Amazon affiliate | No | Server |
| `AMAZON_API_ENABLED` | `config.catalog.amazonApiEnabled` | Enable PA-API | No | Server |
| `RESEND_API_KEY` | `MAIL_API_KEY` | Email service | Conditional | Server |
| `SENDGRID_API_KEY` | `MAIL_API_KEY` | Email service | Conditional | Server |

### Required Variables by Feature

#### Core (Always Required)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side)

#### Ads (when `VITE_ADS_ENABLED=1`)
- `VITE_ADSENSE_CLIENT_ID` (defaults to `ca-pub-9283228458809671`)

#### Catalog Search (when enabled)
- **Rainforest**: `RAINFOREST_API_KEY`
- **PA-API**: `AMZ_ACCESS_KEY`, `AMZ_SECRET_KEY`, `AMZ_ASSOC_TAG`

#### Email (when enabled)
- `MAIL_API_KEY` (Resend or SendGrid)
- `MAIL_FROM` (sender email)

### Security Notes

⚠️ **Important**: Variables prefixed with `VITE_` are exposed to the browser. Never use `VITE_` prefix for secrets, API keys, or sensitive data.

### Google Ads Configuration

The application now uses Google AdSense with publisher ID `pub-9283228458809671`. The `ads.txt` file is automatically served at `/ads.txt` with the required publisher verification line.

### Validation

Run `npm run check:env` (when implemented) to validate required environment variables for enabled features.