# Video cards beta

SendFiggle now has **Scratch card** (default) and **Video card · Beta** tabs. The video editor accepts one image and an editable short note. Existing scratch cards, URLs, storage, metadata and Fig’s section are preserved.

## What is implemented vs. verified

**Implemented:** real fal queue integration, stock-voice speech → measured audio → audio-driven avatar animation, durable jobs and budgets, signed webhooks, recovery polling, private resume tokens, own-storage MP4 sharing/download, recipient envelope/playback, analytics events and a separate media bucket.

**Verified without provider charges:** durable job recovery, concurrent duplicate submissions, all spending/rate caps, signature verification, overlong speech prevention, failed/uncertain jobs, access controls, real PostgreSQL reservation-function execution, and mocked desktop/mobile browser flows. The fixture MP4 has a real audio track (a test tone) and video track (a plain lavender frame). It is **not generated speech or an animated person/pet**. Mock mode exists only in a separate test executable with dependency injection and a visible test-fixture notice; production has no mock switch.

**Still unverified:** real fal queue/webhook traffic, provider lip-sync/voice quality, pet results, hosted Supabase storage, actual PostHog delivery and production Vercel routing/media transfer. No fal key, cloud credentials or public URL were configured during implementation. Generation remains unavailable in the normal local app until configured. No paid calls were made.

## Models, inputs and cost

Checked against official fal documentation on September 18, 2026:

| Stage | Endpoint | Fixed application input | Published rate |
| --- | --- | --- | --- |
| Speech | `fal-ai/elevenlabs/tts/multilingual-v2` | `text`, stock `voice: Rachel`, normal speed; no cloning or voice references | $0.10 / 1,000 characters |
| Avatar | `fal-ai/kling-video/ai-avatar/v2/standard` | validated `image_url`, measured `audio_url`, default `prompt: .` | $0.0562 / output second |

Sources: [TTS schema](https://fal.ai/models/fal-ai/elevenlabs/tts/multilingual-v2/api), [TTS price](https://fal.ai/models/fal-ai/elevenlabs/tts/multilingual-v2), [avatar schema](https://fal.ai/models/fal-ai/kling-video/ai-avatar/v2/standard/api), [avatar price](https://fal.ai/models/fal-ai/kling-video/ai-avatar/v2/standard), [queue](https://fal.ai/docs/documentation/model-apis/inference/queue), [webhook verification](https://fal.ai/docs/documentation/model-apis/inference/webhooks).

The editor enforces **20 words / 200 characters**. A 10-second result plus 200 characters costs approximately **$0.582** in model charges; a 5-second card with 100 characters is approximately **$0.291**. Each attempt atomically reserves **65 US cents**, including a buffer. Storage, bandwidth and provider price/tax changes are not included in this estimate. Recheck rates before enabling the beta; this fixed reservation must be increased if pricing changes.

Audio is downloaded and its real media duration measured before any avatar submission. If it exceeds 10 seconds, generation stops with a request to shorten the message. It is not cut off. Speech-only cost remains accounted for. Final MP4 validation requires both picture and sound tracks and a duration at most 10 seconds. This checks playable structure/duration, not whether the words or lips are correct; real listening/visual QA is required.

To and From are required for new scratch and video cards. Photos and foil choices remain optional for scratch cards. Existing links without names continue to work.

## Setup

1. Run the full, rerunnable [`db/schema.sql`](../db/schema.sql) against Supabase. It adds `video_jobs`, server-only reservation/CAS RPCs and the **private `video-media` bucket**. The original `card-photos` bucket keeps its JPEG-only rules. Missing card types continue to mean scratch cards.
2. Put these only in the server environment: `FAL_KEY`, `FAL_WEBHOOK_USER_ID`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_SECRET` (32+ characters), and `CRON_SECRET`. `FAL_WEBHOOK_USER_ID` must match the account ID in fal’s signed webhook headers; use your fal account details/support to obtain it, not an unverified callback.
3. Set an explicitly connected HTTPS `PUBLIC_BASE_URL`. Webhooks cannot reach localhost/private LAN addresses. Use the working hosting domain; do not use sendfiggle.com until connected. Configure Vercel environment variables and redeploy.
4. Review budget/limit defaults below. Set `VIDEO_ENABLED=1` only when ready to allow model charges. Do not turn it on merely to run automated tests.
5. Make one real short human-photo generation and one consented pet-photo generation. Open/download each result, listen to the whole message, inspect lip movement and visual artifacts, and confirm the final shared URL serves our storage. Inspect fal charges and webhook receipt. Run another browser/device and refresh recovery check. If pets distort or fail to speak convincingly, describe that honestly and restrict the beta to successful input types.
6. Confirm server analytics events in PostHog and review storage/egress dashboards. Nothing in this change provisions a paid service or purchase.

Free-to-try means the operator pays provider charges within these caps; it does not mean fal inference is free.

## Default limits

| Control | Default |
| --- | --- |
| Per signed visitor cookie / UTC day | 1 attempt |
| Per HMAC-hashed IP / UTC day | 2 attempts |
| Global / UTC day | 3 attempts |
| In-flight jobs | 2 |
| Daily reservation budget | 200 cents |
| Total beta reservation budget | 1,000 cents |
| Reservation per attempt | 65 cents |
| Maximum completed MP4 | 30 MiB / 10 seconds |

The `VIDEO_*` settings are in `.env.example`. Invalid or zero limit values disable new generation. `LOCAL_TEST_MODE` never bypasses these controls. Changing `VIDEO_ENABLED=0` stops new attempts; already reserved jobs may finish and existing cards still play. Presets, typing and tab selection do not start new paid jobs.

Daily budgets are grouped by the job’s UTC **reservation day**, not provider invoice-posting time. The total cap includes all reservations/committed costs. Anonymous cookies are not identity verification: clearing cookies can reset the visitor identity, while independent IP/global/budget caps remain. Shared networks share IP quotas. Add stronger abuse controls before a larger public launch if needed.

## Durable state and idempotency

```text
uploading → voice_ready → voice_submitting → voice_pending
  → measuring → audio_ready → video_submitting → video_pending
  → saving → ready
                   ↘ failed / review
```

Every transition is stored before proceeding. PostgreSQL serializes reservations with an advisory transaction lock; versioned compare-and-swap updates claim stages and import leases across instances. Jobs store provider request IDs, output references, input/media references and cost status. No work is detached after an HTTP response.

The creator’s random resume token is distinct from the random read-only card token. Only its hash is stored server-side. The creator keeps the token/draft in that browser’s local storage and sends it in an Authorization header, not an analytics event or URL. Clearing browser storage loses creator recovery access; it does not delete a sent card. Idempotency uses the attempt UUID plus resume-token hash and checks a content fingerprint. Double clicks or replaying the same attempt cannot reserve or submit again.

Queue submissions disable fal inference retries and perform no transport retry. An interrupted submission can mean fal accepted paid work but the response was lost. Such jobs deliberately remain `*_submitting` with their full reservation held. A verified matching webhook can recover them; absent that, an operator must reconcile the existing provider request rather than create another automatically.

Signed callbacks check ED25519 against fal’s JWKS, the raw-body digest, account user ID, request ID and ±5-minute timestamp. A per-stage secret callback nonce correlates even a lost submit response. Duplicate/stale callbacks are harmless. Browser resume polls use stored request references. The existing authenticated daily cleanup route also advances a small bounded batch of pending jobs; it is a safety net, not a claim of rapid unattended recovery. A verified voice callback can submit the already-authorized animation stage. Closed browsers can still complete through callbacks.

## Media ownership and cleanup

Hosted playback redirects to a signed read URL in our own private Supabase bucket, keeping large MP4 responses out of the serverless function. Opening the stable card media endpoint issues a fresh URL. Local mocked tests stream fixture media with range support; hosted playback/download still needs verification against the configured Supabase project.

Images reuse the existing decoder, size/pixel checks, metadata stripping and JPEG encoding. Provider inputs use short-lived signed URLs into `video-media`. Generated audio and MP4 are copied to that bucket. The saved MP4 is reread and hash-checked before marking a card ready. Recipient/playback/download URLs are served by SendFiggle, including Range support; provider URL expiry does not break a completed card.

Uploads that never reached paid work expire after an hour and are cleaned by the authenticated cleanup path, with their unspent reservation released. Failed/uncertain paid jobs keep their evidence and held costs for reconciliation. Completed cards/media remain until the owner removes them. Inputs/audio are retained with the job for recovery/editing; monitor storage and introduce an explicit retention policy before scaling. No bucket is publicly listable.

## Cost reconciliation and operator recovery

Jobs record `reserved_cents`, `charge_cents`, an estimate when measured, and `cost_state`. On success, the reservation becomes `committed_ceiling`: it conservatively continues to count the full 65 cents until actual billing is reviewed. This avoids silently treating an estimate as a verified invoice. Known overlong-speech jobs retain only their speech estimate; uncertain provider failures retain the full reservation. No uncertain charge is automatically released.

An operator with server credentials can attach a request ID found in their fal dashboard, without creating a new paid request:

```sh
node --env-file=.env.local scripts/reconcile-video.mjs \
  --job JOB_ID --stage voice --request-id EXISTING_FAL_REQUEST_ID
```

After confirming actual billing for a terminal job, settle the ledger explicitly:

```sh
node --env-file=.env.local scripts/reconcile-video.mjs \
  --job JOB_ID --settle-cents 58 --billing-verified
```

Do not guess a billed amount. If charges exceed the reservation, disable new generation and review rates/caps before proceeding. The script prints only job ID, stage and accounting status, never private content or credentials.

## Analytics and verification

New events: server `video_started`, `video_completed`, `video_failed`; browser `video_shared`, `video_played`. Server terminal events emit after a successful durable transition and use a separate random analytics insertion ID, not a request/resume/share token. No notes/photos/video frames or full card URLs are included. Existing referral/UTM filtering applies. Best-effort analytics can still be lost across a process crash or network outage; counters are not billing evidence.

```sh
npm test                 # API, video-job and actual Postgres SQL tests; no provider calls
npm run test:ui          # existing scratch flow
npm run test:video       # injected test provider; isolated temporary storage
node tests/envelope-photo.cjs
npm run build
```

The video browser test covers tab draft preservation, photo/preset, save/resume, private access denial, real MP4 audio-track validation, copy, fresh recipient envelope/playback without autoplay, generic metadata and mobile layout. [Desktop screenshot](screenshots/video-desktop.png), [mobile screenshot](screenshots/video-mobile.png), [mocked recording](screenshots/video-flow-MOCKED.webm). These demonstrate integration and UI only, not real generated speech, human/pet animation or lip-sync quality.

## Action instructions

The action presets and editable action field are separate from the spoken message. Actions go only to Kling’s `prompt`; ElevenLabs receives only the spoken message. Actions are limited to 300 characters and saved with the private generation job, including its idempotency fingerprint. Old jobs without an action keep their original default prompt. Actual gesture quality, particularly on pets, remains unverified until live provider testing.
