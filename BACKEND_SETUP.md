# PASAKJA backend (local XAMPP)

## Recommended stack

Use **PHP 8 + PDO + MariaDB/MySQL** for this project. SQL is the query language; MariaDB/MySQL is the database server; PHP exposes the JSON API used by the React app. This matches the PHP 8.0 and MariaDB 10.4 already bundled in this XAMPP installation. Use InnoDB tables and foreign keys for rides, users, ratings, and ride-status history.

The API uses expiring bearer tokens, hashed passwords, and PDO prepared statements. It supports passenger requests, approved driver flows, live tracking, SOS alerts, and admin tools.

## One-time local setup

1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. In phpMyAdmin, import `database/schema.sql`. It creates the `pasakja` database and its tables.
3. Copy `api/config.example.php` to `api/config.local.php`. Set your local database password there. The local config is ignored by Git.
4. Copy `.env.example` to `.env.local`. Set `VITE_API_BASE_URL` to the Apache URL for this folder. Restart Vite after changing it.
5. Open `http://localhost/PASAKJA-main/api/health` and confirm the response reports `"database":"connected"`.
6. Create the local demo accounts by running `C:\xampp\php\php.exe database\seed_demo_accounts.php` from this project folder. Use `Demo1234!` for all three demo logins. The driver account is pre-approved for testing.

The seed script is for local testing only and refuses web requests. Remove the demo accounts before deploying this database publicly.

## Before deployment

Set database credentials in server environment variables or a private config outside the web root, use HTTPS, update the API allowed-origin list, add rate limiting and phone verification, and configure backups. Do not deploy the XAMPP root account or its blank default password. Live driver tracking needs a managed WebSocket/realtime service; map routing needs a routing provider.

## API paths

- `GET /health`
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- `GET /rides`, `POST /rides`
- `GET /rides/{id}`, `POST /rides/{id}/accept`, `POST /rides/{id}/decline`
- `PATCH /rides/{id}/status`, `POST /rides/{id}/cancel`, `POST /rides/{id}/rating`

Authenticated requests use `Authorization: Bearer <token>`.
