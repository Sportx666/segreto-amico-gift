## Goal

Make the secondary CTA "Sfoglia Idee Regalo" on the public landing hero (`/`) much more eye-catching, with text that stays clearly visible in all states, and copy that intrigues users to click.

## Problem with current button

In `src/pages/Index.tsx` (lines 91-97):

```tsx
<Button size="lg" variant="outline"
  className="border-white/30 text-white hover:bg-white/10 w-full sm:w-auto">
  <Gift className="w-5 h-5 mr-2" />
  {t('home.browse_gift_ideas')}
  <ArrowRight className="w-4 h-4 ml-2" />
</Button>
```

Issues:
- Transparent background + white text on the green/red gradient hero -> low contrast, label can wash out.
- `variant="outline"` against the hero gradient also pulls the default `hover:bg-accent hover:text-accent-foreground` (light bg + dark text) on certain states, which can flash unreadable text.
- Copy "Sfoglia Idee Regalo" is descriptive but flat — no curiosity hook.

## Changes

All edits scoped to `src/pages/Index.tsx` and the two i18n files. No other files touched.

### 1. Restyle the button (public landing only, lines 91-97)

Replace with a high-contrast, warm-accent solid button that pops against the green hero, with a subtle animated sparkle and arrow nudge on hover. Text stays solid white at all times (no variant that swaps to light bg).

```tsx
<Link to="/regali" className="w-full sm:w-auto">
  <Button
    size="lg"
    className="group w-full sm:w-auto bg-gradient-to-r from-amber-400 to-orange-500
               text-white font-semibold shadow-glow
               hover:from-amber-500 hover:to-orange-600 hover:text-white
               focus-visible:text-white
               border-0 transition-all"
  >
    <Sparkles className="w-5 h-5 mr-2 text-white animate-sparkle" />
    {t('home.browse_gift_ideas')}
    <ArrowRight className="w-4 h-4 ml-2 text-white transition-transform group-hover:translate-x-1" />
  </Button>
</Link>
```

Why this works:
- Warm amber/orange gradient contrasts strongly with the green/red hero gradient -> button "pops".
- Solid white text + explicit `hover:text-white` and `focus-visible:text-white` guarantee the label is always readable (fixes the current wash-out).
- Sparkles icon (already imported in this file) + arrow slide on hover add intrigue/motion.
- `shadow-glow` (already in design tokens) adds a soft halo to draw the eye.
- `animate-sparkle` is already used elsewhere in this file (line 217) so no new keyframes needed.

### 2. More intriguing copy

Update the i18n key `home.browse_gift_ideas` in both locales:

- `src/i18n/it.json`: `"browse_gift_ideas": "Sfoglia Idee Regalo"` -> `"browse_gift_ideas": "Scopri Idee Regalo che Stupiscono"`
- `src/i18n/en.json`: current EN value -> `"browse_gift_ideas": "Discover Gift Ideas That Wow"`

Curiosity-driven, benefit-led, still short enough for the button.

## Out of scope

- Authenticated hero buttons (lines 188-205) untouched.
- Other CTAs, the gift-guide promo card, and `/regali` page untouched.
- No design-token changes, no new dependencies.

## Acceptance

- On `/` (logged-out, viewport 1440 and mobile), the second hero CTA is a glowing amber/orange gradient button with white text reading "Scopri Idee Regalo che Stupiscono" (IT) / "Discover Gift Ideas That Wow" (EN).
- Text remains fully white and readable in default, hover, focus, and active states.
- Hover shows a slight arrow slide and gradient deepening; sparkle icon animates.
- Clicking still navigates to `/regali`.
- No other pages or components changed.
