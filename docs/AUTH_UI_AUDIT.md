# PASAKJA auth UI audit

## Root cause

The partial styling is not caused by `tokens.css` or a missing Tailwind content
glob. `src/main.tsx` imports the global `src/index.css`, and `index.css` imports
the Poppins font and `src/styles/tokens.css` before Tailwind. This is the correct
order for the token variables and Tailwind theme mappings.

This project uses Tailwind CSS v4 through `@tailwindcss/vite`; there is no
`tailwind.config` file, so there is no `content` array to omit source folders.
Tailwind v4 scans project source files automatically. In `Auth.tsx`, the
interpolated class names are the custom modifiers `auth-screen--${mode}` and
`auth-form-shell--${mode}`, not dynamically assembled Tailwind utilities.
There are no `gap-${n}` / `text-${size}` utilities in the auth screen.

The actual cause is incomplete auth component styling. The global stylesheet
has a handful of layout selectors (`.auth-screen`, `.auth-form-shell`,
`.auth-form-card`, `.auth-submit-group`, and `.auth-forgot-link`), but does not
define most classes that Auth renders. As a result, Tailwind cannot style the
custom `auth-*` selectors, and some elements fall back to browser defaults. The
screen also layers Tailwind utilities over the shared control CSS: the shared
input rule sets 40px sizing, while earlier base CSS sets a 44px minimum; the
auth form adds oversized vertical padding and 2px borders. This creates
inconsistent controls and does not match the tokens.

## Checklist findings

1. **Stylesheet imports:** `main.tsx` imports `index.css`. In `index.css`, the
   Poppins font and `tokens.css` are imported before Tailwind. The import chain
   exists and its order is correct.
2. **Tailwind scan and dynamic utilities:** no Tailwind config exists (Tailwind
   v4 automatic source detection is in use). No dynamically composed Tailwind
   utility was found in Auth. The two mode-interpolated auth class names are
   custom selectors and need explicit CSS definitions; role-selection classes
   choose complete static class names.
3. **Auth class coverage:** the following Auth-specific class names have no
   matching CSS rule in the global stylesheet or a component stylesheet:
   `auth-screen--login`, `auth-screen--register`, `auth-welcome-panel`,
   `auth-welcome-panel__brand`, `auth-welcome-panel__tagline`,
   `auth-welcome-panel__points`, `auth-form-shell--login`,
   `auth-form-shell--register`, `auth-heading`, `auth-back-button`,
   `auth-mobile-brand`, `auth-field-error`, `auth-role-field`,
   `auth-role-options`, `auth-role-option`, `auth-role-option--selected`,
   `auth-role-option__radio`, `auth-role-option__copy`, `auth-field-stack`,
   and `auth-input`. `.auth-screen`, `.auth-form-shell`, `.auth-form-card`,
   `.auth-submit-group`, and `.auth-forgot-link` do have rules. Shared
   primitives (`app-screen`, `app-stack`, `app-inline`, `app-input`,
   `app-select`, and `app-button`) are styled. Tailwind utility classes used
   with those primitives are available through the CSS-first Tailwind theme.
4. **Component-library/reset conflicts:** the auth UI does not use shadcn/ui or
   another component library. Tailwind Preflight and the app's global
   `input`/`select` rules both apply; shared controls are then modified by
   one-off auth utilities (`py-3`, `border-2`, etc.). This compounds sizing and
   border differences rather than consistently using the shared tokens.
5. **Role selector:** it uses native radio inputs. The intended hiding class
   (`auth-role-option__radio`) has no rule, so the native circles are visible.
   The icon and copy are sibling nodes and the missing role-card styles mean
   there is no flex/stacked-card layout.
6. **Error icon:** `FieldError` renders the text `!` rather than an icon
   component.
7. **Premature errors:** `fieldErrors` starts empty, and field errors are
   populated on blur or submit, so validation messages are not intentionally
   computed during the initial render. A parent-provided `notice` is rendered
   immediately as a status message and is separate from field validation.
   Failed login currently marks both fields invalid, but `authError` itself is
   never rendered as a general alert.

## Related behavior gaps found during diagnosis

- Login's phone/password inputs do not populate `fieldsRef`, so the existing
  failed-submit focus attempt cannot focus them. Only the name input is
  registered.
- `handleBlur` skips optional empty fields, but has no touched-state tracking;
  editing a field clears its error even if the new value remains invalid.
- The sign-up form currently lacks a confirm-password input, municipality
  selection, password visibility control/strength meter, ID photo input/preview,
  and the requested driver fields.
- The phone prefix is padded vertically and does not use the shared 40px
  control height. Driver role cards do not have a layout rule.
- The forgot-password link follows the submit button rather than the password
  field. The auth form is a bordered card at phone widths, and the main action
  has a desktop max-width rule shared with other large buttons.
- A source audit found the radio/text-exclamation pattern only in `Auth.tsx`;
  other screens do not repeat those exact patterns.

## Fixes applied

- Added token-driven shared auth styles in `src/index.css`. Phones now use a
  scrollable, full-screen layout with safe-area padding and no outer card.
  Screens at 768px and wider use centered 420px / 480px cards. Sign-in and
  sign-up use the same 40px inputs, 44px submit button, and spacing tokens.
- Removed the dynamic custom mode class construction; the only conditional
  shell modifier is a complete static `auth-form-shell--register` class. All
  auth/app semantic classes referenced by TSX are now checked against the
  global CSS.
- Fixed the global button sizing selector to leave `auth-*` buttons to their
  auth-specific rules. This also fixed an overlay/hit-testing defect: absolute
  focus-target pseudo-elements on unpositioned auth text buttons could cover
  other controls and intercept clicks.
- Added styles for every previously unstyled Auth-specific class from the
  baseline list above. The radio is visually clipped but focusable, the card
  reflects the selected state, and the 20px icon and copy are laid out as a
  two-column role card.
- Updated the shared `FormField` to render consistent 12px labels and
  icon-based 12px alert errors; added `IconAlertCircle` and removed the
  text-exclamation error marker.
- Rebuilt the screens with shared `AppInput`, `AppSelect`, `AppButton`,
  `FormField`, `Screen`, and `Stack` components. Added the local auth header,
  forgot-password placement, generic login alert, one-line footer, optional
  email, municipality, password visibility and strength display, confirm
  password, driver details, vehicle type, image preview/actions, and review
  note.
- Errors stay empty on initial render, validate on blur or submit, and are
  revalidated while editing after interaction. Failed client validation scrolls
  and focuses the first invalid control. Submit continues through the original
  callback and retains the exact `AuthPayload` fields.
- Added reduced-motion handling for the animated driver section and
  system-preference dark colors for auth surfaces and controls.
- Expanded `scripts/check-ui.mjs`, run by `npm run check:ui`, to reject dynamic
  Tailwind utility fragments, verify `auth-*` and `app-*` class rules, and check
  structural contracts for role selection, error timing, password toggles, and
  ID image restrictions/preview.

## Scope and API contract

Municipality, vehicle type, and the ID image are UI-only values and are not
added to `AuthPayload` or the API request, as requested. The current auth
payload has no fields for them. The driver registration payload keys already
present in the API remain unchanged.

## Verification

- `npm run check:ui` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed. Vite still reports existing configuration/chunk-size
  advisory warnings.
- Browser checks covered 360px, 390px, 768px, and 1440px: no horizontal
  overflow, auth inputs/selects measured 40px, and the desktop sign-in card
  capped at 420px with a full-width submit control. Dark preference changed
  the auth background as intended.
- Interaction checks passed for initially hidden errors, blur and submit
  validation, first-invalid focus, role card selection and keyboard radio
  navigation, password visibility, rejecting non-image and >2 MB files, and
  rendering an accepted image preview.
- After screenshots are saved in `docs/auth-ui-after/` for sign-in and
  passenger/driver sign-up at the requested viewport widths.
- Before screenshots could not be produced: the reported attachment was not
  available in the shared workspace/browser, and this workspace has no
  repository history from which to restore the pre-change UI.
- A real OS keyboard cannot be opened by this browser harness. The layout
  remains in normal document flow and scrolls; the submit action is not fixed
  or hidden behind a keyboard.
