# Switch Catalog to Amazon PA-API v5

## Current state

- `catalog-search` edge function already supports `amazon` provider via PA-API v5 SearchItems with full SigV4 signing — looks correct.
- `catalog-item` edge function only supports `rainforest` and `mock` — **no Amazon branch exists**, so single-product lookups would fail or fall back to mock when `CATALOG_PROVIDER=amazon`.
- `CATALOG_PROVIDER` secret is currently set to `rainforest` (per `.env` and secrets list). Needs to be set to `amazon`.
- Amazon credentials are already stored as Supabase secrets: `AMAZON_PAAPI_ACCESS_KEY`, `AMAZON_PAAPI_SECRET_KEY`, `AMAZON_PAAPI_PARTNER_TAG`, `AMAZON_PAAPI_REGION`, `AMAZON_MARKETPLACE`.
- `src/lib/validation.ts` warning message references only `AMZ_ASSOC_TAG`/`RAINFOREST_ASSOC_TAG` — minor doc drift.
- `README.md` and `.env` default examples still say `CATALOG_PROVIDER=rainforest`.

## Issues to fix

1. **`catalog-item` lacks Amazon support** — must add a PA-API v5 `GetItems` branch using the same SigV4 signing approach as `catalog-search`.
2. **Provider secret** — flip `CATALOG_PROVIDER` runtime secret to `amazon` so both functions actually use PA-API.
3. **Doc drift** — update `.env`, `README.md`, and `validation.ts` warning to reflect Amazon as primary provider.
4. **Sanity check existing PA-API signing in `catalog-search`** — confirm:
   - `Marketplace` value uses `www.amazon.it` form (correct).
   - `x-amz-target` matches the operation (`SearchItems` for search; will need `GetItems` for item).
   - Region defaults to `eu-west-1` for IT marketplace (correct).
   - Payload hashing uses the exact same JSON string sent in the body (correct — insertion order preserved).

## Changes

### 1. `supabase/functions/catalog-item/index.ts` — full rewrite to mirror `catalog-search` architecture

- Add module-scope `CONFIG` block (same as `catalog-search`) computing marketplace, affiliate tag, Amazon credentials, and Rainforest key once at cold start.
- Add `AmazonPAAPIClient` with a `getItem(asin)` method:
  - Endpoint: `POST https://{host}/paapi5/getitems`
  - Payload: `{ ItemIds: [asin], Resources: ["Images.Primary.Large", "ItemInfo.Title", "Offers.Listings.Price"], PartnerTag, PartnerType: "Associates", Marketplace: "www.amazon.it" }`
  - Headers: `x-amz-target: com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems`
  - SigV4 signing identical to search (shared helpers).
- Singleton clients for Rainforest and Amazon, instantiated once.
- Provider routing:
  - `mock` → mock product
  - `rainforest` → existing Rainforest client (kept as fallback option)
  - `amazon` → new PA-API GetItems client
- Map PA-API response to existing `CatalogItem` shape (title, image, asin, url with affiliate tag, price, currency).
- Reuse the same error mapping (`API_RATE_LIMIT` → 429, `AMAZON_PAAPI_AUTH_ERROR` → 503).

### 2. Flip provider secret

- Use `update_secret` to set `CATALOG_PROVIDER = amazon`.
- Keep `RAINFOREST_API_KEY` in place so we can roll back instantly by flipping the secret.

### 3. Minor cleanup

- `.env`: change default `CATALOG_PROVIDER=rainforest` → `CATALOG_PROVIDER=amazon` (local dev hint only — Edge Functions read from Supabase secrets, not `.env`).
- `README.md`: update “Configuration” section so Amazon is presented as the default and Rainforest as the fallback.
- `src/lib/validation.ts`: include `AMAZON_PAAPI_PARTNER_TAG` in the warning message.

### 4. Verification

- After deploy, call both functions via `supabase--curl_edge_functions`:
  - `POST /catalog-search { "q": "lego", "page": 1 }` — expect `provider: "amazon"`, real items.
  - `POST /catalog-item { "asin": "B0BSHF7WHW" }` — expect `provider: "amazon"`, real product.
- Tail `supabase--edge_function_logs` for `catalog-search` and `catalog-item` to confirm no signing/auth errors.
- If 401/403 from Amazon → credentials/region/marketplace mismatch; will re-check `AMAZON_PAAPI_REGION` (must be `eu-west-1` for `amazon.it`) and `AMAZON_PAAPI_PARTNER_TAG` (must match an Associates account approved for the IT marketplace).

## Files touched

- `supabase/functions/catalog-item/index.ts` (rewrite)
- `.env` (default hint)
- `README.md` (provider section)
- `src/lib/validation.ts` (warning text)
- Supabase secret: `CATALOG_PROVIDER` → `amazon`

## Out of scope

- No changes to frontend `CatalogService` or `useGiftCategoryProducts` — they are provider-agnostic and continue to work via the unified edge function response shape.
- No DB migrations.
