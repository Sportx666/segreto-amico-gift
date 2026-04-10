

# Plan: Verification Results + Schema.org + OG Meta + /chi-siamo Page

## Verification Results

The `/regali` page is working correctly:
- All 8 categories fetch live products via `catalog-search` (8 POST requests, all 200 OK)
- Client-side price filtering works: "Under €10" shows products at €5, €5, €5.6, €5
- "View more on Amazon" links are visible next to each category heading
- Affiliate tag `amicosegreto-21` is present on all product links

No fixes needed for the existing implementation.

## New Work

### 1. Add Schema.org Product markup to GiftGuide (`src/pages/GiftGuide.tsx`)

Inject a `<script type="application/ld+json">` block with an `ItemList` schema containing `ListItem` entries for each category. Since products are fetched dynamically, use a static `ItemList` of category names linking to their Amazon search URLs (via `amazonSearchUrl`/`ideaBucketUrl`). This gives Google structured data without needing to wait for API responses.

### 2. Add Open Graph meta tags for /regali (`src/pages/GiftGuide.tsx`)

Create a `useEffect` that sets `<meta>` OG tags dynamically when the Gift Guide mounts:
- `og:title`: "Guida ai Regali - Amico Segreto"
- `og:description`: "Idee regalo curate per ogni budget e occasione"
- `og:url`: "https://amicosegreto.fun/regali"
- `og:type`: "website"
- `og:image`: reuse existing PWA icon

Clean up on unmount to restore defaults.

### 3. Create `/chi-siamo` public page (`src/pages/About.tsx`)

A public page for Amazon reviewers with:
- Hero section explaining what Amico Segreto is
- How it works (3-step flow reusing existing i18n keys)
- FAQ section (What is Secret Santa? Is it free? How do wishlists work?)
- Link to the Gift Guide and a CTA to get started

### 4. Wire up routing and navigation

- Add `/chi-siamo` route in `src/App.tsx`
- Add "Chi Siamo" link in `src/components/Footer.tsx`
- Add `/chi-siamo` to `public/sitemap.xml`

### 5. Add i18n keys

Add `about.*` keys to both `src/i18n/en.json` and `src/i18n/it.json` for the About page content.

## Files

| File | Action |
|------|--------|
| `src/pages/GiftGuide.tsx` | Add Schema.org JSON-LD + OG meta tags |
| `src/pages/About.tsx` | Create: public about page |
| `src/App.tsx` | Add `/chi-siamo` route |
| `src/components/Footer.tsx` | Add "Chi Siamo" link |
| `src/i18n/en.json` | Add about page translations |
| `src/i18n/it.json` | Add about page translations |
| `public/sitemap.xml` | Add `/chi-siamo` URL |

