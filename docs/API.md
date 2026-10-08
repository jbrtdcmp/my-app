# PASAKJA Milestone 7 API

The API is served from `api/index.php` through Apache rewrite rules. Authenticated routes require `Authorization: Bearer <token>`. Tokens are opaque random values; only their SHA-256 hashes are stored in `api_tokens`. Do not put bearer tokens in URLs.

## Location and routes

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/driver/location` | approved driver | Store current GPS point and append a point for the driver's active ride. |
| GET | `/routes?from=lat,lng&to=lat,lng` | signed-in user | Return GeoJSON route, road distance and ETA. Uses OSRM and a cached Haversine fallback. |
| GET | `/rides/{id}/tracking` | passenger, assigned driver, admin | Current ride, driver location, stale flag, route and ETA. |
| POST | `/rides` | passenger | Request a ride. Coordinates are optional but validated and bounded to the configured service area. |

Location updates are limited to one every two seconds, rejected outside service bounds, and the last 200 points per active ride are retained. A point older than 30 seconds is marked stale. Driver location is sent only while the foreground app is visible; browser background execution is not guaranteed.

Set `OSRM_BASE_URL` in the PHP environment or `osrm_base_url` in `api/config.local.php` to a self-hosted OSRM service. The public OSRM demo host is the development default and has no production availability guarantee. Route cache entries expire after 60 seconds. Fallback distance is straight-line Haversine distance and its ETA assumes 20 km/h; it is explicitly marked approximate. Fare calculation remains separate and is not inferred from route distance.

## SOS and sharing

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/sos` | signed-in user | Record an SOS, optional current coordinates and notify admins. |
| POST | `/sos/{id}/resolve` | event owner or admin | Resolve an alert. |
| GET | `/admin/sos` | admin | List recent alerts, newest active first. |
| GET | `/emergency-contacts?municipality=...` | signed-in user | Return locally configured numbers. Placeholder contacts have no phone number. |
| PATCH | `/admin/emergency-contacts/{id}` | admin | Set or clear a contact phone number. |
| POST | `/rides/{id}/share` | passenger or assigned driver | Mint an unguessable, 24-hour, read-only live-trip URL. |
| GET | `/trip/{token}` | public, token possession | Read active trip status, route labels, driver name/plate and a fresh location only. |
| POST | `/rides/{id}/share/revoke` | passenger, assigned driver, admin | Revoke trip links. Links are also revoked when the ride completes or cancels. |
| GET/PATCH | `/admin/drivers`, `/admin/drivers/{id}` | admin | Review driver records and set verification status. |

Public trip links do not expose passenger/driver phone numbers or account IDs, and do not return stale coordinates. Treat the URL as a temporary secret and revoke it when sharing is no longer needed. SOS is logged and surfaced to PASAKJA admins; the UI tells riders to contact emergency services directly for immediate help. Configure real emergency contact numbers before relying on those call links.

## Local setup

1. Import `database/schema.sql` for a fresh database, or apply `database/migrations/20261008_milestone7.sql` to the existing installation.
2. Copy `api/config.example.php` to `api/config.local.php` and set the database credentials and allowed frontend origins. Keep local secrets out of source control.
3. Start Apache and MariaDB in XAMPP; verify `GET /api/health` reports a connected database.
4. Approve a driver account from the admin Drivers tab before testing location updates or accepting requests.

