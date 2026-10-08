# PASAKJA spacing consistency audit

## Audit scope and findings

Reviewed the screen and shared component TSX/CSS under `src`, including Tailwind spacing utilities, local spacing declarations, responsive spacing overrides, screen insets, and shared overlay controls. The initial source used fractional utilities (`0.5`, `1.5`, `2.5`, `3.5`), a custom 20px `foundation-5`, 6px form label gaps, 5px helper/error margins, mixed 8/12/16/20px card insets, and repeated spacing assembled from both `space-y` and child margins. Screen insets also varied between `p-4`, `px-4`, `p-5`, and `p-6`; some pages changed these again at desktop breakpoints.

| Screen / area | Issues found | Normalization applied |
| --- | --- | --- |
| Onboarding | Content panel and slide content use hand-set padding and sibling gaps; fractional skip-button vertical spacing. | Fractional spacing is mapped to approved tokens; shared token scale added. Full page composition still has screen-specific spacing. |
| Sign in / sign up | Responsive page inset was hand-coded; form fields used `space-y-4`, label `mb-1`, and independent notice/helper offsets. | Responsive auth inset moved to semantic page-padding tokens; form field shared label/message spacing is 4px and no longer double-counts label/helper margins in `FormField`. |
| Passenger home / booking | Booking sections, chips, ride types, and note/error blocks mix margins, fractional gaps, and distinct padding values. | Fractional utilities map to scale tokens; semantic section/card/chip roles are available for consistent reuse. Existing booking-specific groups remain laid out by their screen markup. |
| Finding driver | Status/content groups rely on screen-local spacing and sheet/card insets. | Shared card/sheet tokens and reusable layout primitives are available; inspect the final sheet position in the preview. |
| Active ride / tracking | Sheet content uses `space-y` alongside local offsets; dialogs use 24px action gaps and mixed `mb` offsets. | Shared sheet/dialog padding tokens; dialog actions use 8px, body-to-actions 16px, and the handle no longer has a negative-margin offset. |
| Bookings / alerts | Header, filters, alert rows, and cards have different inset and sibling spacing patterns, including fractional pill padding. | Fractional spacing is mapped to approved tokens; shared list/card padding is now token-driven. |
| Profile | Hero, stat grid, settings groups, and saved-place rows combine several padding/gap values; profile hero overlap is a deliberate negative offset. | Shared card padding and responsive page/card tokens are available; the intentional hero overlap remains screen-specific. |
| Driver dashboard | Request, status, and ride cards have local insets and stacked content spacing. | Shared card/list spacing tokens are available; per-screen composition remains in the driver markup. |
| Admin overview / tools | Main content used `p-4` / `md:p-6` with a separate 24px `space-y`; dashboard cards and table rows have varied insets. | Main content now uses `.admin-page-content` and semantic page-padding/section-gap tokens at mobile and desktop. |
| Public trip | Public page shell, map notices, and details use independent padding/gap utilities. | Shared semantic scale and card tokens are available; public share page keeps its own responsive shell layout. |
| Shared navigation / controls | App bar inset was duplicated in markup; list rows used 10px vertical padding; tabs used 4px item padding; fields and dialog buttons used off-role gaps. | App-bar inset comes from its token; list rows use 12px all around; tab item padding uses 4px hit-area padding plus existing control height; form/dialog spacing is normalized. |
| Sticky actions / toasts / empty states | Shared sticky action layout and screen clearance were not represented by a common primitive. | Added `StickyActionBar` and `Screen` variants to reserve tab/sticky/safe-area space. Existing screen-specific sticky/toast placements still need visual verification. |

The shared primitives are in `src/components/ui.tsx`: `Screen`, `Section`, `SectionTitle`, `Stack`, `Inline`, `Grid`, and `StickyActionBar`. Each has a short spacing-rule comment. Use `gap="xs|sm|md|lg|xl|2xl"` rather than custom numeric values. `Screen` supports `withTabs` and `withSticky` so content can reserve persistent bottom controls. The Admin main content and Auth form shell have been moved to semantic responsive spacing classes. Other screen composition has not yet been rewritten wholesale to primitives because the current screens combine independently scrolling areas, map overlays, and deliberate overlaps; changing those wrappers without a live visual preview risks altering the layout structure.

## Semantic spacing roles

| Role | Value |
| --- | ---: |
| Scale: xs / sm / md / lg / xl / 2xl | 4 / 8 / 12 / 16 / 24 / 32px |
| Page inline padding, phone / wide | 16 / 24px |
| Page top / bottom | 16 / 16px |
| Major section gap / title-to-content | 24 / 8px |
| Card list gap / card padding phone / wide | 12 / 12 / 16px |
| Inside-card gap / tight label-value | 8 / 4px |
| Form field gap / label / helper or error | 12 / 4 / 4px |
| Form group to submit / button row | 24 / 8px |
| Icon-to-text / small button icon-to-text | 8 / 4px |
| List row padding / divider | 12px / 1px |
| Bottom sheet padding / section gap / handle inset | 16 / 16 / 8px |
| Dialog padding / title-body / body-actions | 16 / 12 / 16px |
| Chip gap / wrapped row gap / stat grid gap | 8 / 8 / 12px |
| Top app bar horizontal inset / icon-title gap | 16 / 8px |
| Bottom tab item padding / outer margin | 8px / 0px |
| Desktop sidebar padding / item gap / section gap | 16 / 4 / 24px |
| Desktop content max width: forms / booking / dashboards | 480 / 420 / 1200px |

Allowed non-scale exceptions: 1px borders, 2px focus rings, and extra transparent tap-area padding. Safe-area insets and persistent bar heights are added through their dedicated layout tokens.

## How to adjust spacing

Edit the spacing role variables in `src/styles/tokens.css`. Tailwind named spacing theme entries and shared layout CSS in `src/index.css` reference those roles. To make the whole app tighter or looser, adjust the six base scale variables (`--space-xs` through `--space-2xl`) and the semantic roles that intentionally need their own rhythm in the same file. Keep each role mapped to one of 4, 8, 12, 16, 24, or 32px. Do not add raw spacing values to screen markup; use a semantic class or one of the layout primitives.

`npm run check:ui` now rejects arbitrary spacing utilities, spacing utilities outside the approved scale (while permitting the existing `p/px/py-5` card aliases that resolve to 12/16px), and breakpoint-specific spacing utilities in screens. The source check is dependency-free. Vitest is not installed, and the brief prohibits adding dependencies, so computed-style Vitest tests were not added.

## Verification

`npm run check:ui` passes and `npx tsc --noEmit` passes. The app did not have a reachable preview server or browser automation available during this pass, so layouts could not be checked at 360px, 390px, 768px, and 1440px; keyboard-open and notched-device checks were also unavailable. Before release, review sign-in, passenger home, active ride, driver dashboard, and admin overview at those widths and verify toasts/sticky actions stay above bottom navigation. Dark-mode comparison and before/after screenshots were not produced because the project does not currently expose a working preview/browser capture environment.
