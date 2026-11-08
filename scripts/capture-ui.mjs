import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

const BASE_URL = process.env.PASAKJA_URL || 'http://localhost:5173';
const API_HEALTH = process.env.PASAKJA_API_HEALTH || 'http://localhost/PASAKJA-main/api/health';
const API_BASE = (process.env.VITE_API_BASE_URL || process.env.PASAKJA_API_BASE || 'http://localhost/PASAKJA-main/api').replace(/\/$/, '');
const OUT_DIR = 'docs/ride-flow-after';
const FULL_DIR = `${OUT_DIR}/full`;
const ROLE_PREFIX = { passenger: '/passenger/', driver: '/driver/', admin: '/admin/' };
const ROLE_HOME = { passenger: '/passenger/home', driver: '/driver/requests', admin: '/admin/overview' };
const SCREEN_PATHS = {
  passenger: { home: '/passenger/home', rides: '/passenger/rides', alerts: '/passenger/alerts', profile: '/passenger/profile' },
  driver: { home: '/driver/requests', rides: '/driver/rides', alerts: '/driver/alerts', profile: '/driver/profile' },
  admin: { home: '/admin/overview', rides: '/admin/rides', alerts: '/admin/alerts', profile: '/admin/profile' },
};
// Committed set stays small: public screens at 390/1440 and each role's
// home/alerts/profile at 390/1440. The full width matrix goes to full/ (gitignored).
const CAPTURE_WIDTHS = [390, 1440];
const FULL_WIDTHS = [360, 390, 768, 1440];
const PUBLIC_SCREENS = { onboarding: '/onboarding', 'sign-in': '/sign-in' };
const COMMITTED_ROLE_SCREENS = ['home', 'alerts', 'profile'];
const ROLE_READY = {
  passenger: '.app-bottom-sheet, nav, [data-testid="municipality-switcher"]',
  driver: 'text=Driver Dashboard',
  admin: 'text=/overview|dashboard|rides/i',
};
// Realistic GPS near Carrascal, Surigao del Sur so map/ride features behave.
const GEO = { latitude: 9.3697, longitude: 125.9497 };
const GEO_OPTIONS = { latitude: GEO.latitude, longitude: GEO.longitude };
const GEO_PERMISSIONS = ['geolocation'];

function demoAccount(role) {
  const phone = process.env[`PASAKJA_DEMO_${role.toUpperCase()}_PHONE`];
  const password = process.env.PASAKJA_DEMO_PASSWORD;
  if (!phone?.trim() || !password) {
    throw new Error(
      `Missing demo credentials. Set PASAKJA_DEMO_${role.toUpperCase()}_PHONE and PASAKJA_DEMO_PASSWORD ` +
        '(see .env.example). Credentials are never printed.',
    );
  }
  return { phone, password };
}

function credentialsAvailable() {
  return ['passenger', 'driver', 'admin'].every(role => process.env[`PASAKJA_DEMO_${role.toUpperCase()}_PHONE`]?.trim()) && Boolean(process.env.PASAKJA_DEMO_PASSWORD);
}

async function apiReachable() {
  try {
    const response = await fetch(API_HEALTH, { signal: AbortSignal.timeout(4000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function newContext(browser, width = 390) {
  return browser.newContext({
    viewport: { width, height: 844 },
    geolocation: GEO_OPTIONS,
    permissions: GEO_PERMISSIONS,
  });
}

// Sign-in: the map screens keep tiles + polling going forever, so 'load' never
// fires. Wait for the URL commit, then for a role-specific element to render.
async function signIn(page, role) {
  const { phone, password } = demoAccount(role);
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'domcontentloaded' });
  await page.locator('#auth-phone').fill(phone);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /sign in|log in|continue/i }).first().click();
  await page.waitForURL(
    url => Object.values(ROLE_PREFIX).some(prefix => url.pathname.startsWith(prefix)),
    { timeout: 20000, waitUntil: 'commit' },
  );
  await page.locator(ROLE_READY[role]).first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
}

function parseRideId(pathname) {
  const match = pathname.match(/\/passenger\/ride\/(\d+)/);
  return match ? Number(match[1]) : null;
}

async function authToken(page) {
  return page.evaluate(() => localStorage.getItem('pasakja_auth_token') || '').catch(() => '');
}

async function activeRideForPassenger(page) {
  const token = await authToken(page);
  if (!token) return null;
  try {
    const response = await fetch(`${API_BASE}/rides`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    const rides = Array.isArray(body) ? body : body.rides ?? [];
    return rides.find(ride => ['finding', 'accepted', 'arriving', 'in_progress'].includes(ride.status)) ?? null;
  } catch {
    return null;
  }
}

async function cancelRide(page, rideId) {
  const token = await authToken(page);
  if (!token) return false;
  try {
    const response = await fetch(`${API_BASE}/rides/${rideId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Poll a predicate until it is true or the timeout elapses.
async function waitFor(predicate, timeout, interval = 500) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}

// Landmark chips only carry a pin when they define coordinates. Otherwise the
// app asks the passenger to confirm the point, so tap the map for them.
async function chooseLandmarkPin(page, testId, field) {
  await page.locator(`[data-testid="${testId}"]`).click();
  const mapHint = page.locator('.pasakja-map-hint');
  const needsPin = await waitFor(async () => {
    if ((await mapHint.count()) === 0) return false;
    const text = await mapHint.first().textContent().catch(() => '');
    return /Tap the map to confirm/i.test(text ?? '');
  }, 2000, 100);
  if (!needsPin) return;
  const position = field === 'pickup' ? { x: 120, y: 140 } : { x: 260, y: 220 };
  await page.locator('.pasakja-leaflet-map').click({ position });
  await waitFor(async () => (await page.locator('.pasakja-map-hint').count()) === 0, 5000, 100);
}

// Overflow audit: ignore Leaflet internals and any horizontally scrollable
// ancestor (chip rows are meant to scroll). Report only a sideways-scrolling
// document or an element overflowing the viewport outside such containers.
async function overflowIssues(page, label) {
  const result = await page.evaluate(() => {
    const label = el => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60);
    const insideScrollable = el => {
      let node = el.parentElement;
      while (node && node !== document.body) {
        if (node.classList.contains('leaflet-container')) return true;
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return true;
        node = node.parentElement;
      }
      return false;
    };
    const overflowing = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('.leaflet-container')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.right <= window.innerWidth + 1) continue;
      if (insideScrollable(el)) continue;
      overflowing.push(`${el.tagName.toLowerCase()}${label(el) ? ` "${label(el)}"` : ''} @${Math.round(rect.right)}px`);
    }
    return {
      horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      overflowing: overflowing.slice(0, 5),
    };
  });
  const issues = [];
  if (result.horizontalScroll) issues.push(`${label}: page scrolls horizontally`);
  if (result.overflowing.length) issues.push(`${label}: overflow right edge → ${result.overflowing.join(', ')}`);
  return issues;
}

// Admin overview: explicitly check whether the page itself scrolls sideways.
async function auditAdminOverviewSideways(page, width) {
  const result = await page.evaluate(() => {
    const scrolls = document.documentElement.scrollWidth > window.innerWidth + 1;
    if (!scrolls) return { scrolls, offender: '' };
    let offender = '';
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('.leaflet-container')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > window.innerWidth + 1) {
        offender = `${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60)}" @${Math.round(rect.right)}px`;
        break;
      }
    }
    return { scrolls, offender };
  });
  if (!result.scrolls) return [];
  return [`FAIL admin overview @${width}: page scrolls sideways${result.offender ? ` — ${result.offender}` : ''}`];
}

async function shoot(page, name, dir) {
  await page.screenshot({ path: `${dir}/${name}.png` });
  return name;
}

async function capturePublic(browser) {
  const written = [];
  for (const width of CAPTURE_WIDTHS) {
    const context = await newContext(browser, width);
    const page = await context.newPage();
    for (const [name, path] of Object.entries(PUBLIC_SCREENS)) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700);
      written.push(await shoot(page, `${name}-${width}`, OUT_DIR));
    }
    await context.close();
  }
  return written;
}

async function auditPublic(browser) {
  const issues = [];
  for (const width of FULL_WIDTHS) {
    const context = await newContext(browser, width);
    const page = await context.newPage();
    for (const [name, path] of Object.entries(PUBLIC_SCREENS)) {
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      issues.push(...await overflowIssues(page, `${path} @${width}`));
      await shoot(page, `${name}-${width}`, FULL_DIR);
    }
    await context.close();
  }
  return issues;
}

async function captureRoleScreens(browser, role) {
  const written = [];
  const context = await newContext(browser);
  const page = await context.newPage();
  await signIn(page, role);
  for (const [screen, path] of Object.entries(SCREEN_PATHS[role])) {
    for (const width of FULL_WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700);
      if (COMMITTED_ROLE_SCREENS.includes(screen) && CAPTURE_WIDTHS.includes(width)) {
        written.push(await shoot(page, `${role}-${screen}-${width}`, OUT_DIR));
      }
      await shoot(page, `${role}-${screen}-${width}`, FULL_DIR);
    }
  }
  await context.close();
  return written;
}

async function auditRoleScreens(browser, role) {
  const issues = [];
  const context = await newContext(browser);
  const page = await context.newPage();
  await signIn(page, role);
  for (const [screen, path] of Object.entries(SCREEN_PATHS[role])) {
    for (const width of FULL_WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      issues.push(...await overflowIssues(page, `${role} ${screen} @${width}`));
      if (role === 'admin' && screen === 'home' && [360, 390, 768].includes(width)) {
        issues.push(...await auditAdminOverviewSideways(page, width));
      }
    }
  }
  await context.close();
  return issues;
}

async function auditRoleNavigation(browser, role) {
  const issues = [];
  const context = await newContext(browser);
  const page = await context.newPage();
  await signIn(page, role);
  const prefix = ROLE_PREFIX[role];
  const topLevel = ['home', 'rides', 'profile'];

  for (const screen of topLevel) {
    // Every role's tab bar has Rides and Profile tabs.
    for (const action of [
      { name: 'Rides tab', label: 'Rides' },
      { name: 'Profile tab', label: 'Profile' },
    ]) {
      await page.goto(`${BASE_URL}${SCREEN_PATHS[role][screen]}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const control = page.locator('nav[aria-label="Main navigation"]:visible button').filter({ hasText: action.label }).first();
      if (!(await control.count())) { issues.push(`FAIL ${role} ${screen}: ${action.name} control not found`); continue; }
      const from = new URL(page.url()).pathname;
      await control.click();
      await page.waitForTimeout(700);
      const to = new URL(page.url()).pathname;
      if (!to.startsWith(prefix)) issues.push(`FAIL ${role}: ${action.name} from ${from} left ${prefix} → ${to}`);
      else issues.push(`OK ${role}: ${action.name} from ${from} stayed in ${prefix} (${to})`);
    }
  }
  await context.close();
  return issues;
}

async function auditBackArrow(page, role, extraIssues) {
  const prefix = ROLE_PREFIX[role];
  const back = page.locator('button[aria-label="Back"]').first();
  if (!(await back.count())) {
    extraIssues.push(`${role}: no Back control on this screen — skipped`);
    return;
  }
  const from = new URL(page.url()).pathname;
  await back.click();
  await page.waitForTimeout(700);
  const to = new URL(page.url()).pathname;
  if (!to.startsWith(prefix)) extraIssues.push(`FAIL ${role}: Back from ${from} left ${prefix} → ${to}`);
  else extraIssues.push(`OK ${role}: Back from ${from} stayed in ${prefix} (${to})`);
}

// Banner overlap: measured on /passenger/home BEFORE clicking "View active ride".
function bannerOverlapIssues(page, label) {
  return page.evaluate(() => {
    const banner = document.querySelector('[data-testid="active-ride-banner"]');
    const switcher = document.querySelector('[data-testid="municipality-switcher"]');
    if (!banner) return ['banner not found'];
    if (!switcher) return ['municipality switcher not found'];
    const a = banner.getBoundingClientRect();
    const b = switcher.getBoundingClientRect();
    const overlaps = a.top < b.bottom && b.top < a.bottom && a.left < b.right && b.left < a.right;
    return overlaps ? ['banner overlaps municipality switcher'] : [];
  }).then(problems => problems.map(problem => `FAIL ${label}: ${problem}`));
}

async function runEndToEnd(browser) {
  const results = [];
  const passengerContext = await newContext(browser);
  const driverContext = await newContext(browser);
  const passenger = await passengerContext.newPage();
  const driver = await driverContext.newPage();
  let createdRideId = null;

  try {
    await signIn(passenger, 'passenger');
    await signIn(driver, 'driver');

    // Stop early if the passenger is already mid-ride — we must not add another.
    const existing = await activeRideForPassenger(passenger);
    if (existing) {
      results.push(`FAIL e2e: passenger already has an active ride (id ${existing.id}, status ${existing.status}); cancel it before running the write flow`);
      return results;
    }

    await passenger.goto(`${BASE_URL}${ROLE_HOME.passenger}`, { waitUntil: 'domcontentloaded' });
    await passenger.waitForTimeout(1500);
    await chooseLandmarkPin(passenger, 'pickup-landmark-c1', 'pickup');
    await chooseLandmarkPin(passenger, 'destination-landmark-c2', 'destination');
    const findButton = passenger.getByRole('button', { name: /Find a Tricycle/i }).first();
    const fareReady = await waitFor(async () => (await findButton.count()) > 0 && await findButton.isEnabled(), 20000);
    if (!fareReady) {
      const alertText = await passenger.getByRole('alert').first().textContent().catch(() => '');
      results.push(`FAIL e2e: fare estimate did not become ready (passenger at ${passenger.url()}${alertText ? ` — ${alertText}` : ''})`);
      return results;
    }
    await findButton.click();

    const reachedTracking = await waitFor(
      async () => parseRideId(new URL(passenger.url()).pathname) !== null,
      15000,
    );
    createdRideId = parseRideId(new URL(passenger.url()).pathname);
    if (!reachedTracking) {
      const alertText = await passenger.getByRole('alert').first().textContent().catch(() => '');
      results.push(`FAIL e2e: ride was not created (passenger at ${passenger.url()}${alertText ? ` — ${alertText}` : ''})`);
      return results;
    }
    results.push(`OK e2e: passenger created ride ${createdRideId} and reached RideTracking`);

    // Driver accepts only the just-created request, matched by ride id.
    await driver.goto(`${BASE_URL}${ROLE_HOME.driver}`, { waitUntil: 'domcontentloaded' });
    const accept = driver
      .locator(`[data-testid="ride-request-card"][data-ride-id="${createdRideId}"]`)
      .getByRole('button', { name: /^Accept$/i })
      .first();
    const cardReady = await waitFor(async () => (await accept.count()) > 0, 20000);
    if (!cardReady) {
      results.push(`FAIL e2e: no request card for ride ${createdRideId} appeared for the driver within 20s`);
      return results;
    }
    await accept.click();
    await driver.waitForTimeout(3000);
    results.push(`OK e2e: driver accepted the just-created request (ride ${createdRideId})`);

    // Passenger reflects the accepted ride, and Back now renders.
    await passenger.waitForTimeout(4000);
    await auditBackArrow(passenger, 'passenger', results);

    // View the active-ride banner on home and measure overlap with the switcher
    // at both narrow widths users hit on phones.
    for (const width of [360, 390]) {
      await passenger.setViewportSize({ width, height: 844 });
      await passenger.goto(`${BASE_URL}${ROLE_HOME.passenger}`, { waitUntil: 'domcontentloaded' });
      const bannerReady = await waitFor(async () => (await passenger.locator('[data-testid="active-ride-banner"]').count()) > 0, 10000);
      if (!bannerReady) {
        results.push(`FAIL e2e: active ride banner did not appear on home @${width} within 10s`);
        continue;
      }
      results.push(...await bannerOverlapIssues(passenger, `passenger home Active ride banner @${width}`));
    }

    // Leave for the Alerts tab, then resume from Bookings.
    await passenger.setViewportSize({ width: 390, height: 844 });
    await passenger.locator('nav[aria-label="Main navigation"]:visible button').filter({ hasText: 'Alerts' }).click();
    await passenger.waitForTimeout(800);
    await passenger.goto(`${BASE_URL}/passenger/rides`, { waitUntil: 'domcontentloaded' });
    await passenger.waitForTimeout(1500);
    const trackButton = passenger.getByRole('button', { name: /Track ride|View search/i }).first();
    if (await trackButton.count()) {
      await trackButton.click();
      const resumed = await waitFor(async () => parseRideId(new URL(passenger.url()).pathname) !== null, 15000);
      results.push(resumed ? 'OK e2e: resumed RideTracking from Bookings' : 'FAIL e2e: Bookings resume did not open tracking within 15s');
    } else {
      results.push('FAIL e2e: no Track ride action found in Bookings');
    }

    // Resume from the home banner.
    await passenger.goto(`${BASE_URL}${ROLE_HOME.passenger}`, { waitUntil: 'domcontentloaded' });
    const homeResumeReady = await waitFor(async () => (await passenger.getByRole('button', { name: /View active ride/i }).count()) > 0, 10000);
    if (homeResumeReady) {
      await passenger.getByRole('button', { name: /View active ride/i }).first().click();
      const resumed = await waitFor(async () => parseRideId(new URL(passenger.url()).pathname) !== null, 15000);
      results.push(resumed ? 'OK e2e: resumed RideTracking from home banner' : 'FAIL e2e: home banner resume did not open tracking within 15s');
    } else {
      results.push('FAIL e2e: no active ride banner on passenger home within 10s');
    }
  } finally {
    // Always leave the system clean: cancel the ride the run created.
    if (createdRideId !== null) {
      const cancelled = await cancelRide(passenger, createdRideId);
      if (cancelled) results.push(`OK e2e: cancelled created ride ${createdRideId}`);
      else results.push(`FAIL e2e: could not cancel created ride ${createdRideId} — cancel it manually`);
    }
    await passengerContext.close();
    await driverContext.close();
  }
  return results;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(FULL_DIR, { recursive: true });
  const reachable = await apiReachable();
  const allowWrites = process.env.PASAKJA_ALLOW_WRITES === '1';
  const hasCreds = credentialsAvailable();
  const browser = await chromium.launch();
  const written = [];
  const issues = [];

  written.push(...await capturePublic(browser));
  issues.push(...await auditPublic(browser));

  if (reachable && hasCreds) {
    for (const role of ['passenger', 'driver', 'admin']) {
      written.push(...await captureRoleScreens(browser, role));
      issues.push(...await auditRoleScreens(browser, role));
      issues.push(...await auditRoleNavigation(browser, role));
    }
    if (allowWrites) {
      issues.push(...await runEndToEnd(browser));
    } else {
      console.log('[capture-ui] Skipping end-to-end ride flow — set PASAKJA_ALLOW_WRITES=1 to enable (it creates a real ride).');
    }
  } else if (!reachable) {
    console.warn('[capture-ui] API not reachable — capturing and auditing public screens only. Start Apache + MySQL in XAMPP.');
  } else {
    console.warn('[capture-ui] Demo credentials missing — skipping signed-in checks. See .env.example.');
  }
  await browser.close();

  console.log(`[capture-ui] Wrote ${written.length} committed screenshot(s) to ${OUT_DIR} (full matrix in ${FULL_DIR}/)`);
  const failures = issues.filter(line => line.startsWith('FAIL') || (!line.startsWith('OK ') && !line.includes('— skipped')));
  const skipped = issues.filter(line => line.includes('— skipped'));
  for (const line of issues.filter(line => line.startsWith('OK '))) console.log(`  ${line}`);
  for (const line of skipped) console.log(`  (${line})`);
  if (failures.length) {
    console.warn(`[capture-ui] ${failures.length} issue(s):`);
    for (const line of failures) console.warn(`  - ${line}`);
    process.exitCode = 1;
  } else {
    console.log('[capture-ui] All responsive and role-navigation checks passed.');
  }
}

main().catch(error => {
  console.error('[capture-ui] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
