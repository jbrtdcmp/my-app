# PASAKJA — Public launch hardening (21 November 2026)

Goal: make PASAKJA safe to open to the public using **free services only**. This records what was found, what changed, and how each change was verified. Setup details are in `BACKEND_SETUP.md` (sections "Security built in" and "Phone notifications and installing").

## Security review findings and fixes

An independent review of the API (`api/*.php`) found eight issues. Each was confirmed in the code before fixing.

| # | Severity | Problem (before) | Fix (after) | Verified by |
|---|---|---|---|---|
| 1 | High | A passenger could book without limit; fake requests filled every driver's list, and suspension was refused while any booking was open. | One active booking per passenger (locked, so double taps book once). Suspending cancels bookings that are still looking for a driver. | `audit-live` checks 3, 12 |
| 2 | Medium | A driver who wasn't approved yet could open any ride still looking for a driver (passenger name, exact pickup and destination). | Only approved drivers can see or decline open requests. | `audit-live` checks 4, 5, 7 |
| 3 | Medium | A driver on a ride could accept another one. | Refused until the current ride ends. | `audit-live` check 9 |
| 4 | Medium | Route and place-name lookups went to the free OpenStreetMap servers without a limit; caches were never cleaned. | 60 lookups per user per minute; one call per second to each service for the whole app (straight-line estimate or retry otherwise); expired cache rows removed. | `audit-live` checks 16–17 |
| 5 | Low | An approved driver could change the name an admin had checked against their license. | A name change sends the driver back to admin review, and admins are told. | `audit-live` checks 10–11 |
| 6 | Low | Repeated declines added log rows; license photos could be re-sent in a loop, each alerting every admin. | Declines logged once (approved drivers only); one license photo per 5 minutes. | `audit-live` checks 6, 8 |
| 7 | Low | PHP warnings could leak file paths; huge requests could exhaust memory; non-text or over-long fields caused server errors or were saved as "Array". | Warnings hidden; requests over 3 MB refused; text fields checked and limited. | `audit-live` checks 13–15; API unit test |
| 8 | Low | Without `config.local.php` the API quietly used the example settings (root, blank password). | The API refuses to run until it is configured. | Code review |

## New safeguards for a public launch

| Need | Before | After | Verified by |
|---|---|---|---|
| Password guessing | Unlimited sign-in attempts | 5 wrong passwords per account (30 per network) in 15 minutes; also for password checks in Profile; sign-up and reset-request limits per network | `limits-live` (7 checks), `launch-e2e` lockout message, 7 unit tests |
| Consent | A sentence under the form, no links | Terms of Use and Privacy Notice pages (`/terms`, `/privacy`), a required tick box at sign-up, and the accepted version saved per account | `launch-e2e` checks 1–7 |
| Data rights | No way to leave | Profile → Delete account: erases name, phone, email, photos and license photo; keeps ride records without a name | `launch-e2e` checks 9–12 |
| Notifications | Only inside the open app | Free Web Push: ride updates, approvals, SOS alerts for admins, and new-request alerts for nearby drivers, even when the app is closed | `push-interop` (13 checks against Node's crypto); Google's push service accepts the signature (410 with the real key, 403 with a wrong key) |
| Install | Browser tab only | Installable app (manifest, icons, service worker, offline page) | `launch-e2e` installability check (no Chrome installability errors) |
| Free-host limits | Every screen polled every 3.5–8 s, even in the background; parked drivers sent their location every 4 s | Polling pauses in the background; a parked driver sends every 25 s | Code review; full UAT regression |
| Headers | Basic | No caching of API answers, no framing, no referrer; page headers in `public/.htaccess` | Header check on `/api/health` |

## Not possible or not done with free services

- **SMS verification of phone numbers:** no free SMS service exists. Admin license review, sign-in limits and suspension are the safeguards.
- **HTTPS redirect, page HSTS and Content-Security-Policy:** to be added on the host after checking how its proxy reports HTTPS.
- **Push notifications on a real phone:** the encryption and signing are verified, but automated browsers can't subscribe to a push service, so the first real test must be done by hand on a phone after deployment.
- **Uptime and backups (NFR5):** free hosting gives no uptime guarantee and no automatic backups.
