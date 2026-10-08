# Milestone 7 test plan

## Automated checks

- PHP syntax: `C:\xampp\php\php.exe -l api\index.php`
- TypeScript: `npx tsc --noEmit`
- `npm run build` could not run in the current workspace because the installed `@tailwindcss/oxide` Windows native binding is missing/unloadable (`tailwindcss-oxide.win32-x64-msvc.node`); no dependency reinstall was attempted.
- PHPUnit and Vitest are not installed in this workspace. No claim of PHPUnit/Vitest coverage is made. Add those runners with the project's deployment dependency policy before making them required CI checks.

## Manual two-device scenario

Use one approved driver browser/device and one passenger browser/device with separate accounts. Start Apache and MariaDB, configure a real local OSRM endpoint if available, and verify `/api/health` first.

1. Passenger submits a ride with pickup and destination map pins. Confirm it appears in the approved driver's request list, with server-derived distance where both points exist.
2. Driver accepts. Confirm the passenger sees the real assigned driver and the map does not show a fabricated position before GPS is available.
3. Grant location permission on the driver device. Confirm movement updates the passenger marker and route/ETA. Keep the driver page visible; background GPS is not promised by browser geolocation.
4. Deny permission, then retry. Confirm the driver sees an actionable permission message and the passenger sees no location or a stale-location message rather than a false live marker.
5. Enable airplane mode on the driver device. After 30 seconds, confirm the passenger sees a stale signal; restore network and confirm updates resume.
6. Create a trip-share link and open it in a private/incognito window. Confirm active status and fresh location are visible without sign-in, and phone numbers/account IDs are absent. Revoke it and confirm it no longer loads.
7. Send an SOS with and without location permission. Confirm the event appears in Admin → SOS and can be resolved. Confirm unconfigured contact placeholders do not show invented phone numbers.
8. Complete or cancel the ride. Confirm share links are invalidated and location is no longer returned to passenger/public tracking.
9. Verify an unapproved driver cannot receive/accept rides or post GPS. Verify a passenger cannot read another passenger's trip and non-admins cannot open admin endpoints.

Do not use live emergency numbers for test calls. Use test accounts and non-emergency drills only.

