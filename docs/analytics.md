# Hosted analytics

The integration targets **PostHog Cloud**. It is implemented but credentials were unavailable, so hosted dashboard receipt is **not verified**. Local traffic generates no events. A mocked collector contract test is not proof of live delivery.

## Dashboard access

Sign in at [US PostHog](https://us.posthog.com) or [EU PostHog](https://eu.posthog.com), matching your region. Inspect Activity/live events after using the production HTTPS site. In Product analytics → Insights, create Trends and Funnel insights and save them to a standard PostHog dashboard. No custom dashboard is built. Use unique users for visitors, total events for actions.

| Question | Events |
| --- | --- |
| Landing visitors / editor opens | `landing_visited`, `creator_opened` |
| Preview attempts | `preview_tried` |
| Successfully saved cards | `card_created` (server, after saving) |
| Copy and native share | `copy_link_clicked`, `native_share_action` |
| Recipient visitors / opens | `recipient_opened` |
| Scratch participation | `scratch_started` |
| Completed reveals | `reveal_completed`, method=scratch or button |
| Make a card clicks | `recipient_make_card_clicked` |
| Subsequent attributed creations | `recipient_became_creator` (server, after saving) |

Use creator_opened → card_created as the main creation funnel; preview is optional. Recipient funnel: recipient_opened → reveal_completed → recipient_make_card_clicked → recipient_became_creator. Separate page_type=landing/recipient. Break down by referral_source or UTM properties.

## Privacy and counting

- No SDK, autocapture, replay, full URL, token, name, message or photo sent. Server whitelists names/properties. Recipient pathname is `/c/:id`. Person profiles and GeoIP processing are disabled; `$ip` is null. Providers still process ordinary infrastructure metadata.
- Referrals become broad categories, never raw URLs. UTM values must match `ANALYTICS_CAMPAIGNS` (default launch,instagram,tiktok,newsletter,friends); other labels become `other`. Only approve nonpersonal labels.
- An anonymous browser UUID approximates unique visitors. Cleared/blocked storage and new devices change identity; shared browsers undercount people. Do Not Track disables events. Network failures/ad blockers undercount; events are best effort, without automatic retries.
- Development/private-network traffic is excluded. Once-per-page guards avoid repeated startup/scratch/reveal events. Reload counts another open, generally the same unique visitor. Remembered reveals do not emit another reveal.
- Native share counts invocation, including a canceled OS sheet; copy counts clicks. Neither proves delivery. Preview never counts recipient visits.
- Attribution follows Make a card within that browser session, without recording which card. No cross-device or per-card conversion tracking. Multiple cards per creator mean event ratios are not person conversion rates.

## Remaining live verification

On production: preview, create, copy/share, open in a separate browser context, reveal, click Make a card, create another. Confirm events and normalized paths in PostHog. Inspect for absence of names/messages/photos/tokens. Exercise both reveal methods. Production QA counts unless filtered by a QA campaign. Do not claim dashboard verification before this check.

## Video beta

Server events: `video_started`, `video_completed`, `video_failed`. Browser events: `video_shared`, `video_played`. These use the same sanitized context and normalized recipient paths. Distinct random analytics insertion IDs do not contain job/share/resume tokens. Server completion/failure fires only after a durable terminal transition. Live delivery remains unverified. See [video beta](video-cards.md) for mocked verification and recovery limitations.
