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

`npx tsc --noEmit` and `npm run check:ui` are the available code checks. The existing Vite build currently fails before compiling the app because the installed Tailwind native Windows binding is missing/unloadable, and the configured preview server at port 8443 did not respond. No browser automation runner is installed, so the requested 390px and 1440px screenshots could not be generated or visually checked here. Please review sign-in, passenger home, active ride, driver dashboard, and admin overview at 360px, 390px, 768px, and 1440px in the running preview before release.
