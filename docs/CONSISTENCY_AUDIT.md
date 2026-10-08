# PASAKJA CONSISTENCY AUDIT

## Scope
This audit was completed before code changes. The goal was to identify the root cause behind role navigation leakage and the shared-shell/profile inconsistencies described in the attached spec.

## Executive summary
The app currently uses one global state machine in `src/App.tsx` instead of a role-scoped route tree. `activeScreen` is a single shared value (`home | map | bookings | alerts | profile | driver | admin | drivers`), and `role` only changes the menu list and which screen is selected initially. There is no role-prefixed route hierarchy, no route guards, and no `navigate(-1)` safety wrapper.

This means the product is vulnerable to cross-role navigation because:
- all roles share the same `profile` screen,
- bell, back arrow, and avatar buttons route to the same global state instead of the current role's route config,
- the logged-in role is not enforced by URL or route tree,
- the app never distinguishes `passenger/profile`, `driver/profile`, or `admin/profile` as separate screens.

## 1) Route and navigation audit
### Findings
The current implementation does not have any role-scoped route strings or route guards.

Search result summary:
- No `/passenger`, `/driver`, or `/admin` route strings are defined in the app source.
- No router is being used for role screens.
- The application instead uses local screen state in `src/App.tsx` and a single `Profile` screen component reused across roles.

### Key locations
- `src/App.tsx`
  - `const [activeScreen, setActiveScreen] = useState<Screen>('home');`
  - `const [role, setRole] = useState<UserRole>('passenger');`
  - `setActiveScreen(user.role === 'admin' ? 'admin' : user.role === 'driver' ? 'driver' : 'home')`
  - `onBack={() => setActiveScreen('home')}` from `AppHeader`
  - `onAlerts={() => setActiveScreen('alerts')}` from `AppHeader`
  - `onNavigate={setActiveScreen}` from `BottomTabBar`
  - `ScreenContent` renders the same generic `Profile` screen for every role.

- `src/App.tsx` sidebar/nav definitions:
  - `NAV_TABS`, `DRIVER_NAV`, `ADMIN_NAV`, `SIDEBAR_LINKS`
  - These menus are role-swapped, but the underlying screen identifiers are still generic and shared.

- `src/screens/Profile.tsx`
  - One reusable profile page is used without role-specific sections or separate route targets.

### Root cause of bug
The navigation system is not explicit or role-aware. It relies on a single `activeScreen` variable and a shared `Profile` component. Because of that, a driver or admin can see or be sent to the same passenger-style screens as the current state says, rather than a role-specific route tree.

## 2) Duplicated or divergent UI
The app already shows repeated or divergent patterns that make the system inconsistent across screens:

- The app uses a single global `Profile` screen for all roles, but the spec requires three distinct profile experiences.
- The app uses a single generic `Alerts` screen and generic `Bookings` screen rather than role-specific flows.
- The app has multiple UI patterns for nav surfaces (`Sidebar`, `BottomTabBar`, `AppHeader`) but without a single role config source.
- Several surface styles are okay individually, but they are not standardized by a single shell + menu configuration.

Examples of duplicated or divergent behavior:
- `Sidebar` and `BottomTabBar` are built separately and each role passes a different menu list, but they still route to shared screen IDs instead of role-prefixed screens.
- `AppHeader` uses a generic back arrow and alerts action with `setActiveScreen`, which bypasses role boundaries.
- The header and nav have behavior that depends on the current state rather than current role route context.

## 3) Role-guard and route-security status
Current status: no route guards exist.

Implication:
- A logged-in driver or admin can open a passenger-centered screen flow by app state alone because there is no route tree to constrain them.
- A route typed manually into the browser is not actually a route system in the app; it is a single-page app that uses state and screen ID mapping.
- There is no enforcement to redirect a signed-in user to their own role home.

## 4) Back arrow and navigation bug analysis
### Current behavior
The current back action is a generic state fallback:

- `onBack={() => setActiveScreen('home')}` in `AppHeader`

This is not a stack-aware role-safe back action. It is essentially a hard-coded fallback to a global home screen, which can send a user back to the wrong context after login or redirect.

### Why `navigate(-1)`/fallback issues are relevant here
The app does not currently use a navigation history model at all. It uses synthetic screen state. That means the back behavior is not role-aware and cannot safely reason about the previous entry, same-role context, or parent fallback.

The correct fix described in the attached spec is to move to a role-specific route tree with a helper like `useBackNavigation(fallbackPath)` and fallback values defined per screen.

## 5) Before reproduction findings
Authenticated manual reproduction was not possible during the audit because no passenger, driver, or admin test credentials were provided. The following are verified from the implementation rather than claimed as device-test observations:

Observed behavior from code review:
- Driver and admin both still share `Profile` as a common screen.
- Bell actions are the same for all roles (`setActiveScreen('alerts')`).
- The app does not encode separate `passenger`, `driver`, or `admin` profile or alerts destinations.
- The back button always targets the global home state, not the current role's parent/fallback screen.

This matches the reported bug pattern: a driver/admin notification bell or back arrow can land on a shared or wrong-role screen because the app is not routing by role.

## 6) Audit conclusion
The root cause is structural:
- the app is using a single shared screen state instead of a role-scoped route tree,
- there is no route hierarchy or guard,
- there is no role-specific profile or alert destination,
- the back arrow is not stack-aware,
- the generic `Profile` component is reused across roles and violates the requirement for role-specific profile pages.

## After (Run A implementation)
- Added the centralized role path/menu/fallback definitions and path resolution helpers in `src/navigation/roleRoutes.ts`.
- Navigation controls now resolve destinations from the signed-in role configuration. Passenger, driver, and admin have distinct home, rides, alerts, and profile paths.
- Added route checks for initial deep links and browser history. A signed-in user loading a different role's path is replaced with their own role home; a signed-out user opening a role path is redirected to sign-in.
- Successful login replaces the auth history entry with that role's home. Logout confirms, clears the API session, and replaces history with sign-in.
- Ride details use role-prefixed ride paths, and the guarded back helper only goes back when the prior history path belongs to the same role tree; otherwise it uses the configured fallback.
- Bell and profile actions now use the current role's routes. Admin has a mobile navigation drawer and still has no mobile bottom tab bar.
- Replaced the shared passenger-style profile with a shared `ProfileLayout` and role-specific passenger, driver, and admin data sections. The admin section uses only current-user/admin fields and contains no passenger or driver rows.
- Alerts are rendered by the existing shared `Alerts` component at role-specific paths.
- Added built-in Node route configuration tests in `scripts/role-routes.test.mjs`; no test dependency was added.

### Run A automated checks
- `npm run test:routes`: passed (7 tests).
- `npm run check:ui`: passed after fixing token spacing and icon-size violations.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed. Existing Vite configuration and bundle-size warnings remain.
- Browser smoke test: opening `/driver/profile` signed out was redirected to `/sign-in`; switching from Sign in to Sign up updated the address to `/sign-up` and rendered the registration form. Reloading the local page after the final build also rendered Sign in without runtime errors.
- The automated route tests cover role menu destinations, cross-role route ownership, ride-detail route ownership, and per-role fallback paths. They do not substitute for authenticated component-level/manual tests.

### After manual checklist
- [ ] Sign in fresh as passenger; from three screens test bell, profile, and back. Not yet run: requires an authenticated passenger session.
- [ ] Sign in fresh as driver; from three screens test bell, profile, and back. Not yet run: requires an authenticated driver session.
- [ ] Sign in fresh as admin; from three screens test bell, profile, and back. Not yet run: requires an authenticated admin session.
- [x] Signed-out user opening a role-specific URL is redirected to sign-in (browser smoke test).
- [ ] Reload a signed-in deep link and test browser/device back on phone and desktop. Not yet run: requires authenticated role sessions and device/browser test coverage.

## Needs a backend/API change
- Current `ApiUser` data includes only ID, name, phone, email, and role. Admin permission level and last-login time are absent; the admin profile therefore shows “Not available” for last login and uses the returned role as the available role indicator.
- The driver profile response currently omits municipality, vehicle type, license number, and ID-photo URL. The driver profile displays returned plate/body/TODA/verification/rating/ride-count values and marks the other fields unavailable.
- Passenger municipality, saved places, favorite drivers, low-data preference, and profile-photo persistence are not provided by the current client profile data/API calls. Avatar selection in this UI is a local preview only.
- The current frontend service exposes no profile-edit or change-password methods. No fake save behavior was added.
- The existing alert samples have no signed-in user identifier, role ownership, unread-count endpoint, or notification/SOS feed. Role URLs are isolated, but the current sample notification contents cannot be securely filtered per user or show role-specific system/SOS records until such an API exists.

## Run A not completed / handoff limits
- Several admin destinations from the requested target (`passengers`, `reports`, `SOS`, and `settings`) do not have dedicated full pages in the current app; the existing admin dashboard exposes its current subset only. Run B design consistency was not started.
- Authenticated click-through testing for each role could not be honestly marked complete without test accounts. Please perform the manual checklist above with your test roles before Run B.
- No Git repository is present at the workspace root, so the requested Run A commit could not be created.
