

# Plan: Live Catalog Search for Gift Guide with Env-Based Affiliate Tags

## Summary

Replace hardcoded product arrays with live Rainforest API results. Fallback products remain for reliability. All affiliate links (both live and fallback) use the `VITE_AMAZON_PARTNER_TAG` from the env file via the existing `withAffiliateTag()` / `productUrlFromASIN()` utilities.

## Changes

### 1. Update `src/data/curatedGifts.ts`
- Add `searchQuery`, `minPrice`, `maxPrice` fields to `GiftCategory`
- Rename `products` → `fallbackProducts`
- Keep all existing product data as fallbacks
- No change to `getProductUrl()` — it already uses `productUrlFromASIN()` which reads `VITE_AMAZON_PARTNER_TAG`

Search queries per category:

| Category | searchQuery | minPrice | maxPrice |
|----------|------------|----------|----------|
| under-10 | "regalo" | — | 10 |
| under-20 | "idee regalo" | 10 | 20 |
| under-50 | "regalo originale" | 20 | 50 |
| for-her | "regalo donna" | — | — |
| for-him | "regalo uomo" | — | — |
| for-kids | "regalo bambini" | — | — |
| tech | "gadget tecnologico" | — | — |
| home | "regalo casa" | — | — |

### 2. Create `src/hooks/useGiftCategoryProducts.ts`
- Uses `CatalogService.searchProducts(query, 1, minPrice, maxPrice)`
- Maps `CatalogItem` → `CuratedProduct` format
- **Affiliate tagging**: API results already come with affiliate-tagged URLs from the edge function. For any URL that doesn't have a tag, apply `withAffiliateTag()` which reads `VITE_AMAZON_PARTNER_TAG` from env
- Falls back to `category.fallbackProducts` on error/empty
- `staleTime: 30 minutes` via react-query

### 3. Update `src/components/gifts/GiftCategorySection.tsx`
- Call `useGiftCategoryProducts(category)` 
- Show 4 skeleton cards while loading
- On error/empty → silently use fallback products (no visible error for reviewers)

### 4. Minor updates to `src/components/gifts/GiftProductCard.tsx`
- Handle case where `imageUrl` might be undefined from API results
- Ensure `getProductUrl()` is used for fallback products and `withAffiliateTag(product.url)` for API products — both read the tag from env

### 5. Update `src/pages/GiftGuide.tsx`
- Update Schema.org JSON-LD to use dynamic products when available

## Affiliate Tag Flow

All paths use `VITE_AMAZON_PARTNER_TAG` from env:

```text
API products  → edge function applies tag server-side (from Supabase secrets)
              → client applies withAffiliateTag() as safety net (reads VITE_ env)

Fallback products → productUrlFromASIN() → getAffiliateTag() → reads VITE_AMAZON_PARTNER_TAG
```

No hardcoded tag values anywhere in the product flow.

## Files

| File | Action |
|------|--------|
| `src/data/curatedGifts.ts` | Modify: add search config, rename products → fallbackProducts |
| `src/hooks/useGiftCategoryProducts.ts` | Create |
| `src/components/gifts/GiftCategorySection.tsx` | Modify: use hook + skeletons |
| `src/components/gifts/GiftProductCard.tsx` | Minor: handle API product shape |
| `src/pages/GiftGuide.tsx` | Minor: dynamic schema data |

