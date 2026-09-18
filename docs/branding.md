# SendFiggle branding and URLs

Brand: SendFiggle. Mascot: Fig. Tagline: A little surprise, delivered. Header sign-off: a little something.

The 1200×630 `social-preview.png` combines the existing Fig illustration with the brand wordmark. `favicon-32.png`, `icon-192.png` and `apple-touch-icon.png` use the same original artwork. Re-render layouts with `scripts/brand-assets.cjs` and the Playwright module available in this workspace.

Homepage metadata is rendered server-side by `lib/metadata.mjs`. Recipient metadata is generic and never reads saved card content. Recipient and API responses carry noindex headers; reserved management paths also carry noindex and currently return 404. The sitemap contains only the public homepage. No management UI was added.

All canonical, social-image, sitemap and newly created card URLs share the same server-side origin resolver. Production uses PUBLIC_BASE_URL, then Vercel’s production/deployment URL. It never uses the incoming Host header or LAN address as its fallback. Invalid production origins fail before card storage. Local development can use a LAN URL for phone testing.

## Domain setup still outstanding

No public deployment URL or connected domain is configured in this project as of this update. sendfiggle.com is an intended domain, not a verified purchase/connection. First deploy using the normal Vercel URL with the existing storage credentials. Keep PUBLIC_BASE_URL at that connected HTTPS address (or use Vercel’s environment fallback). After connecting sendfiggle.com in Vercel and verifying DNS/HTTPS, change PUBLIC_BASE_URL to https://sendfiggle.com and redeploy. Keep the original deployment domain routed to the same app so previously shared URLs keep working. No card IDs or stored records were changed.

## Verification

Server tests verify homepage and recipient metadata, absolute image URLs, no personal recipient content in HTML, homepage-only sitemap, noindex headers, image sizes/content types, rejected private production addresses and persisted cards across restarts. Browser checks verify preset/create/copy/open-card and mobile/desktop scratch/reset. Build passes. External social crawler previews and live domain routing remain unverified until deployment.

Fig now gently translates/leans with a fine hover pointer, settles on pointer leave, and stays still on touch/reduced motion. This moves the existing character, not separate eye layers. The separate Try scratching action was removed; the foil itself is a keyboard-accessible preview trigger, with reset/reveal controls retained.
