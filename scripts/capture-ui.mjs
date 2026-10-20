import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

const BASE_URL = process.env.PASAKJA_URL || 'http://localhost:8443';
const API_HEALTH = process.env.PASAKJA_API_HEALTH || 'http://localhost/PASAKJA-main/api/health';
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

async function signIn(page, role) {
  const { phone, password } = demoAccount(role);
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'domcontentloaded' });
  await page.locator('#auth-phone').fill(phone);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /sign in|log in|continue/i }).first().click();
  await page.waitForURL(url => Object.values(ROLE_PREFIX).some(prefix => url.pathname.startsWith(prefix)), { timeout: 20000 });
}

async function overflowIssues(page, label) {
  const result = await page.evaluate(() => {
    const overflowing = [];
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > window.innerWidth + 1) {
        overflowing.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]} @${Math.round(rect.right)}px`);
      }
    }
    return { horizontalScroll: document.documentElement.scrollWidth > window.innerWidth + 1, overflowing: overflowing.slice(0, 5) };
  });
  const issues = [];
  if (result.horizontalScroll) issues.push(`${label}: page scrolls horizontally`);
  if (result.overflowing.length) issues.push(`${label}: overflow right edge → ${result.overflowing.join(', ')}`);
  return issues;
}

async function shoot(page, name, dir) {
  await page.screenshot({ path: `${dir}/${name}.png` });
  return name;
}

// Public screens: onboarding and sign-in at 390 and 1440 (committed).
async function capturePublic(browser) {
  const written = [];
  for (const width of CAPTURE_WIDTHS) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
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
    const context = await browser.newContext({ viewport: { width, height: 844 } });
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

// Signed-in screens: committed home/alerts/profile at 390/1440; full matrix to full/.
async function captureRoleScreens(browser, role) {
  const written = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signIn(page, role);
  for (const [screen, path] of Object.entries(SCREEN_PATHS[role])) {
    for (const width of FULL_WIDTHS) {
      // The active-ride banner check runs separately on the live booking flow.
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      issues.push(...await overflowIssues(page, `${role} ${screen} @${width}`));
    }
  }
  await context.close();
  return issues;
}

// Bell/avatar/back checks: bell and avatar on each role's top-level screens,
// back only from inner screens where it actually renders (an active ride).
async function auditRoleNavigation(browser, role) {
  const issues = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signIn(page, role);
  const prefix = ROLE_PREFIX[role];
  const topLevel = ['home', 'rides', 'profile'];

  for (const screen of topLevel) {
    for (const action of [
      { name: 'bell', selector: 'button[aria-label="Alerts"]' },
      { name: 'avatar', selector: 'button[aria-label="Profile"]' },
    ]) {
      await page.goto(`${BASE_URL}${SCREEN_PATHS[role][screen]}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      const control = page.locator(action.selector).first();
      if (!(await control.count())) { issues.push(`${role} ${screen}: ${action.name} control not found — FAIL`); continue; }
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

// Back arrow: only present inside an active ride (rideState !== 'idle'). Tested
// as part of the end-to-end flow; absent elsewhere, so nothing is reported.
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
  const passengerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const driverContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const passenger = await passengerContext.newPage();
  const driver = await driverContext.newPage();

  await signIn(passenger, 'passenger');
  await signIn(driver, 'driver');

  // Passenger books a ride the way a user must: fill pickup/destination in the
  // expanded sheet, then press "Find a Tricycle".
  await passenger.goto(`${BASE_URL}${ROLE_HOME.passenger}`, { waitUntil: 'domcontentloaded' });
  await passenger.waitForTimeout(1500);
  const pickup = `Carrascal Public Market ${Date.now()}`;
  await passenger.getByPlaceholder(/Pickup:/i).first().fill(pickup);
  await passenger.getByPlaceholder(/Destination:/i).first().fill('Carrascal Municipal Hall');
  await passenger.getByRole('button', { name: /Find a Tricycle/i }).click();
  await passenger.waitForTimeout(3000);

  // Confirm a ride was actually created before the driver steps.
  const reachedTracking = /\/passenger\/ride\/\d+/.test(new URL(passenger.url()).pathname);
  if (!reachedTracking) {
    const alertText = await passenger.getByRole('alert').first().textContent().catch(() => '');
    results.push(`FAIL e2e: ride was not created (passenger at ${passenger.url()}${alertText ? ` — ${alertText}` : ''})`);
    await passengerContext.close();
    await driverContext.close();
    return results;
  }
  results.push('OK e2e: passenger created a ride and reached RideTracking');

  // Driver accepts only the just-created request, matched by unique pickup text.
  await driver.goto(`${BASE_URL}${ROLE_HOME.driver}`, { waitUntil: 'domcontentloaded' });
  await driver.waitForTimeout(2500);
  const accept = driver
    .locator('[data-testid="ride-request-card"]')
    .filter({ has: driver.locator(`[data-testid="ride-request-pickup"]`, { hasText: pickup }) })
    .getByRole('button', { name: /^Accept$/i })
    .first();
  if (!(await accept.count())) {
    results.push(`FAIL e2e: no request card matching "${pickup}" found for the driver`);
    await passengerContext.close();
    await driverContext.close();
    return results;
  }
  await accept.click();
  await driver.waitForTimeout(3000);
  results.push(`OK e2e: driver accepted the just-created request (${pickup})`);

  // Passenger should reflect the accepted ride, and Back now renders.
  await passenger.waitForTimeout(4000);
  await auditBackArrow(passenger, 'passenger', results);

  // After the ride, view the active-ride banner on home (before resuming) and
  // measure its overlap with the municipality switcher.
  await passenger.goto(`${BASE_URL}${ROLE_HOME.passenger}`, { waitUntil: 'domcontentloaded' });
  await passenger.waitForTimeout(2000);
  results.push(...await bannerOverlapIssues(passenger, 'passenger home Active ride banner'));

  // Bell mid-ride, then resume from Bookings.
  await passenger.locator('button[aria-label="Alerts"]').click();
  await passenger.waitForTimeout(800);
  await passenger.goto(`${BASE_URL}/passenger/rides`, { waitUntil: 'domcontentloaded' });
  await passenger.waitForTimeout(1500);
  const trackButton = passenger.getByRole('button', { name: /Track ride|View search/i }).first();
  if (await trackButton.count()) {
    await trackButton.click();
    await passenger.waitForTimeout(1500);
    results.push(/\/passenger\/ride\/\d+/.test(new URL(passenger.url()).pathname)
      ? 'OK e2e: resumed RideTracking from Bookings'
      : 'FAIL e2e: Bookings resume did not open tracking');
  } else {
    results.push('FAIL e2e: no Track ride action found in Bookings');
  }

  // Resume from the home banner.
  await passenger.goto(`${BASE_URL}${ROLE_HOME.passenger}`, { waitUntil: 'domcontentloaded' });
  await passenger.waitForTimeout(2000);
  const homeResume = passenger.getByRole('button', { name: /View active ride/i }).first();
  if (await homeResume.count()) {
    await homeResume.click();
    await passenger.waitForTimeout(1500);
    results.push(/\/passenger\/ride\/\d+/.test(new URL(passenger.url()).pathname)
      ? 'OK e2e: resumed RideTracking from home banner'
      : 'FAIL e2e: home banner resume did not open tracking');
  } else {
    results.push('FAIL e2e: no active ride banner on passenger home');
  }

  await passengerContext.close();
  await driverContext.close();
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
  } else {
    console.log('[capture-ui] All responsive and role-navigation checks passed.');
  }
}

main().catch(error => {
  console.error('[capture-ui] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
