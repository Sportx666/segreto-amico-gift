## Goal

Three enhancements to the public-landing "/regali" CTA in `src/pages/Index.tsx`:

1. Strong, accessible keyboard focus styling (and reduced-motion respect for sparkle/arrow).
2. Plausible analytics for CTA **impressions** and **clicks**.
3. Verify the gradient CTA is readable at all viewport widths and in light/dark modes.

No backend changes. No Supabase / RLS / edge-function work. Scope: `index.html`, `src/pages/Index.tsx`, plus one tiny analytics helper. Plausible is privacy-friendly, cookieless, and our cookie policy already mentions analytics.

---

## 1. Accessible focus + reduced-motion

Today the CTA uses only `focus-visible:text-white` (inherited ring from the Button base), which barely shows on the dark hero gradient.

Update the CTA `className` in `src/pages/Index.tsx` (line 94) to add a high-contrast focus ring that is visible against the green hero:

```
focus-visible:outline-none
focus-visible:ring-4
focus-visible:ring-white
focus-visible:ring-offset-2
focus-visible:ring-offset-primary
```

This gives a 4px white ring with a 2px primary-colored offset — meets WCAG 2.4.7 (focus visible) and 1.4.11 (non-text contrast >=3:1) on both the green hero and any background.

Reduced motion: wrap the moving classes so they no-op when the OS prefers reduced motion. Tailwind ships `motion-safe:` and `motion-reduce:` variants:

- Sparkle icon: `motion-safe:animate-sparkle` (was `animate-sparkle`)
- Arrow: `transition-transform motion-safe:group-hover:translate-x-1`

This addresses WCAG 2.3.3 (animation from interactions).

## 2. Plausible analytics: impression + click

### 2a. Load Plausible

Add to `index.html` `<head>` (gated by domain so it only fires on the live site, not localhost previews):

```html
<script defer data-domain="amicosegreto.fun" src="https://plausible.io/js/script.tagged-events.js"></script>
<script>window.plausible = window.plausible || function(){(window.plausible.q = window.plausible.q || []).push(arguments)}</script>
```

`script.tagged-events.js` lets us track clicks declaratively via `class="plausible-event-name=..."`, and the queue shim lets us call `plausible(...)` for the impression event before the script loads.

### 2b. Tiny helper `src/lib/analytics.ts`

```ts
declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Record<string, string | number | boolean> }) => void;
  }
}

export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  try { window.plausible?.(name, props ? { props } : undefined); } catch { /* noop */ }
}
```

Safe no-op in dev / when blocked.

### 2c. Wire impression + click in `Index.tsx`

- **Impression**: in the public-landing branch, add a `useEffect(() => { trackEvent('CTA Impression', { cta: 'browse_gift_ideas', location: 'home_hero' }); }, []);` that fires once when the logged-out hero mounts.
- **Click**: add `onClick={() => trackEvent('CTA Click', { cta: 'browse_gift_ideas', location: 'home_hero' })}` to the `<Link to="/regali">` (the click still navigates; the call is fire-and-forget). Also add `data-analytics="cta-browse-gift-ideas"` for resilient querying.

We use a JS handler (not just the tagged-events class) so the event name is consistent and props are typed.

## 3. Responsive + light/dark verification

Test plan, using `browser--navigate_to_sandbox` + `browser--screenshot`:

- Light mode (default): viewports 320, 375, 768, 1280, 1920 — confirm:
  - Text "Scopri Idee Regalo che Stupiscono" stays on a single line at >=375px, wraps cleanly at 320.
  - Amber/orange gradient + white text contrast >=4.5:1 (WCAG AA for normal text — gradient endpoints `amber-400 #fbbf24` and `orange-500 #f97316` against white pass at semibold size lg).
  - Glow shadow visible against green hero.
- Dark mode: toggle `<html class="dark">` via DOM in the browser session. Hero in dark mode uses primary green background; the warm gradient CTA still pops and white text remains readable.
- Keyboard: Tab to the CTA, screenshot the focus ring at 1280 light + dark.

If any contrast issue surfaces (e.g. focus ring blending in dark mode), fall back to:
`focus-visible:ring-offset-background` and bump ring color to `ring-amber-200`.

No code changes expected from this step unless the screenshots reveal a regression.

---

## Files touched

- `index.html` — add Plausible `<script>` tags in `<head>`.
- `src/lib/analytics.ts` — new tiny helper (~10 lines).
- `src/pages/Index.tsx` — focus classes, motion-safe variants, impression `useEffect`, click handler, data attribute.

## Out of scope

- No GA, no consent banner changes (Plausible is cookieless — already covered by current cookie policy mention of analytics; if user wants explicit consent gating later, that's a separate task).
- No changes to other CTAs, `/regali` page, or any backend.

## Acceptance

- Tabbing to the CTA shows a visible 4px white ring with offset on the green hero in both light and dark modes.
- With `prefers-reduced-motion: reduce`, the sparkle does not animate and the arrow does not slide on hover.
- On a real `amicosegreto.fun` load, Plausible receives one `CTA Impression` event per logged-out home view and one `CTA Click` event per CTA click, both with `cta` and `location` props.
- Screenshots at 320 / 375 / 768 / 1280 / 1920 in light and dark show readable label, intact gradient, no clipping or overlap.
