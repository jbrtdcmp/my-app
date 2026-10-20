import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.PASAKJA_URL || 'http://localhost:8443';
const API_HEALTH = process.env.PASAKJA_API_HEALTH || 'http://localhost/PASAKJA-main/api/health';
const OUT_DIR = 'docs/ride-flow-after';
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 },
];
const DEMO = {
  passenger: { phone: '09170000001', password: 'Demo1234!' },
  driver: { phone: '09170000002', password: 'Demo1234!' },
};

async function apiReachable() {
  try {
    const response = await fetch(API_HEALTH, { signal: AbortSignal.timeout(4000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function signIn(page, { phone, password }) {
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/phone|email/i).first().fill(phone);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /sign in|log in|continue/i }).first().click();
  await page.waitForURL(url => /\/passenger\/|\/driver\/|\/admin\//.test(url.pathname), { timeout: 15000 });
}

async function captureAuthenticated(browser, viewport) {
  const results = [];
  const passengerContext = await browser.newContext({ viewport });
  const passenger = await passengerContext.newPage();
  await signIn(passenger, DEMO.passenger);

  // Ride request flow
  await passenger.goto(`${BASE_URL}/passenger/home`, { waitUntil: 'domcontentloaded' });
  await passenger.waitForTimeout(1500);
  await passenger.screenshot({ path: `${OUT_DIR}/passenger-home-${viewport.name}.png` });
  results.push(`passenger-home-${viewport.name}.png`);

  await passenger.getByPlaceholder(/Pickup:/i).first().fill('Carrascal Public Market');
  await passenger.getByPlaceholder(/Destination:/i).first().fill('Carrascal Municipal Hall');
  await passenger.getByRole('button', { name: /Find a Tricycle/i }).click();
  await passenger.waitForTimeout(3000);
  await passenger.screenshot({ path: `${OUT_DIR}/passenger-finding-${viewport.name}.png` });
  results.push(`passenger-finding-${viewport.name}.png`);

  // Driver accepts
  const driverContext = await browser.newContext({ viewport });
  const driver = await driverContext.newPage();
  await signIn(driver, DEMO.driver);
  await driver.goto(`${BASE_URL}/driver/requests`, { waitUntil: 'domcontentloaded' });
  await driver.waitForTimeout(3000);
  await driver.screenshot({ path: `${OUT_DIR}/driver-requests-${viewport.name}.png` });
  results.push(`driver-requests-${viewport.name}.png`);

  const accept = driver.getByRole('button', { name: /^Accept$/i }).first();
  if (await accept.count()) {
    await accept.click();
    await driver.waitForTimeout(3000);
    await driver.screenshot({ path: `${OUT_DIR}/driver-tracking-${viewport.name}.png` });
    results.push(`driver-tracking-${viewport.name}.png`);

    // passenger tracks
    await passenger.waitForTimeout(4000);
    await passenger.screenshot({ path: `${OUT_DIR}/passenger-tracking-${viewport.name}.png` });
    results.push(`passenger-tracking-${viewport.name}.png`);
  }

  await passengerContext.close();
  await driverContext.close();
  return results;
}

async function capturePublic(browser, viewport) {
  const results = [];
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/onboarding`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/onboarding-${viewport.name}.png` });
  results.push(`onboarding-${viewport.name}.png`);

  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT_DIR}/sign-in-${viewport.name}.png` });
  results.push(`sign-in-${viewport.name}.png`);
  await context.close();
  return results;
}

async function auditViewport(browser, viewport) {
  const issues = [];
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  for (const path of ['/onboarding', '/sign-in']) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
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
    if (result.horizontalScroll) issues.push(`${path}: page scrolls horizontally at ${viewport.width}px`);
    if (result.overflowing.length) issues.push(`${path}: elements overflow right edge at ${viewport.width}px → ${result.overflowing.join(', ')}`);
  }
  await context.close();
  return issues;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const authenticated = await apiReachable();
  if (!authenticated) {
    console.warn('[capture-ui] API not reachable — capturing unauthenticated screens only.');
    console.warn('[capture-ui] Start Apache + MySQL in XAMPP to capture the full ride flow.');
  }

  const browser = await chromium.launch();
  const written = [];
  const layoutIssues = [];
  for (const viewport of VIEWPORTS) {
    written.push(...await capturePublic(browser, viewport));
    layoutIssues.push(...await auditViewport(browser, viewport));
    if (authenticated) written.push(...await captureAuthenticated(browser, viewport));
  }
  await browser.close();

  console.log(`[capture-ui] Wrote ${written.length} screenshot(s) to ${OUT_DIR}`);
  for (const file of written) console.log(`  - ${file}`);
  if (layoutIssues.length) {
    console.warn(`[capture-ui] ${layoutIssues.length} layout issue(s) found:`);
    for (const issue of layoutIssues) console.warn(`  - ${issue}`);
  } else {
    console.log('[capture-ui] No horizontal overflow detected at tested widths.');
  }
}

main().catch(error => {
  console.error('[capture-ui] Failed:', error);
  process.exit(1);
});
