# PASAKJA backend (local XAMPP)

## Recommended stack

Use **PHP 8 + PDO + MariaDB/MySQL** for this project. SQL is the query language; MariaDB/MySQL is the database server; PHP exposes the JSON API used by the React app. This matches the PHP 8.0 and MariaDB 10.4 already bundled in this XAMPP installation. Use InnoDB tables and foreign keys for rides, users, ratings, and ride-status history.

The API uses expiring bearer tokens, hashed passwords, and PDO prepared statements. It supports passenger requests, approved driver flows, live tracking, SOS alerts, and admin tools.

## One-time local setup

1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. In phpMyAdmin, import `database/schema.sql`. It creates the `pasakja` database and its tables. Then import each file in `database/migrations/` in date order (oldest first): they add fares, live tracking, community alerts, password-reset requests and profile photos. Every migration is safe to run again.
3. Copy `api/config.example.php` to `api/config.local.php`. Set your local database password there. The local config is ignored by Git.
4. Copy `.env.example` to `.env.local`. Keep `VITE_API_BASE_URL=/api`; the Vite dev server forwards `/api` to `PASAKJA_API_PROXY_TARGET` (the Apache URL for this folder). Restart Vite after changing either value.
5. Open `http://localhost/PASAKJA-main/api/health` and confirm the response reports `"database":"connected"`.
6. Set `PASAKJA_DEMO_PASSWORD` in your shell, then create the local demo accounts by running `C:\xampp\php\php.exe database\seed_demo_accounts_v2.php` from this project folder. The three phone numbers are `+639000000001` (passenger), `+639000000002` (driver), and `+639000000003` (admin). The driver account is pre-approved for testing.

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

Set database credentials in server environment variables or a private config outside the web root, use HTTPS, update the API allowed-origin list, add rate limiting and phone verification, and configure backups. Do not deploy the XAMPP root account or its blank default password. Live driver tracking needs a managed WebSocket/realtime service; map routing needs a routing provider.

## API paths

- `GET /health`
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- `POST /auth/forgot` (reset request for an admin), `POST /auth/password` (change password)
- `PUT /me/avatar`, `DELETE /me/avatar` (profile photo)
- `GET /rides`, `POST /rides`
- `GET /rides/{id}`, `POST /rides/{id}/accept`, `POST /rides/{id}/decline`
- `PATCH /rides/{id}/status`, `POST /rides/{id}/cancel`, `POST /rides/{id}/rating`
- `GET /alerts` (community notices for the user's town plus their own ride, SOS and account notices)
- `GET /places/reverse?lat=&lng=` (street name for a map pin, from OpenStreetMap, cached)
- Admin: `GET|POST /admin/alerts`, `DELETE /admin/alerts/{id}`; `GET /admin/password-resets`, `POST /admin/password-resets/{id}/resolve|dismiss`; `GET /admin/fares`, `PUT /admin/fares/municipalities/{town}`, `PUT /admin/fares/intertown`, `PUT /admin/fares/discounts`

## Forgot password

There is no email or SMS service, so "Forgot password?" sends a request to the admins. It appears on the admin **Overview** and in the admin's **Alerts**. **Issue temporary password** shows a one-time password to pass on by call or text; the person signs in with it and changes it in **Profile → Change password**. The reply to a reset request is the same whether or not the account exists, so it can't be used to check who has an account.

Authenticated requests use `Authorization: Bearer <token>`.
