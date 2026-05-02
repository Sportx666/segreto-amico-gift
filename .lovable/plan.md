# Phase 0 Minimal Fix — Italian default, prominent disclosure, editorial intro

## Heads-up about the spec

Your task brief pasted JSX/HTML snippets that arrived stripped of all tags (chat rendered them as empty paragraphs). I'm reconstructing the obvious intent below and calling it out explicitly so you can confirm before I write code. **Nothing outside the four files listed is touched.** No diff is shown ahead of time — Lovable applies edits directly — but I list every change precisely.

## Scope (4 files, surgical edits)

### 1. `src/i18n/index.ts` — Hard-default to Italian

Replace `getDefaultLanguage` with the SSR-safe version that:
- Returns `'it'` when `window`/`localStorage` are unavailable.
- Returns the stored value only if it is `'it'` or `'en'`.
- Otherwise returns `'it'`. **Never reads `navigator.language`.**

Includes the comment block from the brief explaining the SEO/crawler rationale.

### 2. `src/components/gifts/AffiliateDisclosure.tsx` — Add `prominent` variant

Add `'prominent'` to the `variant` union and a new branch rendered as a high-visibility callout, intended to sit above-the-fold on `/regali`. Reconstructed styling (consistent with existing Tailwind tokens in the project):

```tsx
if (variant === 'prominent') {
  return (
    <div className={`container mx-auto px-4 mt-6 ${className}`}>
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 p-4 flex gap-3">
        <Info className="w-5 h-5 text-yellow-700 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-900 dark:text-yellow-100 leading-relaxed">
          {t('gift_guide.affiliate_disclosure')}{' '}
          {t('gift_guide.affiliate_note')}
        </p>
      </div>
    </div>
  );
}
```

The existing `'inline'` and `'footer'` branches are kept exactly as-is.

### 3. `src/pages/GiftGuide.tsx` — Three surgical edits

- **3a.** Remove `<AffiliateDisclosure className="mx-auto" />` from the hero section.
- **3b.** Insert `<AffiliateDisclosure variant="prominent" />` between the closing `</div>` of the hero block and the sticky category nav.
- **3c.** Replace the editorial intro block. The brief's snippet lost its tags; reconstructed intent:
  - Keep the `intro_title` heading.
  - Replace the single `intro_description` paragraph with a rich block rendered from the new `intro_body_html` translation key via `dangerouslySetInnerHTML`.

```tsx
<div className="max-w-3xl mx-auto mb-12">
  <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center">
    {t('gift_guide.intro_title')}
  </h2>
  <div
    className="prose prose-neutral dark:prose-invert max-w-none text-muted-foreground"
    dangerouslySetInnerHTML={{ __html: t('gift_guide.intro_body_html') }}
  />
</div>
```

No other change to `GiftGuide.tsx` (Schema.org JSON-LD, OG meta, sticky nav, categories, CTA, How-It-Works, footer disclosure all untouched).

### 4. Translations

**`src/i18n/it.json` → `gift_guide`:**
- `intro_title` → `"Come scegliere il regalo giusto per l'Amico Segreto"`
- `affiliate_disclosure` → `"In qualità di Affiliato Amazon io ricevo un guadagno dagli acquisti idonei."`
- `affiliate_note` → `"Questo non comporta alcun costo aggiuntivo per te. I prezzi e la disponibilità possono variare."`
- Keep `intro_description` unchanged (other components may reference it).
- Add `intro_body_html` containing the three Italian paragraphs from the brief, wrapped as `<p>…</p><p>…</p><p>…</p>`.

**`src/i18n/en.json` → `gift_guide`:**
- Add `intro_body_html`: `"<p>[TODO: translate to English when EN locale is enabled in production]</p>"`
- No other EN changes.

## Confirmations needed before I implement

1. **Reconstructed JSX OK?** The brief's code blocks rendered as empty `<p>` tags. I'm using the styling above (yellow callout for `prominent`, `prose` block + `dangerouslySetInnerHTML` for the intro). Say "go" or send a corrected snippet.
2. **`dangerouslySetInnerHTML` for `intro_body_html`** — required because the value is `<p>…</p>` HTML. The string is author-controlled (translation file), not user input, so it's safe. Confirm OK.

## Out of scope (not touched)

Supabase, auth, draw, wishlist, Capacitor, PWA, `/ideas`, `/auth`, `/profile`, `Footer.tsx`, `About.tsx`, sitemap, Schema.org/OG blocks already on `/regali`, all other pages.

## Files

| File | Action |
|------|--------|
| `src/i18n/index.ts` | Replace `getDefaultLanguage` |
| `src/components/gifts/AffiliateDisclosure.tsx` | Add `'prominent'` variant |
| `src/pages/GiftGuide.tsx` | Remove hero disclosure, insert prominent disclosure, replace editorial intro |
| `src/i18n/it.json` | Update 3 keys + add `intro_body_html` |
| `src/i18n/en.json` | Add `intro_body_html` placeholder |
