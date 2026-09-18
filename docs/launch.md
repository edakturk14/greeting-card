# Launch setup and costs

Reviewed 18 September 2026. No paid service was provisioned. The project repository is https://github.com/edakturk14/greeting-card.

## Live deployment

- Public URL: https://sendfiggle.vercel.app
- Vercel project: `sendfiggle` on the existing Hobby account.
- Supabase resource: `sendfiggle`, project reference `plabucqmyktefompiayg`, region `iad1`, verified `free` billing plan.
- Production deployment: `dpl_4aJ32f3ziewsDy6CzZH9ip1EJayN`, READY on 18 September 2026.
- `PUBLIC_BASE_URL` uses the public URL above. Paid video generation is disabled; local test-mode quota bypass is disabled in production.
- Schema applied to the real database with certificate-verified TLS. Three RLS-protected tables, revoked anonymous table reads, and two private buckets verified.
- Live desktop/mobile browser check passed: public access, required names, create with photo, remove/re-add photo, copy link, separate recipient session, concealed photo before envelope opens, reveal, persistent photo after refresh and return to builder.
- PostHog analytics is not configured. Real video generation remains unverified and off.
- GitHub auto-deployment connection was rejected by Vercel. Current deployment is a successful CLI deployment; future updates can use `npx vercel --prod`. Grant the Vercel GitHub app access to `edakturk14/greeting-card` before enabling automatic deployments.
- Existing local cards are preserved and have not been migrated to Supabase.

## Database maintenance

`node --env-file=.env.production.local scripts/setup-database.mjs` reapplies the idempotent schema in a transaction and verifies access controls. Pull the integration environment to that ignored file first. Secrets are never logged. `db/supabase-ca.crt` is Supabase’s public database CA certificate, downloaded over HTTPS from its official downloads bucket; TLS verification stays enabled.

Use `node tests/live.cjs` for an explicit production smoke test. It creates one real test card and counts against normal quotas. No paid generation occurs. Local screenshots are under `docs/screenshots/live-*`.

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

