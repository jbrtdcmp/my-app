# PASAKJA UI sizing audit

## Audit findings and sizing changes

The audit covered Auth, Onboarding, Passenger Home, Finding Driver, Ride Tracking, Bookings, Alerts, Profile, Driver Dashboard, Admin Dashboard, Public Trip, and shared navigation/dialog/map controls. Before the pass, control sizing came from a mix of Tailwind utilities and local CSS: primary buttons were at least 44px with some larger vertical padding; inputs were at least 44px; body text was 16px; headings reached 24px; cards used inconsistent 16–20px padding/radii; the app bar was 56px; map and sheet handles used one-off sizes. Arbitrary height classes and 9–10px labels were present in navigation/onboarding/ride views.

| Element | Before | Now |
| --- | --- | --- |
| Default button | 48px | 40px |
| Main action | 56px | 44px |
| Input | 48px | 40px |
| Body text | 15–16px | 14px |
| Screen title | 20–24px | 18px |
| Card padding | 16px | 12px on phone |

Sizing tokens live in `src/styles/tokens.css`, and Tailwind typography utilities map to that scale in `src/index.css`. Shared controls and layout primitives are in `src/components/ui.tsx`. Existing screens inherit compact button/input typography and control dimensions from the global shared rules; Auth also uses the shared input/select components. Desktop control sizes remain unchanged from mobile, with wider page/card padding and dialog containers.

## Accessibility notes

1. Pinch-zoom is disabled with `maximum-scale=1` to prevent iOS input auto-zoom and give a native-app feel; this is a deliberate trade-off.
2. The minimum tap target is still 44×44px through transparent hit-area extensions, even though some controls are visually smaller.
3. 40px controls were chosen as a thumb-friendly size that also works with a mouse on desktop.

## How to resize the whole app

Edit `src/styles/tokens.css`; control heights, typography, card padding, radius, and shared spacing read from those variables. To use the ultra-compact preset, copy its commented values into the active variables in the same file. Keep controls at least 36px, body text at least 13px, and hit areas at least 44×44px.

Run `npm run check:ui` to check the source for arbitrary sizing utilities and breakpoint-specific control/text sizing, and validate the control-size tokens. This is a dependency-free source check; Vitest is not installed, so no Vitest test was added under the task's no-new-dependencies constraint.

## Verification limits

`npx tsc --noEmit`, `npm run check:ui`, and `npm run build` all pass. The earlier Tailwind native Windows binding failure no longer occurs.

`npm run capture:ui` (`scripts/capture-ui.mjs`, Playwright) does the following. Demo credentials come from the environment (`PASAKJA_DEMO_{PASSENGER,DRIVER,ADMIN}_PHONE`, `PASAKJA_DEMO_PASSWORD`); they are never printed. The end-to-end ride flow only runs when `PASAKJA_ALLOW_WRITES=1` because it creates a real ride.

Committed screenshots (small set, `docs/ride-flow-after/`):
- `onboarding-390`, `onboarding-1440`, `sign-in-390`, `sign-in-1440`.
- For each role, `home`, `alerts`, and `profile` at 390 and 1440.

The full width matrix (every screen at 360, 390, 768, 1440) is written to `docs/ride-flow-after/full/`, which is gitignored. It is not limited to the committed set.

The overflow audit covers the public screens and, when the API is running, each role's home, rides, alerts, and profile at all four widths. It only reports a document that scrolls sideways, or an element overflowing the viewport that is not inside a Leaflet map (`.leaflet-container`) or a horizontally scrollable container (a chip row with `overflow-x: auto/scroll`). Reported elements include their text or `aria-label` so they can be located. The admin overview is also checked explicitly for sideways scrolling at 360, 390, and 768, reporting the offending element's text.

The role-navigation audit signs in as each role and clicks the bell and avatar on the role's top-level screens, asserting the URL stays inside that role's prefix. The Back arrow is only tested from an inner screen that actually renders it (inside an active ride), since top-level tabs do not show it. Sign-in waits for the URL commit plus a role-specific element because map tiles and polling keep `load` from ever firing.

The end-to-end ride flow (only with `PASAKJA_ALLOW_WRITES=1`, since it creates a real ride) opens two browser contexts with geolocation granted at a fixed in-area position. It stops with a clear FAIL if the passenger already has an active ride; otherwise it books a ride, polls for the driver's matching request card (up to 20s) and accepts only that ride, waits for the passenger to reach `/passenger/ride/:id` (up to 15s), checks the Back arrow, checks the Active-ride-banner/municipality-switcher overlap at both 360 and 390, then clicks the bell mid-ride and resumes from Bookings and the home banner (banner polled up to 10s). A `try/finally` always cancels the ride it created and prints the ride id if cancellation fails. Any FAIL sets a non-zero exit code.

Parts that need the API running (`/api/health` reachable, i.e. Apache + MySQL up):
- Signed-in screenshot capture and the signed-in overflow audit for every role.
- The bell/avatar/back navigation checks and the admin-overview sideways-scroll check.
- The two-context end-to-end ride flow and the Active-ride-banner/municipality-switcher overlap check, which also need `PASAKJA_ALLOW_WRITES=1`.

Without the API, only the public onboarding/sign-in screenshots and their overflow checks run. Please still review the committed images and the full matrix in the running preview before release.
