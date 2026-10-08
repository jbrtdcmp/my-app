# Milestone 7 decisions and implementation plan

## Decisions
- Extend the existing PHP 8/PDO/MariaDB API and React app; do not redesign current screens.
- Treat authenticated API access as bearer-token based, with opaque random tokens stored only as hashes in MariaDB and sent through `Authorization`.
- Store driver GPS in the existing `driver_profiles` records and retain at most 200 recent points per active ride in a new `ride_locations` table.
- Use a server-only OSRM route service with a three-second timeout, 60-second cache, and deterministic Haversine fallback. Keep fare calculation separate from route distance.
- Add persisted, rate-limited SOS events, admin notifications/activity records, configurable emergency contacts, and expiring/revocable trip-share tokens. Emergency contact values remain visibly unconfigured until an admin supplies real local numbers.
- Keep device location and map routing behind small frontend services. Use browser geolocation until a native Capacitor shell is installed; never fabricate a driver position.
- Sequence work: (1) schema/API auth and tracking/location, (2) route guidance, (3) SOS/share/admin view, (4) sign-in feedback and API documentation, (5) available automated checks and manual test plan.

## Validation
- Run the requested focused checks after each item where the repository has compatible tooling. The starting repository has no Composer/PHPUnit or Vitest setup; inspect installed/runtime tooling before choosing a safe fallback.
- Record local-device scenarios in `docs/TEST_PLAN.md`. Do not claim physical GPS, network-loss, or SOS drills ran without performing them.
- The supplied workspace currently has no Git metadata; check again before the requested commit and report if committing is unavailable.
