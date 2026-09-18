# Launch setup and costs

Reviewed 18 September 2026. No paid service was provisioned. The project repository is https://github.com/edakturk14/greeting-card.

## Account steps still needed

1. Create a dedicated **Supabase Free** project. Run `db/schema.sql` in its SQL Editor. If the schema was previously applied, rerun it for the additive video tables. New cards require To and From; old nameless cards remain readable. Add the project URL and **service-role secret** to `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Never paste secrets into chat or client JavaScript.
2. Create a **PostHog Cloud Free** project without adding a payment card. Put the project API key in `POSTHOG_KEY`; set `POSTHOG_HOST` to `https://us.i.posthog.com` or `https://eu.i.posthog.com`, matching its region. No personal/admin API key is needed.
3. Use the GitHub repository `edakturk14/greeting-card` for this project.
4. Import that repository into the existing Vercel account with the default `vercel.app` address. Set the root to this project and use Node 22. `vercel.json` provides build, function routes, headers, and daily cleanup. Set the above provider values plus `APP_ENV=production`, `APP_SECRET` and `CRON_SECRET` as server environment variables. The two secrets are already generated locally; keep them private. Set `PUBLIC_BASE_URL` to the canonical HTTPS deployment URL. Do not set `DATA_DIR` in production. Use `ANALYTICS_CAMPAIGNS` for approved nonpersonal campaign labels.
5. Before launch: verify real hosted create/photo/reload in an independent session; verify anonymous table/bucket reads and writes are denied; inspect the PostHog events in `analytics.md`; run authenticated cleanup; inspect cron status and generic social previews. Actual Supabase schema execution and Vercel routing/build remain unverified until account setup.

For local cloud testing, restart `npm start` after filling credentials. Leave `APP_ENV=development`; analytics excludes local traffic. Existing development files are preserved, not silently migrated into the cloud.

## Selected services

| Service | Verified free allowance | Limits and upgrade trigger |
| --- | --- | --- |
| Supabase Free | 500 MB database, 1 GB files, 5 GB uncached + 5 GB cached egress; 2 active projects | May pause after one inactive week; no automatic backups/SLA. Monitor egress/storage. Pro starts at $25/month; no automatic upgrade. |
| PostHog Cloud Free | 1 million product-analytics events/month, 1 project, 1 year retention | Without a payment card, usage stops at free limits rather than generating overage charges. No replay or autocapture enabled. |
| Vercel Hobby | Personal, noncommercial projects; 100 GB fast transfer, 1 million edge requests, 1 million function invocations, 4 active CPU hours, 360 GB-hours provisioned memory | Commercial use requires an eligible paid plan. Exhaustion can interrupt service. Hobby cron runs at most once daily. |

Sources: [Supabase pricing](https://supabase.com/pricing), [billing FAQ](https://supabase.com/docs/guides/platform/billing-faq), [PostHog pricing](https://posthog.com/pricing), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing). Recheck before upgrading. These plans suit an initial small personal pilot, not an uptime/durability promise. Paid overages are not enabled; any paid upgrade requires approval.

## Cost and abuse controls

- Durable atomic database limits: 5 creation attempts/IP/hour, 20/IP/day, 50 total/day, 1,000 lifetime reservations. Failed image attempts count. Review usage before raising the cap; reaching it pauses creation.
- Photos: JPG/PNG/WEBP, maximum 2 MiB and 20 megapixels. Server decodes, rejects unsupported/animated images, strips metadata, resizes to 1200 pixels maximum, and re-encodes JPEG at most 512,000 bytes. 1,000 cards bounds photos below about 512 MB, excluding manual uploads/other projects.
- Nothing uploads before Create card. Pending records track interrupted creations. Daily authenticated cleanup and opportunistic cleanup remove abandoned pending photos/rows older than one hour. Finished cards remain.
- Read/event rate limits are supplemental and per instance, not distributed DDoS protection. Shared NATs share quotas; attackers can exhaust global quotas. Photo views can exhaust egress while storage stays small. Monitor provider dashboards/firewall controls.
- No listing, card-update, or public upload API. RLS denies anonymous/authenticated table access; storage is private with no browser policies. Only the server uses service-role credentials. The link token grants read access.

## Data handling

Cards/photos remain until manually removed by the project owner. Browser storage holds anonymous analytics IDs, reveal flags, and session attribution, never the source-of-truth card database. Rate limits use HMAC-hashed IPs and expiring counters; the lifetime counter contains no IP. Providers may retain infrastructure logs including request paths; restrict access/retention in their settings. Analytics receives normalized paths only. Recipient HTML has noindex/noarchive and generic metadata, never a message/photo. A crawler possessing a token could retrieve the API; robots directives are not access control.

## Current Vercel setup attempt (18 September 2026)

The Vercel connector created production deployment `dpl_5uDbd18gCs8tU2nQ1VqQko1UiGHA` for `sendfiggle`, returning `https://sendfiggle-edakturk14s-projects.vercel.app`. An anonymous request redirects to Vercel authentication; this is not yet a verified public launch. The connected management tools return 404 for the new deployment, so build status and ownership/settings still need confirmation. No Supabase credentials are configured. Video generation remains disabled.
