## Plan: Pinterest Tag — Env Config + Conversion Events

### 1. Environment variable
- Add `VITE_PINTEREST_TAG_ID=2612933961253` to `.env` and `.env.example` (and `.env.uat.example`).
- Add it as a build env in `.github/workflows/deploy.yml` (hardcoded value, mirroring `VITE_AMAZON_PARTNER_TAG`) so production builds always include it.
- Extend `src/lib/featureFlags.ts` with a `pinterestTagId` value (string, empty = disabled) so all access is centralized.

### 2. Centralize Pinterest helper
- Create `src/lib/pinterest.ts` exporting:
  - `PINTEREST_TAG_ID` (from `import.meta.env.VITE_PINTEREST_TAG_ID`)
  - `pinterestLoad(email?)` — calls `pintrk('load', id, { em })` then `pintrk('page')`
  - `pinterestTrack(event, props?)` — wraps `window.pintrk('track', event, props)`, no-ops if tag missing or `pintrk` undefined
  - Minimal `window.pintrk` typing via `src/vite-env.d.ts` augmentation.
- Replace hardcoded `'2612933961253'` usage in `src/components/AuthProvider.tsx` with `pinterestLoad(session.user.email)`.

### 3. Bootstrap script in `index.html`
- Replace the inline hardcoded tag ID with a small loader that:
  - Defines the standard `pintrk` shim and injects `core.js`.
  - Reads the tag id from a `window.__PINTEREST_TAG_ID__` injected by Vite at build time, OR — since `index.html` cannot read Vite env directly without a plugin — keep `index.html` to only define the shim + load script, and call the initial `pintrk('load', ...)` + `pintrk('page')` from `src/main.tsx` using `pinterestLoad()`. The `<noscript>` pixel fallback stays in `<body>` with the production tag id (acceptable since the value is public).
- This guarantees the same code works across dev/UAT/prod just by changing the env var.

### 4. Conversion event tracking
Fire `PageVisit` events (Pinterest standard event) on key routes:
- `src/pages/Index.tsx` — on mount, call `pinterestTrack('pagevisit', { page: 'home' })`.
- `src/pages/GiftGuide.tsx` (the `/regali` route) — on mount, call `pinterestTrack('pagevisit', { page: 'gift_guide' })`.

Both fire once per mount, guarded inside the helper so missing tag id = silent no-op.

### 5. Memory
- Add a memory entry: `mem://integrations/pinterest-tag` documenting `VITE_PINTEREST_TAG_ID`, helper location, and event conventions; reference it from `mem://index.md`.

### Files touched
- `.env`, `.env.example`, `.env.uat.example`
- `.github/workflows/deploy.yml`
- `index.html`
- `src/main.tsx`
- `src/lib/featureFlags.ts`
- `src/lib/pinterest.ts` (new)
- `src/vite-env.d.ts`
- `src/components/AuthProvider.tsx`
- `src/pages/Index.tsx`
- `src/pages/GiftGuide.tsx`
- `mem://integrations/pinterest-tag` (new), `mem://index.md`

### Notes
- Pinterest tag ID is public (visible in HTML), so storing in `.env` / GitHub workflow plaintext is fine — no secret needed.
- All `pintrk` calls go through the helper so future events (Signup, Lead, AddToCart on wishlist add, etc.) are trivial to add.
