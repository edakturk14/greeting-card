# Verification — 17 September 2026

## Passed locally

- API: required/invalid/long fields, origin checks, unsupported/corrupt/oversized photos, JPEG re-encoding, restart persistence, immutable links, private data paths, missing links, method restrictions, creation caps, authenticated orphan cleanup.
- Analytics collector contract: anonymous allowlist, no identifiers/content, no development collection. Upstream response mocked; hosted dashboard receipt not tested.
- Chromium desktop 1440px, independent recipient session 1100px, touch mobile 390px: live preview, invalid SVG rejection, valid image, preview with no save, fully opaque initial foil (all bitmap alpha values 255), reveal button, confetti, create, actual clipboard copy, fresh recipient context, mouse scratch auto-reveal, photo load, refresh persistence, separate-device unrevealed state, touch without page scrolling, reduced motion, long Turkish names, recipient creates another card, no horizontal overflow, sticker clearance, missing-card screen, zero local analytics requests.
- Visual inspection: desktop editor, revealed recipient, mobile foil, mobile editor with long accented names. Sticker ignores pointer events and stays outside name/foil/control areas.
- Text contrast checked numerically, muted colors darkened where necessary. White on cherry primary button is approximately 6.98:1. This is not a full WCAG audit.

Independent LAN testing caught insecure-context `crypto.randomUUID()` availability. Browser identifiers now use `crypto.getRandomValues()` with UUID formatting. Production uses HTTPS. Recipient HTML starts with its editor hidden to prevent an initial form flash.

Temporary screenshots: `/tmp/als-desktop.png`, `/tmp/als-recipient.png`, `/tmp/als-mobile-foil.png`, `/tmp/als-mobile-editor.png`. Not committed customer content.

## Not yet verified

Actual Supabase schema/RLS/storage, Vercel deployment/routing/cron, social crawler behavior, and PostHog dashboard receipt need account setup. Physical-device OS sharing and Safari/Firefox were not exercised. Touch used browser touch events in mobile emulation. This is not a deployed or fully cross-browser-tested launch.

## Snow-day visual update

The latest design replaces cream/cherry surroundings with the supplied reference's sky blue, blurred warm colors, snow-like dots, navy text, blue primary buttons, and pale yellow preview buttons. Pink sticker, ivory paper, handwritten names, and opaque silver foil remain. Copy has been shortened throughout the editor and sharing states.

`tests/design.cjs` passed on desktop and 390px mobile: card bob animation, freezing movement during scratching, button reveal celebration, reduced-motion suppression, long Turkish names, no horizontal overflow, and sticker clearance. Screenshots `/tmp/als-snow-desktop.png` and `/tmp/als-snow-mobile.png` were inspected. The earlier cherry-button contrast value describes the previous palette, not the current blue theme. Build passed after this update.

## Iceberg hangout update

Original inline SVG mountains, snowbanks, iceberg, and penguin now replace the abstract background. Clouds drift, snow falls, the penguin breathes/blinks/waves, and a card click triggers a one-shot bounce. Penguin clicks and reveals trigger a short hop and speech bubble. Keyboard users can use the nudge button. Scratch mode freezes card movement. A Pause motion control stops animations, and reduced-motion preferences suppress them. Speech is positioned on the ice outside card content.

Design browser checks passed: actual click starts card bounce, penguin click starts hop, pause stops cloud animation, preview freezes card, reveal works, reduced motion disables animations, mobile has no horizontal overflow, long Turkish names fit, sticker remains clear. API regression tests and production static build passed. Desktop/mobile screenshots inspected at `/tmp/als-iceberg-desktop.png` and `/tmp/als-iceberg-mobile.png`.

## Current compact message-first builder (supersedes previous layouts)

The main flow is preset → optional edit → Create link → Copy/share. Recipient and sender names are optional in browser, API, and Supabase schema. Cover is automatic. Photos and foil color are under Make it personal. Pip uses the same generated artwork, now beside the preview; no large footer or scenery. Message selection and saving trigger short reactions, with no keystroke progress system.

`tests/compact.cjs` passed with isolated temporary persistence, avoiding changes to the user's development cards. Verified desktop 1440×900 fit, first-screen Pip with no card overlap, preset creation/copy with no names or expanded settings, mobile clipboard, correct shared-card content in an independent context, native-share invocation with a stubbed OS interface, optional photos, preview without saving, mouse scratch and accessible reveal, Reset foil restoring full opacity without clearing inputs, editing retention, touch without page scroll, reveal persistence, long Turkish names, motion toggle, and reduced motion. API persistence/security tests and build passed.

Current screenshots: [Desktop](screenshots/desktop.png), [Mobile](screenshots/mobile.png). These show fictional preset cards and no personal data. Actual OS share delivery and hosted service integration remain unverified. The earlier `tests/design.cjs` and `tests/browser.cjs` cover superseded UI; use `tests/compact.cjs` for this version.

## Periwinkle composition and large Pip

Restored periwinkle across the scene, deep-blue type/actions, warm-white card/fields, and blush selected-message accents. Pip is no longer a circular avatar: the original fluffy PNG is shown at approximately 320px character width on desktop (420px image canvas), cropped at the lower edge of reserved space below the preview. Mobile uses a smaller in-flow image. No fixed character overlay or separate footer. Presets, optional settings, save/share, and recipient behavior are unchanged.

Asset inspection: `penguin-studio.png` is a single flattened image. `scene.js` animates the whole image; it contains no separate eye/eyelid layers or 3D rig. Genuine eye tracking and blinking are therefore not implemented, and no fake pupil overlays were added. A layered character asset with separately movable eyes/eyelids or a rigged model is required. Existing idle, pointer-translation (mouse only), and click/milestone reactions remain, with pause/reduced-motion controls.

Compact-flow tests passed at 1440×900 desktop and 390px mobile, including first-load Pip visibility, no overlap with the card, save/copy/open/reveal, reset, optional photo persistence, and reduced motion. An additional focused-input check at 390×430 simulates keyboard-reduced viewport space and checks Pip against message/name inputs and Create link. Actual physical-device keyboard behavior was not tested. Updated screenshots are `docs/screenshots/desktop.png` and `docs/screenshots/mobile.png`.

## Video-reference refinement and recording

Inspected the supplied 18.816-second reference video at multiple points across playback. Increased the visible desktop character to about 410px wide (545px image canvas), positioned at the lower scene edge. No circular avatar, caption, extra footer, speech bubble, or continuous character bobbing. The only Pip reaction is a brief saved-card celebration. Pointer translation was removed: a flattened image cannot provide actual gaze/head articulation, and the implementation does not fake eye tracking with whole-image movement or duplicate pupils. Layered eyes/eyelids or a rigged model are still needed for cursor/field gaze and blinking; these are not implemented features.

Added a clearer scratch-card headline, strengthened the foil's metallic shading, replaced patterned grain with seeded fine noise, and added a narrow directional sheen. Initial mobile preview is shorter so the opening view exposes more of the presets. Existing scratch coverage/reveal and reset logic are unchanged.

Full compact-flow regression checks passed again, including reduced mobile viewport with focused fields. Build passed. Initial screenshots: `initial-desktop.png`, `initial-mobile.png` (full page), `mobile-first-screen.png` (390×844 opening viewport), under `docs/screenshots`. Recording: `pip-and-scratch.webm`, generated against an isolated local test store. It shows preset selection, mouse scratching, reset, accessible reveal, save reaction, and copy. Demo links in the recording belong to that temporary test server, not a public deployment. Static-image Pip gaze/blinking remain the explicit asset limitation; creation and reveal are functional, not mocked. Native sharing was tested via invocation stub, not physical OS delivery.

## Final copy pass

Applied exact heading, supporting text, Your note label/placeholder, Create card, Your card is ready, Copy link, Share, Edit card, Scratch here, and Send one back. Short preset labels use independent `data-message` values, preserving all four complete original notes. Write my own sits beside the note label. Cover text derives from the optional recipient name and persists with each new card; existing saved cards remain unchanged. After reveal the cover becomes smaller so the note stays prominent. Send one back navigates to an empty builder without sending or creating anything.

Updated compact tests verify named cover persistence (“This one’s for you, Maya.”) and returning to the blank builder, in addition to the no-typing creation/copy flow. Initial screenshots and the short recording were regenerated with the latest copy. Pip remains silent; genuine gaze/blinks remain unavailable with the flattened PNG.

## Warm palette and dedicated Pip section

Supersedes bottom-left/full-blue composition. Builder uses cream #FFF8EF, plum #392B3A, raspberry #A93656 and warm-white fields/card. Bricolage Grotesque 600/700 replaces formal serif headings; DM Sans remains on controls and body. Dedicated butter-yellow #F8E7AA section directly follows the builder with supplied Small card / Big smile copy and moral-support sign-off. The same character was edited into `pip-cutout.png` with real alpha, keeping the fluffy appearance. Desktop/mobile compositing was inspected: no rectangular blue background patch. Existing one-shot save animation remains; gaze/eyelids are still unavailable in the flattened artwork.

Contrast ratios: white/raspberry 6.27:1, plum/cream 12.61:1, section body/yellow 5.84:1, muted body/cream 5.23:1. Disabled primary action is intentionally muted. Compact-flow tests passed with Pip contained below the builder and clear of inputs/buttons. Build passed. Initial desktop/mobile screenshots and demo were regenerated; screenshot links remain unchanged.


## Fig / purple palette — September 17, 2026

Renamed visible mascot copy and image alternative text to Fig. Updated builder, success, recipient styling and generic social cover to the coordinated purple theme. Transparent existing artwork and success animation are unchanged; the flattened asset still cannot provide independently moving eyes. No saved cards, tokens or storage configuration were changed.

Browser checks passed: no-typing desktop/mobile preset → create → copy; new recipient content and persisted photo; touch scratch, reset, accessible reveal, remembered reveal; optional names and long Turkish names; editing retained inputs; motion toggle/reduced motion. Build passed. Updated initial desktop/mobile captures and `fig-and-scratch.webm` are in `docs/screenshots/`. Native sharing is tested with a browser stub, not an actual OS share target.

Contrast: primary white/purple 7.01:1; main text/page 13.61:1; supporting text/page 5.25:1; selected text/background 5.74:1. Section supporting text is slightly deeper (#675470) for accessible contrast on lilac.

Follow-up: removed the Pause/Play motion control at user request. System reduced-motion support remains active.

## Recipient envelope and dropped photos

Recipient pages now begin with a purple envelope. Clicking, tapping or pressing Enter opens the flap and brings out the existing card; the note remains hidden under foil until revealed. The card is inert and hidden from accessibility APIs while the envelope is closed. Reduced-motion opens immediately. Previously revealed cards retain their per-device reveal state after opening. Builder previews are unchanged.

Optional photo upload accepts one dropped file through the same decoding, format, 2 MB and 20 MP checks as the file picker. Invalid files leave an existing valid photo intact. A missed file drop does not navigate away from the page.

The compact browser suite passed with an actual DataTransfer image drop, save and separate-session recipient photo check. Additional envelope checks cover keyboard opening, touch/reduced motion, mobile overflow and invalid SVG drops. Envelope screenshots/recording use a mocked test card; persistence is verified by the separate compact suite.

## Local creation quota fix

The local app hit its normal five-reservations-per-hour cap. Added explicit LOCAL_TEST_MODE=1 in the ignored local environment. Only APP_ENV=development with file storage, no cloud credentials, no Vercel and no production NODE_ENV can enable it. It bypasses durable launch quotas locally; the 200/hour local request safety cap and all input/upload validation remain. Production keeps its original limits. No existing cards or counters were deleted.

Verified against the actual running localhost:3001 instance after its quota was exhausted: preset → successful 201 creation → exact clipboard URL → separate mobile browser context → envelope → reveal → refresh with remembered reveal → Send one back. One QA card was saved. Server regression tests passed, including continued normal quota enforcement and rejection of the testing bypass in production/cloud environments.

## Envelope photo concealment regression

Reproduced the reported leak using a real saved portrait photo and a long note: the closed envelope screenshot contained 14,635 visible test-photo pixels. The scratch layer's explicit visibility overrode inherited hidden visibility. Closed envelopes now hide the complete card subtree with zero opacity and hidden descendant visibility, while retaining its layout for canvas sizing and opening animation.

`tests/envelope-photo.cjs` passes on desktop and touch/mobile with reduced motion: no photo pixels in closed-envelope screenshots; no photo pixels beneath untouched foil after opening; photo appears after reveal; reloading a previously revealed card conceals the photo again until the envelope opens. Saved data and remembered reveal behavior are preserved. Build passed.

## Minimal reference redesign

Builder now uses Geist, neutral white pill controls and a larger Instrument Serif paper card, with a seven-second gentle float. It stops for hover/focus, stays stationary during scratch preview, and respects system reduced motion. At the user's follow-up request the motion toggle, Reveal preview shortcut and Just because text were removed. The foil remains the accessible preview entry point. Automatic reveal threshold is 43%; reset retains the current message/photo.

Further refinements: default cover verified on one line at 1440/390/320px; expanding Make it personal no longer moves the neighbouring card (desktop/mobile geometry checked); tighter editor/disclosure spacing; Fig-in-a-heart header/favicon/touch assets; duplicate recipient caption hidden. Recipient envelopes and Fig section remain intact. Header icons are rendered by scripts/heart-logo.cjs (run after brand-assets.cjs if regenerating assets).
