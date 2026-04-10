

# Plan: Fix Price Filtering + Add "View More" Button

## Findings from Testing

1. **Products load correctly** from the API -- 8 categories, 32 product cards rendered with real Amazon images and affiliate-tagged links (`?tag=amicosegreto-21`)
2. **Price filtering is broken**: "Gifts Under €10" shows products at €21.26, €169.9, €24.99. The `maxPrice` param is sent to the API but the Rainforest/Amazon provider isn't filtering effectively. Need client-side price filtering as a safety net.
3. **No "View More" button** exists yet

## Changes

### 1. Add client-side price filtering in `src/hooks/useGiftCategoryProducts.ts`

After receiving API results, filter items by `minPrice`/`maxPrice` before slicing to 4. This ensures the "Under €10" category only shows products <= €10, even if the API returns unfiltered results.

```typescript
// After fetching, filter by price range client-side
let filtered = result.items;
if (category.maxPrice) {
  filtered = filtered.filter(item => 
    item.price && parseFloat(item.price) <= category.maxPrice!
  );
}
if (category.minPrice) {
  filtered = filtered.filter(item => 
    item.price && parseFloat(item.price) >= category.minPrice!
  );
}
return filtered.slice(0, 4).map(...)
```

### 2. Add "View More on Amazon" button to `src/components/gifts/GiftCategorySection.tsx`

Add a button/link next to each category heading (or below the product grid) that links to an Amazon search for that category's query, with the affiliate tag from env.

Uses the existing `ideaBucketUrl()` for price-based categories and a new Amazon search URL builder for other categories. All links go through `withAffiliateTag()` which reads `VITE_AMAZON_PARTNER_TAG`.

### 3. Add Amazon search URL helper to `src/lib/amazon.ts`

Add a function `amazonSearchUrl(query: string)` that generates `https://www.amazon.it/s?k=<query>&tag=<affiliate-tag>` for categories without price constraints. For price-based categories, reuse `ideaBucketUrl()`.

### 4. Add i18n keys

Add `gift_guide.view_more` translation:
- EN: "View more on Amazon"
- IT: "Vedi altro su Amazon"

## Files

| File | Action |
|------|--------|
| `src/hooks/useGiftCategoryProducts.ts` | Add client-side price filtering |
| `src/components/gifts/GiftCategorySection.tsx` | Add "View More" button with affiliate-tagged Amazon search link |
| `src/lib/amazon.ts` | Add `amazonSearchUrl()` helper |
| `src/i18n/en.json` | Add `view_more` key |
| `src/i18n/it.json` | Add `view_more` key |

