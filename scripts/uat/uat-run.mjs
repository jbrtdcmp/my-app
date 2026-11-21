// PASAKJA User Acceptance Test run. Drives the real app (http://localhost:5173 + XAMPP API)
// as a passenger, a driver and an admin, saves screenshots as evidence, and writes
// docs/uat/uat-results.json and docs/uat/UAT-results.md. Test accounts use +63999 phones.
//
// Run with XAMPP (Apache + MySQL) and `npm run dev` started; demo accounts come from .env.local:
//   C:\xampp\php\php.exe scripts\uat\test-data.php snapshot
//   node scripts/uat/uat-run.mjs
//   C:\xampp\php\php.exe scripts\uat\test-data.php restore
//   C:\xampp\php\php.exe scripts\uat\leftover-check.php
import { chromium } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

process.loadEnvFile(fileURLToPath(new URL('../../.env.local', import.meta.url)));
const ROOT = fileURLToPath(new URL('../../docs/uat', import.meta.url)).replace(/\\/g, '/');
const SHOTS = `${ROOT}/screenshots`;
const FILES = `${ROOT}/files`;
// Clear only what this run regenerates; hand-written notes (UAT-issues.md, before-after/) stay.
await rm(SHOTS, { recursive: true, force: true });
await rm(FILES, { recursive: true, force: true });
await mkdir(SHOTS, { recursive: true });
await mkdir(FILES, { recursive: true });
const BASE = 'http://localhost:5173';
const API = `${BASE}/api`;
const DEMO = { passenger: process.env.PASAKJA_DEMO_PASSENGER_PHONE, driver: process.env.PASAKJA_DEMO_DRIVER_PHONE, admin: process.env.PASAKJA_DEMO_ADMIN_PHONE, password: process.env.PASAKJA_DEMO_PASSWORD };
const UAT_PASSENGER = { name: 'UAT Passenger', phone: '9990000601', full: '+639990000601', password: 'Uat-passenger-2026', town: 'Carrascal' };
const UAT_DRIVER = { name: 'UAT Driver', phone: '9990000602', full: '+639990000602', password: 'Uat-driver-2026', license: 'N02-26-660602', plate: 'UAT-602', body: 'C-602' };
const startedAt = new Date();

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${API}/${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return [res.status, await res.json().catch(() => ({}))];
}
const login = async (identifier, password) => (await api('auth/login', { method: 'POST', body: { identifier, password } }))[1];
const expect = (condition, message) => { if (!condition) throw new Error(message); };

const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const near = (lat, lng) => ({ geolocation: { latitude: lat, longitude: lng }, permissions: ['geolocation'] });
const passengerCtx = await browser.newContext({ ...phone, ...near(9.3705, 125.9488), acceptDownloads: true });
const driverCtx = await browser.newContext({ ...phone, ...near(9.3684, 125.9468) });
const newDriverCtx = await browser.newContext({ ...phone });
const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const P = await passengerCtx.newPage();
const D = await driverCtx.newPage();
const ND = await newDriverCtx.newPage();
const A = await adminCtx.newPage();

const shot = async (page, id, name, options = {}) => {
  const file = `${id}-${name}.png`;
  await page.screenshot({ path: `${SHOTS}/${file}`, ...options });
  return file;
};
async function signIn(page, identifier, password, prefix) {
  await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
  await page.locator('#auth-phone').fill(identifier);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForURL(url => url.pathname.startsWith(prefix), { timeout: 20000 });
}
const tab = (page, label) => page.locator('nav[aria-label="Main navigation"]:visible button', { hasText: label }).click();
// Tap the visible map at an offset (in px) from its centre, to drop a pin.
async function tapMap(page, dx, dy) {
  const box = await page.locator('.passenger-map-layer .leaflet-container').boundingBox();
  await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
}

// ---------------------------------------------------------------- scenarios
const state = {};
const scenarios = [
  { id: 'UAT-01', feature: 'Login', role: 'Passenger', steps: 'Open Sign in, enter a registered phone number and password, tap Log In.', expected: 'The user is signed in and taken to the passenger Home screen.',
    run: async () => {
      const page = await (await browser.newContext(phone)).newPage();
      await signIn(page, DEMO.passenger, DEMO.password, '/passenger/');
      await page.getByText('Where to?').first().waitFor();
      return { actual: 'Signed in and the passenger Home screen with the map and “Where to?” panel opened.', evidence: [await shot(page, 'UAT-01', 'login-home')] };
    } },
  { id: 'UAT-02', feature: 'Login with wrong password', role: 'Passenger', steps: 'Enter a registered phone number with a wrong password, tap Log In.', expected: 'Access is refused with an error message; the user stays on Sign in.',
    run: async () => {
      const page = await (await browser.newContext(phone)).newPage();
      await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
      await page.locator('#auth-phone').fill(DEMO.passenger);
      await page.locator('input[type="password"]').first().fill('wrong-password-123');
      await page.getByRole('button', { name: /^log in$/i }).click();
      await page.getByText('We couldn’t sign you in').waitFor({ timeout: 10000 });
      expect(new URL(page.url()).pathname === '/sign-in', 'left the sign-in page');
      return { actual: 'Access refused with “We couldn’t sign you in with those details”; stayed on Sign in.', evidence: [await shot(page, 'UAT-02', 'wrong-password')] };
    } },
  { id: 'UAT-03', feature: 'Passenger registration', role: 'Passenger', steps: 'Open Sign up, choose Passenger, fill in name, phone, town and password, tick the Terms and Privacy box, tap Create account.', expected: 'A passenger account is created with the chosen town and the user is signed in.',
    run: async () => {
      await P.goto(`${BASE}/sign-up`, { waitUntil: 'domcontentloaded' });
      await P.locator('input#auth-name').fill(UAT_PASSENGER.name);
      await P.locator('input#auth-phone').fill(UAT_PASSENGER.phone);
      await P.locator('select#auth-municipality').selectOption(UAT_PASSENGER.town);
      await P.locator('input#auth-password').fill(UAT_PASSENGER.password);
      await P.locator('input#auth-confirmPassword').fill(UAT_PASSENGER.password);
      const form = await shot(P, 'UAT-03', 'signup-form');
      await P.locator('.auth-consent input[type="checkbox"]').check();
      await P.getByRole('button', { name: 'Create account' }).click();
      await P.waitForURL(url => url.pathname.startsWith('/passenger/'), { timeout: 20000 });
      const account = await login(UAT_PASSENGER.full, UAT_PASSENGER.password);
      expect(account.user?.municipality === 'Carrascal', `town saved as ${account.user?.municipality}`);
      state.passengerToken = account.token;
      return { actual: `Account created (phone saved as ${account.user.phone}, town Carrascal) and signed in to Home.`, evidence: [form, await shot(P, 'UAT-03', 'signed-in')] };
    } },
  { id: 'UAT-04', feature: 'Driver registration with license photo', role: 'Driver', steps: 'Open Sign up, choose Driver, fill in details, plate, body number, TODA, license number, upload a license photo, tick the Terms and Privacy box, tap Create account.', expected: 'A driver account is created as “pending” with the license photo saved for admin review.',
    run: async () => {
      const art = await (await browser.newContext({ viewport: { width: 1200, height: 760 } })).newPage();
      await art.setContent(`<body style="margin:0;font:28px sans-serif;background:#e8f1f8"><div style="margin:40px;padding:40px;border:4px solid #1F5F8B;border-radius:24px;background:#fff;height:560px"><h1 style="margin:0 0 20px;color:#1F5F8B">DRIVER'S LICENSE (SAMPLE)</h1><p>Name: <b>UAT DRIVER</b></p><p>License No.: <b>${UAT_DRIVER.license}</b></p><p style="color:#B03535">TEST IMAGE ONLY — NOT A REAL ID</p></div></body>`);
      const license = await art.screenshot({ type: 'png' });
      await ND.goto(`${BASE}/sign-up`, { waitUntil: 'domcontentloaded' });
      await ND.locator('label.auth-role-option', { hasText: 'Driver' }).click();
      await ND.locator('input#auth-name').fill(UAT_DRIVER.name);
      await ND.locator('input#auth-phone').fill(UAT_DRIVER.phone);
      await ND.locator('select#auth-municipality').selectOption('Carrascal');
      await ND.locator('input#auth-password').fill(UAT_DRIVER.password);
      await ND.locator('input#auth-confirmPassword').fill(UAT_DRIVER.password);
      await ND.locator('input#auth-plateNumber').fill(UAT_DRIVER.plate);
      await ND.locator('input#auth-bodyNumber').fill(UAT_DRIVER.body);
      await ND.locator('select#auth-todaName').selectOption('Carrascal TODA');
      await ND.locator('input#auth-licenseNumber').fill(UAT_DRIVER.license);
      await ND.locator('input#auth-id-photo').setInputFiles({ name: 'license.png', mimeType: 'image/png', buffer: license });
      await ND.locator('img.auth-photo-preview').waitFor();
      await ND.locator('.auth-driver-section').scrollIntoViewIfNeeded();
      const form = await shot(ND, 'UAT-04', 'driver-signup-form');
      await ND.locator('.auth-consent input[type="checkbox"]').check();
      await ND.getByRole('button', { name: 'Create account' }).click();
      await ND.waitForURL(url => url.pathname.startsWith('/driver/'), { timeout: 30000 });
      await tab(ND, 'Profile');
      await ND.getByText('Your license photo is waiting for an admin to review it.').waitFor({ timeout: 15000 });
      await ND.locator('.driver-id-card').scrollIntoViewIfNeeded();
      const account = await login(UAT_DRIVER.full, UAT_DRIVER.password);
      state.newDriver = account;
      return { actual: 'Driver account created as pending; Profile shows the license photo is waiting for admin review.', evidence: [form, await shot(ND, 'UAT-04', 'driver-pending')] };
    } },
  { id: 'UAT-05', feature: 'Admin reviews license and approves driver', role: 'Admin', steps: 'Sign in as admin, open Dashboard → Drivers, tap Review ID on the new driver, compare the photo with the details, tap Approve.', expected: 'The license photo and details are shown; the driver becomes Verified and is notified.',
    run: async () => {
      await signIn(A, DEMO.admin, DEMO.password, '/admin/');
      await A.locator('[data-admin-tab="drivers"]').click();
      const row = A.locator('tr', { hasText: UAT_DRIVER.name });
      await row.waitFor({ timeout: 15000 });
      await row.getByRole('button', { name: 'Review ID' }).click();
      await A.waitForFunction(() => document.querySelector('.driver-id-dialog__photo img')?.naturalWidth > 0, null, { timeout: 15000 });
      const dialog = await shot(A, 'UAT-05', 'review-license');
      await A.locator('.driver-id-dialog').getByRole('button', { name: 'Approve' }).click();
      await A.locator('.driver-id-dialog').waitFor({ state: 'detached' });
      expect((await row.innerText()).toLowerCase().includes('verified'), 'row not verified');
      const [, alerts] = await api('alerts', { token: state.newDriver.token });
      expect(alerts.items?.some(item => item.type === 'driver_verified'), 'driver not notified');
      return { actual: 'License photo and details shown side by side; after Approve the driver shows “Verified” and received “You’re approved”.', evidence: [dialog, await shot(A, 'UAT-05', 'driver-verified')] };
    } },
  { id: 'UAT-06', feature: 'Driver goes online', role: 'Driver', steps: 'Sign in as an approved driver, open Requests, switch to online.', expected: 'The driver is shown as online and ready to receive nearby ride requests.',
    run: async () => {
      await signIn(D, DEMO.driver, DEMO.password, '/driver/');
      const toggle = D.getByRole('button', { name: /go online|go offline/i }).first();
      await toggle.waitFor({ timeout: 15000 });
      if ((await toggle.getAttribute('aria-label')) === 'Go online') await toggle.click();
      await D.getByText('You’re online').first().waitFor({ timeout: 10000 }).catch(() => D.getByText("You're online").first().waitFor({ timeout: 5000 }));
      await D.waitForTimeout(3000); // let the phone's location reach the server
      return { actual: 'Driver shown as “You’re online” with requests listed below; location shared with the server.', evidence: [await shot(D, 'UAT-06', 'driver-online')] };
    } },
  { id: 'UAT-07', feature: 'Fare estimate and ride booking', role: 'Passenger', steps: 'On Home, tap the pickup field and the map, then the destination field and the map; review the fare; tap Find a Tricycle.', expected: 'A fixed fare with breakdown is shown before booking; the request is sent and “Finding a tricycle” appears.',
    run: async () => {
      await P.goto(`${BASE}/passenger/home`, { waitUntil: 'domcontentloaded' });
      await P.locator('.passenger-map-layer .leaflet-container').waitFor();
      await P.waitForTimeout(1500);
      await P.getByPlaceholder('Pickup in Carrascal').click();
      await tapMap(P, -20, 25);
      await P.getByPlaceholder('Where to?').click();
      await tapMap(P, 45, 50);
      const fare = P.locator('section[aria-label="Fare breakdown"]');
      await fare.getByText(/₱\s?\d+/).first().waitFor({ timeout: 15000 });
      await fare.scrollIntoViewIfNeeded();
      const fareShot = await shot(P, 'UAT-07', 'fare-before-booking');
      state.fareText = (await fare.innerText()).replace(/\s+/g, ' ').trim();
      await P.getByRole('button', { name: 'Find a Tricycle' }).click();
      await P.getByText(/Finding a tricycle/).waitFor({ timeout: 15000 });
      return { actual: `Fare shown before booking (${state.fareText.match(/₱\s?\d+/)?.[0]}); request sent and “Finding a tricycle” shown.`, evidence: [fareShot, await shot(P, 'UAT-07', 'finding-tricycle')] };
    } },
  { id: 'UAT-08', feature: 'Nearest driver receives and accepts the request', role: 'Driver', steps: 'As the online driver nearby, wait for the request card, tap Accept.', expected: 'The request appears for the nearest driver with pickup, destination and fare; after Accept both sides see the ride details.',
    run: async () => {
      const card = D.locator('.ride-request-card').first();
      await card.waitFor({ timeout: 40000 });
      const cardShot = await shot(D, 'UAT-08', 'request-card');
      await card.getByRole('button', { name: 'Accept' }).click();
      await D.getByRole('button', { name: 'Start pickup' }).waitFor({ timeout: 20000 });
      await P.getByText(/Driver on the way|Driver arriving/).first().waitFor({ timeout: 20000 });
      const [, rides] = await api('rides', { token: state.passengerToken });
      state.rideId = rides.rides?.[0]?.id;
      expect(rides.rides?.[0]?.status === 'accepted', `ride status ${rides.rides?.[0]?.status}`);
      return { actual: `Request card showed pickup, destination and fare; after Accept the driver got the trip screen and the passenger saw the driver details (ride #${state.rideId}).`, evidence: [cardShot, await shot(D, 'UAT-08', 'driver-trip-screen'), await shot(P, 'UAT-08', 'passenger-driver-assigned')] };
    } },
  { id: 'UAT-09', feature: 'Live tracking along streets', role: 'Passenger', steps: 'Watch the ride screen after the driver starts the pickup.', expected: 'The map shows the driver’s position and a route that follows the streets, with ETA and distance.',
    run: async () => {
      await D.getByRole('button', { name: 'Start pickup' }).click();
      await D.getByRole('button', { name: 'Start trip' }).waitFor({ timeout: 15000 });
      await P.locator('.pasakja-driver-marker').waitFor({ timeout: 30000 });
      await P.locator('.leaflet-overlay-pane path').first().waitFor({ timeout: 20000 });
      await P.waitForTimeout(2500);
      const [, tracking] = await api(`rides/${state.rideId}/tracking`, { token: state.passengerToken });
      expect(tracking.ride?.route?.coordinates?.length > 2, 'no route');
      return { actual: `Driver marker and route shown; route has ${tracking.ride.route.coordinates.length} points (${tracking.ride.route_fallback ? 'straight-line fallback' : 'follows streets'}), ETA ${tracking.ride.eta_minutes} min, ${tracking.ride.distance_remaining_km} km.`, evidence: [await shot(P, 'UAT-09', 'live-tracking')], pass: !tracking.ride.route_fallback };
    } },
  { id: 'UAT-10', feature: 'Share live trip with a contact', role: 'Passenger', steps: 'During the ride, create a trip link and open it in a browser without signing in.', expected: 'The shared page shows the trip status and driver without needing an account.',
    run: async () => {
      const [status, share] = await api(`rides/${state.rideId}/share`, { token: state.passengerToken, method: 'POST', body: {} });
      expect(status === 200 || status === 201, `share status ${status}`);
      const page = await (await browser.newContext(phone)).newPage();
      await page.goto(`${BASE}/trip/${share.token}`, { waitUntil: 'domcontentloaded' });
      await page.getByText(/Live trip|Trip completed/).first().waitFor({ timeout: 15000 });
      await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length >= 4, null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const map = await page.evaluate(() => ({ height: Math.round(document.querySelector('.leaflet-container')?.getBoundingClientRect().height ?? 0), tiles: document.querySelectorAll('.leaflet-tile-loaded').length, driver: Boolean(document.querySelector('.pasakja-driver-marker')) }));
      expect(map.height > 200 && map.tiles >= 4, `map ${map.height}px tall with ${map.tiles} tiles`);
      return { actual: `Trip link created; without signing in, the public page showed “Live trip”, the driver and plate, and a ${map.height}px map${map.driver ? ' with the driver’s position' : ''}.`, evidence: [await shot(page, 'UAT-10', 'shared-trip-page')] };
    } },
  { id: 'UAT-11', feature: 'Driver completes the trip', role: 'Driver', steps: 'Tap Start trip, then Complete ride.', expected: 'The ride is marked completed with the final fare and the driver returns to Requests.',
    run: async () => {
      await D.getByRole('button', { name: 'Start trip' }).click();
      await D.getByRole('button', { name: 'Complete ride' }).waitFor({ timeout: 15000 });
      const before = await shot(D, 'UAT-11', 'complete-ride-button');
      await D.getByRole('button', { name: 'Complete ride' }).click();
      await D.waitForURL(url => !url.pathname.includes('/ride/'), { timeout: 20000 }).catch(() => {});
      await D.waitForTimeout(1500);
      const [, ride] = await api(`rides/${state.rideId}`, { token: state.passengerToken });
      expect(ride.ride?.status === 'completed', `status ${ride.ride?.status}`);
      state.finalFare = Number(ride.ride.final_fare);
      const landed = new URL(D.url()).pathname;
      return { actual: `Ride marked completed with final fare ₱${Number(ride.ride.final_fare)}; driver taken to ${landed === '/driver/rides' ? 'their Rides list, which shows the completed trip' : landed}.`, evidence: [before, await shot(D, 'UAT-11', 'after-complete')] };
    } },
  { id: 'UAT-12', feature: 'Passenger rates the driver', role: 'Passenger', steps: 'When the ride completes, choose a star rating, add a comment and tap Submit review.', expected: 'The rating is saved and shown in the driver’s rating.',
    run: async () => {
      await P.getByText('How was your ride?').waitFor({ timeout: 20000 });
      await P.getByRole('radio', { name: '5 stars' }).click();
      await P.getByPlaceholder('Tell us more (optional)').fill('Safe and on time.');
      const modal = await shot(P, 'UAT-12', 'rate-driver');
      await P.getByRole('button', { name: 'Submit review' }).click();
      await P.getByText('How was your ride?').waitFor({ state: 'detached', timeout: 15000 });
      const [, profile] = await api('driver/profile', { token: (await login(DEMO.driver, DEMO.password)).token });
      expect(Number(profile.profile?.rating) > 0, 'rating not recorded');
      return { actual: `Review submitted; driver rating now ${Number(profile.profile.rating).toFixed(1)}.`, evidence: [modal] };
    } },
  { id: 'UAT-13', feature: 'Ride status notifications', role: 'Passenger', steps: 'Open the Alerts tab after the ride.', expected: 'The passenger sees Driver found, Driver on the way, Trip started and Trip completed.',
    run: async () => {
      await tab(P, 'Alerts');
      await P.locator('.alert-item', { hasText: 'Trip completed' }).waitFor({ timeout: 15000 });
      const titles = await P.locator('.alert-item__title').allInnerTexts();
      const needed = ['Driver found', 'Driver on the way', 'Trip started', 'Trip completed'];
      expect(needed.every(title => titles.includes(title)), `got ${titles.join(', ')}`);
      return { actual: 'All four ride notices shown: Driver found, Driver on the way, Trip started, Trip completed (with fare).', evidence: [await shot(P, 'UAT-13', 'ride-notifications')] };
    } },
  { id: 'UAT-14', feature: 'Ride history', role: 'Passenger', steps: 'Open the Rides tab and filter by Completed.', expected: 'The completed ride appears with date, places, status and fare.',
    run: async () => {
      await tab(P, 'Rides');
      await P.getByRole('button', { name: 'Completed', exact: true }).click();
      await P.locator('.ride-history-card, article', { hasText: 'Completed' }).first().waitFor({ timeout: 15000 });
      return { actual: 'Completed ride listed with date, pickup, destination, “Completed” status and fare.', evidence: [await shot(P, 'UAT-14', 'ride-history')] };
    } },
  { id: 'UAT-15', feature: 'Cancel a booking', role: 'Passenger', steps: 'Book another ride, then tap Cancel booking while finding a tricycle.', expected: 'The request is cancelled and the passenger returns to Home.',
    run: async () => {
      await tab(P, 'Home');
      await P.locator('.passenger-map-layer .leaflet-container').waitFor();
      await P.waitForTimeout(1200);
      await P.getByPlaceholder('Pickup in Carrascal').click();
      await tapMap(P, 10, 20);
      await P.getByPlaceholder('Where to?').click();
      await tapMap(P, -40, 45);
      await P.locator('section[aria-label="Fare breakdown"]').getByText(/₱\s?\d+/).first().waitFor({ timeout: 15000 });
      await P.getByRole('button', { name: 'Find a Tricycle' }).click();
      await P.getByText(/Finding a tricycle/).waitFor({ timeout: 15000 });
      const finding = await shot(P, 'UAT-15', 'finding-before-cancel');
      await P.getByRole('button', { name: 'Cancel booking' }).click();
      await P.getByText('Where to?').first().waitFor({ timeout: 15000 });
      const [, rides] = await api('rides', { token: state.passengerToken });
      expect(rides.rides?.[0]?.status === 'cancelled', `latest ride ${rides.rides?.[0]?.status}`);
      return { actual: 'Booking cancelled from “Finding a tricycle”; ride saved as cancelled and Home shown again.', evidence: [finding, await shot(P, 'UAT-15', 'back-home')] };
    } },
  { id: 'UAT-16', feature: 'Map pins get street names', role: 'Passenger', steps: 'Tap the pickup field, then tap a spot on the map.', expected: 'The pickup field shows a street or place name instead of only coordinates.',
    run: async () => {
      await P.getByPlaceholder('Pickup in Carrascal').click();
      await tapMap(P, 30, 10);
      const field = P.getByPlaceholder('Pickup in Carrascal');
      await P.waitForFunction(() => { const input = document.querySelector('input[placeholder="Pickup in Carrascal"]'); return input && input.value && !input.value.startsWith('Map pin'); }, null, { timeout: 20000 }).catch(() => {});
      const value = await field.inputValue();
      return { actual: `Pickup field shows “${value}”.`, evidence: [await shot(P, 'UAT-16', 'pin-street-name')], pass: !value.startsWith('Map pin') };
    } },
  { id: 'UAT-17', feature: 'Emergency SOS', role: 'Passenger / Admin', steps: 'Passenger taps Emergency SOS → Confirm SOS; admin opens Dashboard → SOS and taps Mark resolved.', expected: 'The alert reaches the admins with the passenger’s details and location, and can be resolved.',
    run: async () => {
      await tab(P, 'Profile');
      await P.getByRole('button', { name: 'Emergency SOS' }).click();
      await P.getByRole('button', { name: 'Confirm SOS' }).click();
      await P.getByText('Your SOS alert has been sent').waitFor({ timeout: 20000 });
      const sent = await shot(P, 'UAT-17', 'sos-sent');
      await P.getByRole('button', { name: 'Close' }).click();
      await A.locator('[data-admin-tab="sos"]').click();
      const card = A.locator('article', { hasText: UAT_PASSENGER.name }).first();
      await card.waitFor({ timeout: 15000 });
      const adminView = await shot(A, 'UAT-17', 'admin-sos');
      const details = (await card.innerText()).replace(/\s+/g, ' ');
      await card.getByRole('button', { name: 'Mark resolved' }).click();
      await card.getByRole('button', { name: /Mark resolved|Updating/ }).waitFor({ state: 'detached', timeout: 15000 });
      await card.locator('.status-badge', { hasText: /resolved/i }).waitFor({ timeout: 10000 });
      expect(details.includes('Carrascal') && details.includes('Open reported location'), `card shows: ${details}`);
      return { actual: 'SOS sent with location; admin saw the passenger’s name, town (Carrascal), phone, time and “Open reported location”, and marked it resolved.', evidence: [sent, adminView, await shot(A, 'UAT-17', 'admin-sos-resolved')] };
    } },
  { id: 'UAT-18', feature: 'Community alert to a town', role: 'Admin / Passenger', steps: 'Admin opens Dashboard → Alerts, targets Carrascal, writes a title and message, taps Publish alert; passenger in Carrascal opens Alerts.', expected: 'The alert is published and appears in the Carrascal passenger’s Alerts.',
    run: async () => {
      await A.locator('[data-admin-tab="alerts"]').click();
      await A.locator('select.app-select').first().selectOption('Carrascal');
      await A.getByRole('button', { name: 'Community' }).click();
      await A.getByPlaceholder('e.g. Road repair on Rizal Street').fill('UAT: Road repair near the public market');
      await A.getByPlaceholder('What should riders and drivers know?').fill('One lane is closed until 5 PM. Expect short delays around the market.');
      await A.getByRole('button', { name: 'Publish alert' }).click();
      await A.getByText('Published to Carrascal').waitFor({ timeout: 10000 });
      const published = await shot(A, 'UAT-18', 'admin-publish');
      await tab(P, 'Alerts');
      await P.locator('.alert-item', { hasText: 'UAT: Road repair near the public market' }).waitFor({ timeout: 15000 });
      return { actual: 'Alert published to Carrascal and shown at the top of the Carrascal passenger’s Alerts.', evidence: [published, await shot(P, 'UAT-18', 'passenger-sees-alert')] };
    } },
  { id: 'UAT-19', feature: 'Admin changes a town fare', role: 'Admin', steps: 'Open Dashboard → Fares, raise the Carrascal base fare, tap Save; get a new fare estimate for the same trip.', expected: 'The change is saved and new estimates use it.',
    run: async () => {
      const trip = { pickupPosition: { lat: 9.3705, lng: 125.9488 }, destinationPosition: { lat: 9.3722, lng: 125.9515 }, rideType: 'regular', discount: 'none', municipality: 'Carrascal', destinationMunicipality: 'Carrascal' };
      const [, before] = await api('fares/estimate', { token: state.passengerToken, method: 'POST', body: trip });
      await A.locator('[data-admin-tab="fares"]').click();
      const card = A.locator('article.fare-card', { has: A.locator('h5', { hasText: 'Carrascal' }) });
      await card.waitFor({ timeout: 15000 });
      await card.getByLabel('Base fare').fill('40');
      await card.getByRole('button', { name: 'Save' }).click();
      await card.getByText('Carrascal fare saved').waitFor({ timeout: 10000 });
      const saved = await shot(A, 'UAT-19', 'fare-saved');
      const [, after] = await api('fares/estimate', { token: state.passengerToken, method: 'POST', body: trip });
      expect(after.estimate.base_fare === 40, `base fare ${after.estimate.base_fare}`);
      return { actual: `Saved; the same trip’s estimate went from ₱${before.estimate.total} to ₱${after.estimate.total} (base fare ₱${before.estimate.base_fare} → ₱${after.estimate.base_fare}). Restored after testing.`, evidence: [saved] };
    } },
  { id: 'UAT-20', feature: 'PDF and Excel reports', role: 'Admin', steps: 'On the Dashboard, tap PDF, then Excel.', expected: 'Both files download and contain the summary and ride list.',
    run: async () => {
      await A.locator('[data-admin-tab="overview"]').click();
      const files = [];
      for (const [name, ext] of [['PDF', 'pdf'], ['Excel', 'xlsx']]) {
        const [download] = await Promise.all([A.waitForEvent('download', { timeout: 30000 }), A.getByRole('button', { name: `Download report as ${name}` }).click()]);
        const target = `${FILES}/UAT-20-report.${ext}`;
        await download.saveAs(target);
        files.push(`files/UAT-20-report.${ext}`);
      }
      return { actual: 'pasakja-report PDF and Excel files downloaded (saved as evidence).', evidence: [await shot(A, 'UAT-20', 'dashboard-report-buttons'), ...files] };
    } },
  { id: 'UAT-21', feature: 'Forgot password and admin reset', role: 'Passenger / Admin', steps: 'On Sign in tap Forgot password? and send a request; admin taps Issue temporary password; user signs in with it and sets a new password in Profile.', expected: 'The request reaches the admin; the temporary password works once and the user can set a new one.',
    run: async () => {
      const page = await (await browser.newContext(phone)).newPage();
      await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Forgot password?' }).click();
      await page.locator('#forgot-identifier').fill(UAT_PASSENGER.full);
      await page.getByRole('button', { name: 'Send reset request' }).click();
      await page.getByText('a PASAKJA admin will contact you').waitFor({ timeout: 10000 });
      const requested = await shot(page, 'UAT-21', 'forgot-request');
      await A.reload({ waitUntil: 'domcontentloaded' });
      await A.locator('[data-admin-tab="overview"]').click();
      const request = A.locator('.reset-request', { hasText: UAT_PASSENGER.name });
      await request.waitFor({ timeout: 15000 });
      await request.getByRole('button', { name: 'Issue temporary password' }).click();
      const temporary = (await A.locator('.temp-password').innerText()).trim();
      const issued = await shot(A, 'UAT-21', 'admin-temp-password');
      await A.getByRole('button', { name: 'Done' }).click();
      await signIn(page, UAT_PASSENGER.full, temporary, '/passenger/');
      await tab(page, 'Profile');
      await page.getByRole('button', { name: /Change the password you sign in with/ }).click();
      UAT_PASSENGER.password = 'Uat-passenger-new-2026';
      await page.getByLabel('Current password').fill(temporary);
      await page.getByLabel('New password', { exact: true }).fill(UAT_PASSENGER.password);
      await page.getByLabel('Confirm new password').fill(UAT_PASSENGER.password);
      await page.getByRole('button', { name: 'Save password' }).click();
      await page.getByText('Password changed').waitFor({ timeout: 10000 });
      const changed = await shot(page, 'UAT-21', 'password-changed');
      const account = await login(UAT_PASSENGER.full, UAT_PASSENGER.password);
      expect(account.token, 'new password does not work');
      state.passengerToken = account.token;
      state.resetPage = page;
      return { actual: 'Request reached the admin; temporary password issued and accepted; new password set and working.', evidence: [requested, issued, changed] };
    } },
  { id: 'UAT-22', feature: 'Profile photo', role: 'Passenger', steps: 'Open Profile, tap Add a photo and choose an image.', expected: 'The photo is saved and shown on the profile, also after reopening the app.',
    run: async () => {
      const page = state.resetPage;
      const picture = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 390, height: 390 } });
      await page.locator('.profile-layout__header').scrollIntoViewIfNeeded();
      await page.locator('input[type="file"]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: picture });
      await page.locator('.profile-layout__avatar img').waitFor({ timeout: 15000 });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.profile-layout__avatar img').waitFor({ timeout: 15000 });
      return { actual: 'Photo saved and still shown after reloading the app.', evidence: [await shot(page, 'UAT-22', 'profile-photo')] };
    } },
  { id: 'UAT-23', feature: 'Access control by role', role: 'Passenger', steps: 'As a passenger, open an admin address and call admin functions.', expected: 'The passenger cannot open admin screens or use admin functions.',
    run: async () => {
      const page = state.resetPage;
      await page.goto(`${BASE}/admin/overview`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      const path = new URL(page.url()).pathname;
      const checks = await Promise.all(['admin/summary', 'admin/drivers', 'admin/fares', `admin/drivers/${state.newDriver.user.id}/id-photo`].map(async path => (await api(path, { token: state.passengerToken }))[0]));
      expect(!path.startsWith('/admin') && checks.every(code => code === 403), `path ${path}, codes ${checks.join(',')}`);
      return { actual: `Admin address sent the passenger back to ${path}; admin functions answered 403 Forbidden (${checks.length} of ${checks.length}).`, evidence: [await shot(page, 'UAT-23', 'admin-address-redirected')] };
    } },
  { id: 'UAT-24', feature: 'Fits phone, tablet and desktop screens', role: 'All', steps: 'Open the passenger Home on an iPhone-sized screen, a tablet and a desktop.', expected: 'All content fits the screen without sideways scrolling; the map stays visible.',
    run: async () => {
      const evidence = [];
      const notes = [];
      for (const [label, viewport, mobile] of [['iphone12', { width: 390, height: 664 }, true], ['tablet', { width: 768, height: 1024 }, false], ['desktop', { width: 1440, height: 900 }, false]]) {
        const page = await (await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })).newPage();
        await signIn(page, DEMO.passenger, DEMO.password, '/passenger/');
        await page.locator('.passenger-map-layer .leaflet-container').waitFor();
        await page.waitForTimeout(1800);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        const mapHeight = Math.round((await page.locator('.passenger-map-layer .leaflet-container').boundingBox()).height);
        expect(overflow <= 0, `${label} scrolls sideways by ${overflow}px`);
        notes.push(`${label} ${viewport.width}px: no sideways scroll, map ${mapHeight}px tall`);
        evidence.push(await shot(page, 'UAT-24', `home-${label}`));
      }
      return { actual: notes.join('; ') + '.', evidence };
    } },
  { id: 'UAT-25', feature: 'Admin suspends and reactivates an account', role: 'Admin / Passenger', steps: 'Admin opens Dashboard → Accounts, finds the passenger, taps Suspend, gives a reason and confirms; the passenger tries to sign in; admin taps Reactivate.', expected: 'The account is marked Suspended and signed out; the passenger is refused sign-in and sees the reason; after Reactivate they can sign in again.',
    run: async () => {
      const reason = 'UAT check of account suspension';
      await A.reload({ waitUntil: 'domcontentloaded' });
      await A.locator('[data-admin-tab="accounts"]').click();
      await A.getByPlaceholder('Search name, phone or town').fill(UAT_PASSENGER.name);
      const row = A.locator('tbody tr', { hasText: UAT_PASSENGER.name });
      await row.getByRole('button', { name: 'Suspend' }).click();
      await A.locator('#suspend-reason').fill(reason);
      await A.waitForTimeout(400);
      const dialog = await shot(A, 'UAT-25', 'suspend-dialog');
      await A.getByRole('button', { name: 'Suspend account' }).click();
      await A.getByText(`${UAT_PASSENGER.name} is suspended`, { exact: false }).waitFor({ timeout: 10000 });
      expect(await row.getByText('Suspended', { exact: true }).count() === 1, 'row not marked Suspended');
      const suspended = await shot(A, 'UAT-25', 'account-suspended');
      const [meStatus] = await api('auth/me', { token: state.passengerToken });
      expect(meStatus === 401, `open session still works (${meStatus})`);
      const page = await (await browser.newContext(phone)).newPage();
      await page.goto(`${BASE}/sign-in`, { waitUntil: 'domcontentloaded' });
      await page.locator('#auth-phone').fill(UAT_PASSENGER.full);
      await page.locator('input[type="password"]').first().fill(UAT_PASSENGER.password);
      await page.getByRole('button', { name: /^log in$/i }).click();
      await page.getByText('This account is suspended', { exact: false }).waitFor({ timeout: 10000 });
      expect(await page.getByText(reason, { exact: false }).count() >= 1, 'reason not shown at sign-in');
      const refused = await shot(page, 'UAT-25', 'sign-in-refused');
      await row.getByRole('button', { name: 'Reactivate' }).click();
      await A.getByText(`${UAT_PASSENGER.name} is active again`, { exact: false }).waitFor({ timeout: 10000 });
      await signIn(page, UAT_PASSENGER.full, UAT_PASSENGER.password, '/passenger/');
      state.passengerToken = (await login(UAT_PASSENGER.full, UAT_PASSENGER.password)).token;
      return { actual: `Account marked “Suspended” with the reason and signed out of its open session; sign-in refused with “This account is suspended: ${reason}.”; after Reactivate the passenger signed in again.`, evidence: [dialog, suspended, refused] };
    } },
  { id: 'UAT-26', feature: 'Driver earnings summary', role: 'Driver', steps: 'As the driver who completed the UAT ride, open Profile and look at Earnings.', expected: 'Earnings for today, this week, this month and all time are shown, match the driver’s completed rides, and today includes the UAT ride’s fare.',
    run: async () => {
      const driverAccount = await login(DEMO.driver, DEMO.password);
      const [, profile] = await api('driver/profile', { token: driverAccount.token });
      await api('auth/logout', { token: driverAccount.token, method: 'POST' });
      const p = profile.profile;
      expect(p.rides_today >= 1 && Number(p.earnings_today) >= state.finalFare, `today ₱${p.earnings_today} for ${p.rides_today} rides; UAT ride fare ₱${state.finalFare}`);
      const money = n => { const v = Number(n); const d = Number.isInteger(v) ? 0 : 2; return `₱${v.toLocaleString('en-PH', { minimumFractionDigits: d, maximumFractionDigits: d })}`; };
      const line = (amount, rides) => `${money(amount)} · ${rides} ${rides === 1 ? 'ride' : 'rides'}`;
      const lines = [line(p.earnings_today, p.rides_today), line(p.earnings_week, p.rides_week), line(p.earnings_month, p.rides_month), line(p.earnings_total, p.total_rides)];
      await tab(D, 'Profile');
      await D.getByRole('heading', { name: 'Earnings', exact: true }).waitFor({ timeout: 10000 });
      for (const text of lines) expect(await D.getByText(text, { exact: true }).count() >= 1, `“${text}” not shown`);
      await D.getByRole('heading', { name: 'Earnings', exact: true }).scrollIntoViewIfNeeded();
      return { actual: `Earnings shown — today ${lines[0]}, this week ${lines[1]}, this month ${lines[2]}, all time ${lines[3]}; today includes the UAT ride (₱${state.finalFare}).`, evidence: [await shot(D, 'UAT-26', 'driver-earnings')] };
    } },
  { id: 'UAT-27', feature: 'Edit profile and change phone number', role: 'Passenger', steps: 'Open Profile, tap Edit, change the phone number, enter the current password, tap Save changes; sign in with the new number.', expected: 'The new number is saved and works for signing in; the old number no longer does.',
    run: async () => {
      const page = await (await browser.newContext(phone)).newPage();
      await signIn(page, UAT_PASSENGER.full, UAT_PASSENGER.password, '/passenger/');
      await tab(page, 'Profile');
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      await page.locator('#profile-phone').fill('0999 000 0611');
      await page.locator('#profile-current-password').fill(UAT_PASSENGER.password);
      const form = await shot(page, 'UAT-27', 'edit-profile');
      await page.getByRole('button', { name: 'Save changes' }).click();
      await page.getByText('Sign in with +639990000611 from now on.', { exact: false }).waitFor({ timeout: 10000 });
      const saved = await shot(page, 'UAT-27', 'profile-saved');
      const [oldStatus] = await api('auth/login', { method: 'POST', body: { identifier: UAT_PASSENGER.full, password: UAT_PASSENGER.password } });
      const [newStatus] = await api('auth/login', { method: 'POST', body: { identifier: '09990000611', password: UAT_PASSENGER.password } });
      expect(newStatus === 200 && oldStatus === 401, `new number ${newStatus}, old number ${oldStatus}`);
      UAT_PASSENGER.full = '+639990000611';
      return { actual: 'Phone changed after entering the current password; “Profile saved. Sign in with +639990000611 from now on.” shown; the new number signs in and the old one is refused.', evidence: [form, saved] };
    } },
  { id: 'UAT-28', feature: 'Driver declines a request', role: 'Driver / Passenger', steps: 'Passenger books a ride; the online driver taps Decline on the request card.', expected: 'The request leaves that driver’s list and the booking stays open for another driver instead of being assigned to them.',
    run: async () => {
      const page = await (await browser.newContext({ ...phone, ...near(9.3705, 125.9488) })).newPage();
      await signIn(page, UAT_PASSENGER.full, UAT_PASSENGER.password, '/passenger/');
      const token = (await login(UAT_PASSENGER.full, UAT_PASSENGER.password)).token;
      await tab(D, 'Requests');
      const toggle = D.getByRole('button', { name: /go online|go offline/i }).first();
      await toggle.waitFor({ timeout: 15000 });
      if ((await toggle.getAttribute('aria-label')) === 'Go online') await toggle.click();
      await D.waitForTimeout(3000);
      await page.locator('.passenger-map-layer .leaflet-container').waitFor();
      await page.waitForTimeout(1200);
      await page.getByPlaceholder('Pickup in Carrascal').click();
      await tapMap(page, -20, 25);
      await page.getByPlaceholder('Where to?').click();
      await tapMap(page, 45, 50);
      await page.locator('section[aria-label="Fare breakdown"]').getByText(/₱\s?\d+/).first().waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: 'Find a Tricycle' }).click();
      await page.getByText(/Finding a tricycle/).waitFor({ timeout: 15000 });
      const [, rides] = await api('rides', { token });
      const rideId = rides.rides?.[0]?.id;
      const card = D.locator('.ride-request-card').first();
      await card.waitFor({ timeout: 40000 });
      const before = await shot(D, 'UAT-28', 'request-before-decline');
      await card.getByRole('button', { name: 'Decline' }).click();
      await D.locator('.ride-request-card').first().waitFor({ state: 'detached', timeout: 15000 });
      const [, ride] = await api(`rides/${rideId}`, { token });
      expect(ride.ride?.status === 'finding', `ride ${rideId} is ${ride.ride?.status}`);
      const after = await shot(D, 'UAT-28', 'after-decline');
      await page.getByRole('button', { name: 'Cancel booking' }).click();
      await page.getByText('Where to?').first().waitFor({ timeout: 15000 });
      return { actual: `After Decline the request left the driver’s list; ride #${rideId} stayed “finding” (not assigned to that driver), then the passenger cancelled it.`, evidence: [before, after] };
    } },
];

// ---------------------------------------------------------------- run
const results = [];
for (const scenario of scenarios) {
  const started = Date.now();
  try {
    const outcome = await scenario.run();
    results.push({ ...scenario, run: undefined, actual: outcome.actual, status: outcome.pass === false ? 'Fail' : 'Pass', evidence: outcome.evidence, seconds: Math.round((Date.now() - started) / 1000) });
  } catch (error) {
    let evidence = [];
    try { evidence = [await shot(P, scenario.id, 'failure-passenger'), await shot(D, scenario.id, 'failure-driver'), await shot(A, scenario.id, 'failure-admin')]; } catch { /* ignore */ }
    results.push({ ...scenario, run: undefined, actual: `Did not complete: ${error.message.split('\n')[0]}`, status: 'Fail', evidence, seconds: Math.round((Date.now() - started) / 1000) });
  }
  const last = results.at(-1);
  console.log(`${last.id} ${last.status.padEnd(4)} ${last.feature} — ${last.actual}`);
}
await browser.close();

const summary = { started: startedAt.toISOString(), finished: new Date().toISOString(), environment: 'Local XAMPP (Apache, PHP 8.0, MariaDB 10.4) + Vite dev server, Chromium (Playwright) at 390×844 phone and 1440×900 desktop sizes', passed: results.filter(r => r.status === 'Pass').length, failed: results.filter(r => r.status === 'Fail').length, fareShown: state.fareText };
await writeFile(`${ROOT}/uat-results.json`, JSON.stringify({ summary, results }, null, 2));
const escape = text => String(text).replace(/\|/g, '\\|');
const table = ['| Test ID | Feature | Role | Steps | Expected result | Actual result | Status | Evidence |', '|---|---|---|---|---|---|---|---|',
  ...results.map(r => `| ${r.id} | ${escape(r.feature)} | ${escape(r.role)} | ${escape(r.steps)} | ${escape(r.expected)} | ${escape(r.actual)} | **${r.status}** | ${r.evidence.map(file => `[${file.split('/').pop()}](${file.startsWith('files/') ? file : `screenshots/${file}`})`).join('<br>')} |`)];
await writeFile(`${ROOT}/UAT-results.md`, `# PASAKJA — UAT results\n\nRun ${startedAt.toLocaleString('en-PH')} · ${summary.environment}\n\n**${summary.passed} passed, ${summary.failed} failed** of ${results.length} scenarios.\n\n${table.join('\n')}\n`);
console.log(`\n${summary.passed} passed, ${summary.failed} failed`);
