# Add Pinterest Tag

Install the Pinterest base tag (ID `2612933961253`) for retargeting and conversion tracking across the site.

## Changes

### 1. `index.html` — `<head>`
Add the Pinterest base script just below the existing Plausible Analytics block (last item before `</head>`). The `em` parameter is left empty for anonymous visitors; we'll populate it dynamically once a user is authenticated (see step 3).

```html
<!-- Pinterest Tag -->
<script>
  !function(e){if(!window.pintrk){window.pintrk = function () {
  window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var
    n=window.pintrk;n.queue=[],n.version="3.0";var
    t=document.createElement("script");t.async=!0,t.src=e;var
    r=document.getElementsByTagName("script")[0];
    r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
  pintrk('load', '2612933961253');
  pintrk('page');
</script>
<!-- end Pinterest Tag -->
```

### 2. `index.html` — top of `<body>`
Add the `<noscript>` pixel fallback. Per HTML5 rules, `<noscript><img></noscript>` cannot live in `<head>`, so it goes at the start of `<body>` (consistent with project convention).

```html
<noscript>
  <img height="1" width="1" style="display:none;" alt=""
    src="https://ct.pinterest.com/v3/?event=init&tid=2612933961253&noscript=1" />
</noscript>
```

### 3. `src/components/AuthProvider.tsx` — Enhanced Match
When a user signs in (and on initial session restore), call `pintrk('load', ...)` again with their email so Pinterest can attribute conversions. Pinterest hashes the email client-side automatically when passed to `em`.

Inside the existing `onAuthStateChange` and `getSession` handlers, after we have `session.user.email`:

```ts
if (session?.user?.email && typeof window !== 'undefined' && (window as any).pintrk) {
  (window as any).pintrk('load', '2612933961253', { em: session.user.email });
  (window as any).pintrk('page');
}
```

A small TypeScript shim on `Window` (inline `(window as any)`) avoids needing a new `.d.ts`.

## Files modified
- `index.html` (head script + body noscript)
- `src/components/AuthProvider.tsx` (Enhanced Match on login)

## Notes
- Tag fires on every page load via the SPA's initial mount — sufficient for retargeting.
- No route-change `pintrk('page')` re-fires are added; can be added later inside a router listener if Pinterest reports show low page views.
- No cookie consent gating added (matches current Plausible setup which is also unconditional).