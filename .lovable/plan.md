## Goal

Speed up search engine recrawls by (1) adding `<lastmod>` dates to every URL in `public/sitemap.xml` and (2) pinging IndexNow with the sitemap URL after each deploy.

## Changes

### 1. `public/sitemap.xml` — add `<lastmod>`

Add an ISO-8601 date (`YYYY-MM-DD`) to each `<url>` entry. Use today's date as the baseline. Going forward, the deploy workflow will refresh the homepage and `/regali` lastmod automatically (high-churn pages); the static legal pages stay on a manual cadence.

```xml
<url>
  <loc>https://amicosegreto.fun/</loc>
  <lastmod>2026-05-07</lastmod>
  <changefreq>weekly</changefreq>
  <priority>1.0</priority>
</url>
```

### 2. Auto-refresh `<lastmod>` for dynamic pages at build time

Add a step in `.github/workflows/deploy.yml` (before `npm run build`) that updates `<lastmod>` on `/` and `/regali` to the current UTC date using `sed`. Keeps churn-prone pages fresh without manual edits.

### 3. IndexNow ping after deploy

#### a. Generate an IndexNow key file

- Pick a 32-char hex key (e.g. generated once, stored as repo secret `INDEXNOW_KEY`).
- Add `public/<KEY>.txt` containing just the key (required for verification by IndexNow). Since the key is public-by-design, we can also commit it directly — but using a secret keeps it out of the repo. Implementation: a workflow step writes `public/${INDEXNOW_KEY}.txt` before build.

#### b. Add a post-deploy ping step in `.github/workflows/deploy.yml`

After the FTP deploy step, add:

```yaml
- name: Ping IndexNow
  run: |
    curl -fsS -X POST "https://api.indexnow.org/indexnow" \
      -H "Content-Type: application/json" \
      -d '{
        "host": "amicosegreto.fun",
        "key": "${{ secrets.INDEXNOW_KEY }}",
        "keyLocation": "https://amicosegreto.fun/${{ secrets.INDEXNOW_KEY }}.txt",
        "urlList": [
          "https://amicosegreto.fun/",
          "https://amicosegreto.fun/regali",
          "https://amicosegreto.fun/chi-siamo",
          "https://amicosegreto.fun/sitemap.xml"
        ]
      }'
```

IndexNow notifies Bing, Yandex, Seznam, Naver, and Yep instantly. Google does not consume IndexNow, but Bingbot discovery often accelerates Google indexing indirectly. (For Google specifically, the existing Search Console sitemap submission remains the primary signal.)

### 4. Documentation

Short note in `README.md` describing the `INDEXNOW_KEY` secret and how the ping works.

## What you need to do

- Create a GitHub Actions secret named `INDEXNOW_KEY` with a 32-character hex string (I can generate one for you).
- Approve the plan and I'll implement the rest.

## Out of scope

- No Google-specific ping (Google deprecated their sitemap ping endpoint in 2023; Search Console remains the channel).
- No runtime change to the app — only build/deploy plumbing and a static XML edit.
