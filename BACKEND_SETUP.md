# PASAKJA backend (local XAMPP)

## Recommended stack

Use **PHP 8 + PDO + MariaDB/MySQL** for this project. SQL is the query language; MariaDB/MySQL is the database server; PHP exposes the JSON API used by the React app. This matches the PHP 8.0 and MariaDB 10.4 already bundled in this XAMPP installation. Use InnoDB tables and foreign keys for rides, users, ratings, and ride-status history.

The API uses expiring bearer tokens, hashed passwords, and PDO prepared statements. It supports passenger requests, approved driver flows, live tracking, SOS alerts, and admin tools.

## One-time local setup

1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. In phpMyAdmin, import `database/schema.sql`. It creates the `pasakja` database and its tables. Then import each file in `database/migrations/` in date order (oldest first): they add fares, live tracking, community alerts, password-reset requests, profile photos, driver license photos, account suspension, and the public-launch tables (sign-in limits, consent, account deletion, push notifications). Every migration is safe to run again.
3. Copy `api/config.example.php` to `api/config.local.php`. Set your local database password there. The local config is ignored by Git, and the API refuses to run without it.
4. For phone notifications, run `C:\xampp\php\php.exe scripts\generate-vapid-keys.php your-contact@example.com` and paste the three printed lines into `api/config.local.php`. Without them the app works, but the notifications card stays hidden.
5. Copy `.env.example` to `.env.local`. Keep `VITE_API_BASE_URL=/api`; the Vite dev server forwards `/api` to `PASAKJA_API_PROXY_TARGET` (the Apache URL for this folder). Restart Vite after changing either value.
6. Open `http://localhost/PASAKJA-main/api/health` and confirm the response reports `"database":"connected"`.
7. Set `PASAKJA_DEMO_PASSWORD` in your shell, then create the local demo accounts by running `C:\xampp\php\php.exe database\seed_demo_accounts_v2.php` from this project folder. The three phone numbers are `+639000000001` (passenger), `+639000000002` (driver), and `+639000000003` (admin). The driver account is pre-approved for testing.

## Opening the app on localhost or the network

Run `npm run dev`. Vite prints two addresses: `Local` (`http://localhost:5173`) for this computer and `Network` (`http://<your Wi-Fi IP>:5173`) for phones or laptops on the same Wi-Fi. The same accounts work on both, because every API request goes through the dev server instead of straight to Apache. Your Wi-Fi IP can change after a restart, so use the `Network` line Vite prints each time. If another device can't open the page, allow Node.js through Windows Firewall on private networks.

### Testing GPS on a phone

Phones only share location with secure `https://` pages, so on the plain `http://` Network address the app shows "Location is blocked because this link is not secure." To test GPS on a phone:

1. Stop `npm run dev` and run `npm run dev:phone` instead. It serves the same app over `https://` with a self-signed certificate.
2. On the phone, open the `Network` address Vite prints, starting with `https://`.
3. The browser warns that the connection isn't private. This is expected for a local test certificate. On iPhone Safari tap **Show Details**, then **visit this website**. On Android Chrome tap **Advanced**, then **Proceed**.
4. Allow location when the app asks. On iPhone, also check **Settings → Privacy & Security → Location Services → Safari Websites** is set to **While Using the App**.

A deployed copy on a real `https://` domain doesn't need any of this.

A production build (`npm run build`) served by Apache has no dev server in front of it. For that case, set `VITE_API_BASE_URL` to the full API URL and add the page's address to `allowed_origins` in `api/config.local.php`.

The seed script is for local testing only and refuses web requests. It reads the database configuration from `api/config.local.php`, never writes passwords to the console, and leaves existing accounts unchanged. Remove the demo accounts before deploying this database publicly.

## Before deployment

- **Server settings:** create `api/config.local.php` on the server with the host's database account (never the XAMPP root account or its blank password), the site's `https://` address in `allowed_origins`, and new VAPID keys from `scripts/generate-vapid-keys.php`.
- **Who runs it:** set `VITE_OPERATOR_NAME` and `VITE_SUPPORT_CONTACT` in `.env.local` before `npm run build`. They appear in the Privacy Notice and Terms of Use (`/privacy`, `/terms`).
- **HTTPS:** location and notifications only work on `https://`. Add the HTTPS redirect, `Strict-Transport-Security` for the pages, and a Content-Security-Policy on the host, after checking how its proxy reports HTTPS (a wrong rule causes an endless redirect).
- **Data:** confirm the town fares and emergency hotline numbers with the TODA and LGU and save them in the dashboard; remove the demo accounts.
- **Backups:** set up a scheduled database export; free hosting has no automatic backups.
- **Free services:** the public OpenStreetMap servers allow about one request per second for the whole app. The API respects that (straight-line estimates when it must wait), but heavy use needs a self-hosted or keyed routing service.

## Security built in

- **Sign-in limits:** 5 wrong passwords per account (30 per network address) in 15 minutes lock sign-in until the oldest attempt is 15 minutes old; the same limit covers the current-password checks in Profile. At most 20 sign-ups and 10 reset requests per address per hour. Attempts are kept for one day (`auth_attempts`).
- **Bookings and rides:** one active booking per passenger; a driver can't accept a second ride while on one; only approved drivers can see or decline open requests.
- **Input:** request bodies over 3 MB are refused; text fields must be text and fit their columns; PHP warnings are never shown.
- **Map lookups:** 60 route or place lookups per user per minute, and one call per second to each OpenStreetMap service for the whole app; old cache rows are cleaned up.
- **Drivers:** an approved driver who changes their name goes back to admin review; license photos can be re-sent at most every 5 minutes.
- **Accounts:** suspending an account cancels its bookings that are still looking for a driver. Deleting an account (Profile → Privacy and account) erases name, phone, email, photos and license photo, signs out everywhere, and keeps ride records without a name.
- **Headers:** the API answers with `Cache-Control: no-store`, `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer` (plus HSTS on HTTPS); `public/.htaccess` adds safe headers for the pages.

There is no SMS verification of phone numbers: no free SMS service exists. Admin approval of drivers (license photo), the sign-in limits and account suspension are the safeguards instead.

## Phone notifications and installing

PASAKJA is an installable web app (`public/manifest.webmanifest`, `public/sw.js`): Chrome and Edge offer **Install PASAKJA app** in Profile, and on iPhone people use Share → Add to Home Screen. In **Profile → App and notifications** each person turns notifications on for that device. Every in-app notice is also sent to their devices (ride updates, approvals, SOS alerts for admins), and a new booking alerts up to five nearby approved drivers seen in the last 15 minutes. Messages are encrypted in `api/web_push.php` (RFC 8291) and signed with the server's VAPID key (RFC 8292); only Google, Apple, Mozilla and Microsoft push addresses are accepted. Notifications are sent after the app has its answer, so they never slow it down. On iPhone they work only from the Home Screen app, on iOS 16.4 or later. Signing out turns them off on that device.

## API paths

- `GET /health`
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- `POST /auth/forgot` (reset request for an admin), `POST /auth/password` (change password)
- `PATCH /me` (edit name, phone, email and home town; a new phone or email needs `current_password`), `DELETE /me` (delete my account; body `password`)
- `GET /push/config`, `PUT /push/subscription`, `DELETE /push/subscription`, `POST /push/test` (phone notifications for the signed-in user)
- `PUT /me/avatar`, `DELETE /me/avatar` (profile photo)
- `GET /rides`, `POST /rides`
- `GET /rides/{id}`, `POST /rides/{id}/accept`, `POST /rides/{id}/decline`
- `PATCH /rides/{id}/status`, `POST /rides/{id}/cancel`, `POST /rides/{id}/rating`
- `GET /alerts` (community notices for the user's town plus their own ride, SOS and account notices)
- `PUT /driver/id-photo` (a driver who isn't verified adds or replaces their license/ID photo; a rejected driver goes back to pending)
- `GET /places/reverse?lat=&lng=` (street name for a map pin, from OpenStreetMap, cached)
- Admin: `GET /admin/accounts`, `POST /admin/accounts/{id}/suspend` (body `reason`, shown to the user at sign-in) and `POST /admin/accounts/{id}/reactivate`; `GET /admin/drivers/{id}/id-photo` (each view is logged), `GET|POST /admin/alerts`, `DELETE /admin/alerts/{id}`; `GET /admin/password-resets`, `POST /admin/password-resets/{id}/resolve|dismiss`; `GET /admin/fares`, `PUT /admin/fares/municipalities/{town}`, `PUT /admin/fares/intertown`, `PUT /admin/fares/discounts`

## Driver approval

Driver sign-up requires a photo of the driver's license or ID. The browser shrinks it (up to 1600px) before upload, and the API refuses photos that are too small to read. In **Dashboard → Drivers**, **Review ID** shows the photo next to the license number, plate, body number and TODA; Approve and Reject are in that dialog. ID photos are personal data: only admins can load them, one driver at a time, every view is recorded in `admin_activity_logs`, and the driver list never includes the photo itself. Phone numbers are stored as `+639…`, and sign-in accepts `0917…`, `917…` or `+63917…`.

## Forgot password

There is no email or SMS service, so "Forgot password?" sends a request to the admins. It appears on the admin **Overview** and in the admin's **Alerts**. **Issue temporary password** shows a one-time password to pass on by call or text; the person signs in with it and changes it in **Profile → Change password**. The reply to a reset request is the same whether or not the account exists, so it can't be used to check who has an account.

Authenticated requests use `Authorization: Bearer <token>`.
