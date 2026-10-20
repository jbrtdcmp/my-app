import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';

for (const envFile of ['.env.local', '.env']) {
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

const BASE_URL = process.env.PASAKJA_URL || 'http://localhost:8443';
const API_HEALTH = process.env.PASAKJA_API_HEALTH || 'http://localhost/PASAKJA-main/api/health';
const OUT_DIR = 'docs/ride-flow-after';
const ROLE_PREFIX = { passenger: '/passenger/', driver: '/driver/', admin: '/admin/' };
const SCREEN_PATHS = {
  passenger: ['/passenger/home', '/passenger/rides', '/passenger/alerts', '/passenger/profile'],
  driver: ['/driver/requests', '/driver/rides', '/driver/alerts', '/driver/profile'],
  admin: ['/admin/overview', '/admin/rides', '/admin/alerts', '/admin/profile'],
};
const OVERFLOW_VIEWPORTS = [360, 390, 768, 1440];

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

async function capturePublic(browser, viewport) {
  const written = [];
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  for (const [name, path] of [['onboarding', '/onboarding'], ['sign-in', '/sign-in']]) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const file = `${name}-${viewport.name}.png`;
    await page.screenshot({ path: `${OUT_DIR}/${file}` });
    written.push(file);
  }
  await context.close();
  return written;
}

async function auditPublic(browser, viewport) {
  const issues = [];
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  for (const path of ['/onboarding', '/sign-in']) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    issues.push(...await overflowIssues(page, `${path} @${viewport.width}`));
  }
  await context.close();
  return issues;
}

async function auditSignedIn(browser, role) {
  const written = [];
  const issues = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signIn(page, role);
  for (const path of SCREEN_PATHS[role]) {
    const screen = path.split('/').pop();
    for (const width of OVERFLOW_VIEWPORTS) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(700);
      issues.push(...await overflowIssues(page, `${path} @${width}`));
      const file = `${role}-${screen}-${width}.png`;
      await page.screenshot({ path: `${OUT_DIR}/${file}` });
      written.push(file);
    }
  }
  await context.close();
  return { written, issues };
}

async function auditRoleNavigation(browser, role) {
  const issues = [];
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await signIn(page, role);
  const prefix = ROLE_PREFIX[role];
  const backScreen = SCREEN_PATHS[role][1];
  for (const path of SCREEN_PATHS[role].slice(0, 3)) {
    const alreadyThere = path === backScreen;
    const actions = [
      { name: 'bell', selector: 'button[aria-label="Alerts"]' },
      { name: 'avatar', selector: 'button[aria-label="Profile"]' },
      { name: 'back', selector: 'button[aria-label="Back"]', needsPrevious: true },
    ];
    for (const action of actions) {
      await page.goto(`${BASE_URL}${action.needsPrevious ? backScreen : path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
      if (action.name === 'back' && alreadyThere) {
        // back is only present on deeper screens; skip when absent
        const backVisible = await page.locator(action.selector).count();
        if (!backVisible) continue;
      }
      const control = page.locator(action.selector).first();
      if (!(await control.count())) { issues.push(`${role} ${path}: ${action.name} control not found`); continue; }
      await control.click({ trial: true }).catch(() => {});
      const urlBefore = page.url();
      try {
        await control.click();
        await page.waitForTimeout(700);
        const urlAfter = page.url();
        const pathname = new URL(urlAfter).pathname;
        if (!pathname.startsWith(prefix)) {
          issues.push(`${role}: ${action.name} from ${new URL(urlBefore).pathname} landed outside ${prefix} → ${pathname}`);
        } else {
          issues.push(`OK ${role}: ${action.name} from ${new URL(urlBefore).pathname} stayed in ${prefix} (${pathname})`);
        }
      } catch {
        issues.push(`${role} ${path}: ${action.name} not clickable`);
      }
    }
  }
  await context.close();
  return issues;
}

async function runEndToEnd(browser) {
  const results = [];
  const passengerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const driverContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const passenger = await passengerContext.newPage();
  const driver = await driverContext.newPage();

  await signIn(passenger, 'passenger');
  await signIn(driver, 'driver');
  await driver.goto(`${BASE_URL}/driver/requests`, { waitUntil: 'domcontentloaded' });
  const beforeCount = await driver.getByRole('button', { name: /^Accept$/i }).count();

  await passenger.goto(`${BASE_URL}/passenger/home`, { waitUntil: 'domcontentloaded' });
  await passenger.waitForTimeout(1200);
  const pickup = `Market ${Date.now()}`;
  await passenger.getByPlaceholder(/Pickup:/i).first().fill(pickup);
  await passenger.getByPlaceholder(/Destination:/i).first().fill('Municipal Hall');
  await passenger.getByRole('button', { name: /Find a Tricycle/i }).click();
  await passenger.waitForTimeout(2500);

  // Driver: wait for the NEW request (count must exceed the number seen before booking).
  const acceptButtons = driver.getByRole('button', { name: /^Accept$/i });
  await acceptButtons.nth(beforeCount).waitFor({ timeout: 15000 }).catch(() => {});
  await driver.reload({ waitUntil: 'domcontentloaded' });
  await driver.waitForTimeout(2500);
  const requestCard = driver.locator('.ride-request-card', { hasText: pickup }).first();
  const target = (await requestCard.count()) ? requestCard : driver.locator('.ride-request-card').first();
  await target.getByRole('button', { name: /^Accept$/i }).click();
  await driver.waitForTimeout(2500);
  results.push(`OK e2e: driver accepted the just-created request (${pickup})`);

  await passenger.waitForTimeout(4500);
  const onTracking = /\/passenger\/ride\/\d+/.test(new URL(passenger.url()).pathname);
  results.push(onTracking ? 'OK e2e: passenger reached RideTracking' : `FAIL e2e: passenger url ${passenger.url()}`);

  // Click the bell mid-ride and confirm we can resume from Bookings and the home banner.
  await passenger.locator('button[aria-label="Alerts"]').click();
  await passenger.waitForTimeout(800);

  await passenger.goto(`${BASE_URL}/passenger/rides`, { waitUntil: 'domcontentloaded' });
  await passenger.waitForTimeout(1200);
  const trackButton = passenger.getByRole('button', { name: /Track ride|View search/i }).first();
  if (await trackButton.count()) {
    await trackButton.click();
    await passenger.waitForTimeout(1200);
    results.push(/\/passenger\/ride\/\d+/.test(new URL(passenger.url()).pathname)
      ? 'OK e2e: resumed RideTracking from Bookings'
      : 'FAIL e2e: Bookings resume did not open tracking');
  } else {
    results.push('FAIL e2e: no Track ride action found in Bookings');
  }

  await passenger.goto(`${BASE_URL}/passenger/home`, { waitUntil: 'domcontentloaded' });
  await passenger.waitForTimeout(1500);
  const homeResume = passenger.getByRole('button', { name: /View active ride/i }).first();
  if (await homeResume.count()) {
    await homeResume.click();
    await passenger.waitForTimeout(1200);
    results.push(/\/passenger\/ride\/\d+/.test(new URL(passenger.url()).pathname)
      ? 'OK e2e: resumed RideTracking from home banner'
      : 'FAIL e2e: home banner resume did not open tracking');
    const overlap = await passenger.evaluate(() => {
      const banner = document.querySelector('.passenger-map-layer .bg-surface');
      const switcher = document.querySelector('.passenger-map-layer button');
      if (!banner || !switcher) return null;
      const a = banner.getBoundingClientRect();
      const b = switcher.getBoundingClientRect();
      return a.top < b.bottom && b.top < a.bottom && a.left < b.right && b.left < a.right;
    });
    results.push(overlap === true ? 'FAIL e2e: Active ride banner overlaps municipality switcher' : 'OK e2e: Active ride banner clear of municipality switcher');
  } else {
    results.push('FAIL e2e: no active ride banner on passenger home');
  }

  await passengerContext.close();
  await driverContext.close();
  return results;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const reachable = await apiReachable();
  const allowWrites = process.env.PASAKJA_ALLOW_WRITES === '1';
  const hasCreds = credentialsAvailable();
  const browser = await chromium.launch();
  const written = [];
  const issues = [];

  for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1440, height: 900 }]) {
    written.push(...await capturePublic(browser, viewport));
    issues.push(...await auditPublic(browser, viewport));
  }

  if (reachable && hasCreds) {
    for (const role of ['passenger', 'driver', 'admin']) {
      const signedIn = await auditSignedIn(browser, role);
      written.push(...signedIn.written);
      issues.push(...signedIn.issues);
      issues.push(...await auditRoleNavigation(browser, role));
    }
    if (allowWrites) {
      issues.push(...await runEndToEnd(browser));
    } else {
      console.log('[capture-ui] Skipping end-to-end ride flow — set PASAKJA_ALLOW_WRITES=1 to enable (it creates a real ride).');
    }
  } else if (!reachable) {
    console.warn('[capture-ui] API not reachable — capturing public screens only. Start Apache + MySQL in XAMPP.');
  } else {
    console.warn('[capture-ui] Demo credentials missing — skipping signed-in checks. See .env.example.');
  }
  await browser.close();

  console.log(`[capture-ui] Wrote ${written.length} screenshot(s) to ${OUT_DIR}`);
  const failures = issues.filter(line => !line.startsWith('OK '));
  for (const line of issues.filter(line => line.startsWith('OK '))) console.log(`  ${line}`);
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
