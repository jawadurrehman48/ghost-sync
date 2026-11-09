/**
 * Real-browser check of the production Khata build (service worker, offline,
 * Urdu/RTL, 360px layout, touch targets). It drives the Google Chrome that is
 * already installed, so nothing is downloaded.
 *
 *   npm run build --workspace=apps/khata
 *   npm run preview --workspace=apps/khata -- --port 4173 --strictPort      (in another terminal)
 *   npm run e2e
 *
 * Environment: E2E_URL (default http://localhost:4173), E2E_OUT (screenshots, default e2e-output),
 *              E2E_CHANNEL (chrome | msedge, default chrome)
 * Exit code is 1 if any problem was found.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const URL = process.env.E2E_URL ?? 'http://localhost:4173';
const OUT = process.env.E2E_OUT ?? 'e2e-output';
const CHANNEL = process.env.E2E_CHANNEL ?? 'chrome';
mkdirSync(OUT, { recursive: true });

const problems = [];
const problem = (message) => {
  problems.push(message);
  console.log(`  \u2717 PROBLEM: ${message}`);
};
const ok = (message) => console.log(`  \u2713 ${message}`);
const step = (title) => console.log(`\n${title}`);

const browser = await chromium.launch({ channel: CHANNEL, headless: true });
const context = await browser.newContext({
  viewport: { width: 360, height: 740 },
  deviceScaleFactor: 2,
  locale: 'en-US',
  acceptDownloads: true,
});
const page = await context.newPage();
const consoleErrors = [];
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(`console: ${m.text()}`);
});

let lang = 'en';
const NAV_LABEL = { en: 'Main menu', ur: 'مین مینو' };
const TAB = {
  en: { home: 'Home', customers: 'Customers', reports: 'Reports', settings: 'Settings' },
  ur: { home: 'ہوم', customers: 'گاہک', reports: 'رپورٹس', settings: 'سیٹنگز' },
};
const tab = (name) => page.getByRole('navigation', { name: NAV_LABEL[lang] }).getByRole('button', { name: TAB[lang][name] });
const shot = (name) => page.screenshot({ path: join(OUT, `${lang}-${name}.png`) });
const settle = () => page.waitForTimeout(350); // lets the fade-in animation finish

/** No horizontal overflow, and every control is at least 44px. */
async function audit(label) {
  const result = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const wide = [];
    const small = [];
    const describe = (el) =>
      `${el.tagName.toLowerCase()}${el.getAttribute('aria-label') ? `[${el.getAttribute('aria-label')}]` : ''} "${(el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 30)}"`;
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue;
      if (el.closest('.sr-only') || el.classList.contains('sr-only')) continue;
      if (r.right > vw + 1 || r.left < -1) wide.push(`${describe(el)} spans ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`);
      const interactive = el.matches('button, a[href], input:not([type=hidden]):not([type=radio]), select, textarea');
      if (interactive && (r.height < 43.5 || r.width < 43.5)) small.push(`${describe(el)} is ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return { vw, scrollWidth: document.documentElement.scrollWidth, wide, small };
  });
  if (result.scrollWidth > result.vw) problem(`${label}: page scrolls sideways (${result.scrollWidth} > ${result.vw})`);
  for (const w of result.wide.slice(0, 5)) problem(`${label}: overflow: ${w}`);
  for (const s of result.small.slice(0, 5)) problem(`${label}: touch target too small: ${s}`);
  if (!result.wide.length && !result.small.length && result.scrollWidth <= result.vw) ok(`${label}: fits 360px, all controls >= 44px`);
}

const keyLeak = async (label) => {
  const text = await page.evaluate(() => document.body.innerText);
  if (/khata\.[a-z]+\.[a-zA-Z]+/.test(text)) problem(`${label}: untranslated key visible`);
};

try {
  // ---------------------------------------------------------------- first visit
  step('1. First visit (online): the service worker installs and caches everything');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByText('Welcome to Khata').waitFor();
  await shot('00-welcome');
  await audit('welcome');

  await page.evaluate(() => navigator.serviceWorker.ready);
  const cachedUrls = () =>
    page.evaluate(async () => {
      const urls = [];
      for (const name of await caches.keys()) {
        for (const request of await (await caches.open(name)).keys()) urls.push(new URL(request.url).pathname);
      }
      return urls;
    });
  const REQUIRED = [
    [/index\.html$/, 'the app page'],
    [/manifest\.webmanifest$/, 'the manifest'],
    [/assets\/index-.*\.js$/, 'the app code'],
    [/assets\/index-.*\.css$/, 'the styles'],
    [/pwa-192x192\.png$/, 'the 192px icon'],
    [/pwa-512x512\.png$/, 'the 512px icon'],
    [/pwa-maskable-512x512\.png$/, 'the maskable icon'],
    [/noto-nastaliq-urdu-arabic.*\.woff2$/, 'the Urdu font (Arabic script)'],
    [/noto-nastaliq-urdu-latin-wght.*\.woff2$/, 'the Urdu font (Latin letters and digits)'],
  ];
  let urls = [];
  let missing = REQUIRED;
  for (let i = 0; i < 40 && missing.length > 0; i++) {
    urls = await cachedUrls();
    missing = REQUIRED.filter(([pattern]) => !urls.some((u) => pattern.test(u)));
    if (missing.length > 0) await page.waitForTimeout(500);
  }
  if (missing.length > 0) missing.forEach(([, what]) => problem(`not precached: ${what}`));
  else ok(`service worker active, ${urls.length} files precached, including the icons and the Urdu font`);

  const manifest = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  for (const key of ['name', 'short_name', 'theme_color', 'background_color', 'start_url', 'display']) {
    if (!manifest[key]) problem(`manifest is missing ${key}`);
  }
  for (const icon of manifest.icons) {
    const res = await page.evaluate(async (src) => (await fetch(src)).status, '/' + icon.src);
    if (res !== 200) problem(`manifest icon ${icon.src} returned ${res}`);
  }
  ok(`manifest "${manifest.name}", theme ${manifest.theme_color}, ${manifest.icons.length} icons all load`);

  // ---------------------------------------------------------------- demo data
  step('2. Demo data (loads once)');
  await tab('settings').click();
  await page.getByText('Danger zone').waitFor();
  await page.getByRole('button', { name: 'Load Demo Data' }).click();
  await shot('01-demo-dialog');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Yes, add sample data' }).click();
  await page.getByText('Sample data added').waitFor();
  await page.getByRole('button', { name: 'Load Demo Data' }).click();
  await page.getByText('Sample data is already loaded').waitFor();
  await tab('customers').click();
  await settle();
  // The first list in the page is the customer list (the bottom navigation list comes after it).
  const customerRows = await page.locator('main ul').first().locator('> li').count();
  if (customerRows !== 8) problem(`expected 8 demo customers, found ${customerRows}`);
  else ok('pressing "Load Demo Data" twice still gives exactly 8 customers');

  // ---------------------------------------------------------------- English screens
  step('3. Every screen in English at 360px');
  await tab('home').click();
  await settle();
  await page.getByText('Rs 15,720').waitFor();
  await shot('02-dashboard');
  await audit('dashboard');
  const fab = page.getByRole('button', { name: 'Quick entry' });
  const fabBox = await fab.boundingBox();
  const navBox = await page.getByRole('navigation', { name: 'Main menu' }).boundingBox();
  if (fabBox.y + fabBox.height > navBox.y) problem('floating + overlaps the bottom navigation');
  else ok(`floating + clears the bottom navigation (${Math.round(navBox.y - fabBox.y - fabBox.height)}px gap)`);
  if (fabBox.x + fabBox.width / 2 < 180) problem('floating + should be on the right in English');

  await tab('customers').click();
  await settle();
  await shot('03-customers');
  await audit('customers');

  await page.getByText('Imran Hussain').click();
  await settle();
  await shot('04-customer-detail');
  await audit('customer detail');

  await page.getByRole('button', { name: 'Credit Given' }).first().click();
  await settle();
  await shot('05-add-entry');
  await audit('add entry');
  await page.getByRole('button', { name: 'Back' }).click();

  await tab('reports').click();
  await settle();
  await shot('06-reports');
  await audit('reports');
  await page.getByRole('button', { name: 'Today' }).click();
  await settle();
  await shot('07-reports-today');

  await tab('settings').click();
  await settle();
  await shot('08-settings');
  await audit('settings');
  await keyLeak('english screens');

  // ---------------------------------------------------------------- Urdu
  step('4. Urdu: right-to-left layout and the bundled Nastaliq font');
  await page.getByRole('button', { name: 'Switch language' }).click();
  await page.waitForFunction(() => document.documentElement.dir === 'rtl');
  lang = 'ur';
  await settle();
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
  if (!fonts.some((f) => f.includes('Noto Nastaliq Urdu'))) problem(`Urdu font not loaded (loaded: ${fonts.join(', ') || 'none'})`);
  else ok('Noto Nastaliq Urdu is loaded');
  const urduFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  if (!urduFont.includes('Noto Nastaliq Urdu')) problem(`body font in Urdu is ${urduFont}`);

  await tab('home').click();
  await settle();
  await shot('10-dashboard');
  await audit('urdu dashboard');
  const fabUr = await page.getByRole('button', { name: 'فوری اندراج' }).boundingBox();
  if (fabUr.x + fabUr.width / 2 > 180) problem('floating + should be on the LEFT in Urdu');
  else ok('floating + moved to the left in Urdu');
  const navButtons = await page.getByRole('navigation', { name: 'مین مینو' }).getByRole('button').all();
  const xs = [];
  for (const b of navButtons) xs.push((await b.boundingBox()).x);
  if (!(xs[0] > xs[xs.length - 1])) problem('bottom navigation order did not mirror in Urdu');
  else ok('bottom navigation order mirrored');

  await tab('customers').click();
  await settle();
  await shot('11-customers');
  await audit('urdu customers');
  await page.getByText('Imran Hussain').click();
  await settle();
  await shot('12-customer-detail');
  await audit('urdu customer detail');
  const backBox = await page.getByRole('button', { name: 'واپس' }).boundingBox();
  if (backBox.x < 180) problem('back button should be on the right in Urdu');
  else ok('back button on the right in Urdu');
  await page.getByRole('button', { name: 'ادھار دیں' }).first().click();
  await settle();
  await shot('13-add-entry');
  await audit('urdu add entry');
  await page.getByRole('button', { name: 'واپس' }).click();
  await tab('reports').click();
  await settle();
  await shot('14-reports');
  await audit('urdu reports');
  await tab('settings').click();
  await settle();
  await shot('15-settings');
  await audit('urdu settings');
  await page.getByRole('button', { name: 'سارا ڈیٹا مٹائیں' }).click();
  await settle();
  await shot('16-clear-dialog');
  await page.getByRole('alertdialog').getByRole('button', { name: 'منسوخ کریں' }).click();
  await keyLeak('urdu screens');

  // ---------------------------------------------------------------- offline
  step('5. Offline: no network at all after the first visit');
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: 'مین مینو' }).waitFor({ timeout: 15000 });
  ok('the app reloads and opens with the network off');
  // Fonts load lazily once text needs them, so wait for that rather than reading the state at once.
  const urduFontLoaded = await page
    .waitForFunction(
      () => [...document.fonts].some((f) => f.status === 'loaded' && f.family.includes('Noto Nastaliq Urdu')),
      undefined,
      { timeout: 8000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!urduFontLoaded) {
    const states = await page.evaluate(() => [...document.fonts].map((f) => `${f.family}:${f.status}`));
    problem(`Urdu font is not available offline (${states.join(', ')})`);
  } else ok('the Urdu font loads from the cache offline');
  await tab('home').click();
  await page.getByText('Rs 15,720').waitFor();
  await shot('20-offline-dashboard');
  const badge = await page.locator('header button').first().innerText();
  ok(`sync badge while offline: "${badge.replace(/\s+/g, ' ')}"`);

  // back to English for the offline actions
  await page.getByRole('button', { name: 'زبان تبدیل کریں' }).click();
  await page.waitForFunction(() => document.documentElement.dir === 'ltr');
  lang = 'en';
  await settle();

  step('6. Offline actions: add customer, credit, payment, quick entry, reversal, CSV');
  await tab('customers').click();
  await page.getByRole('button', { name: 'Add Customer' }).first().click();
  await page.getByLabel('Name').fill('Offline Test Customer');
  await page.getByLabel('Phone (optional)').fill('0300-5551234');
  await page.getByRole('button', { name: 'Save Customer' }).click();
  await page.getByText('Offline Test Customer').waitFor();
  ok('customer added offline');

  await page.getByText('Offline Test Customer').click();
  await page.getByRole('button', { name: 'Credit Given' }).first().click();
  await page.getByLabel('Amount (Rs)').fill('1250');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('Rs 1,250').first().waitFor();
  await page.getByRole('button', { name: 'Payment Received' }).first().click();
  await page.getByLabel('Amount (Rs)').fill('250');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('Rs 1,000').first().waitFor();
  ok('credit Rs 1,250 and payment Rs 250 recorded offline: balance Rs 1,000');
  await shot('21-offline-detail');

  await page.getByRole('button', { name: 'Correct Mistake' }).first().click();
  await page.getByLabel('Reason for reversal (required)').fill('Test reversal');
  await page.getByRole('button', { name: 'Confirm Reversal' }).click();
  await page.getByText('Reversed', { exact: true }).waitFor();
  ok('entry reversed offline and kept visible as Reversed');

  await tab('home').click();
  await page.getByRole('button', { name: 'Quick entry' }).click();
  await page.getByLabel('Search customer by name or phone').fill('Aslam');
  await page.getByText('Muhammad Aslam').click();
  await page.getByLabel('Amount (Rs)').fill('125');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByRole('heading', { level: 2, name: 'Muhammad Aslam' }).waitFor();
  ok('quick entry (+) works offline');

  await tab('settings').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download Data (CSV)' }).click(),
  ]);
  const csvBytes = readFileSync(await download.path());
  const csv = csvBytes.toString('utf8');
  if (csvBytes[0] !== 0xef || csvBytes[1] !== 0xbb || csvBytes[2] !== 0xbf) problem('CSV has no UTF-8 BOM');
  if (!csv.includes('Offline Test Customer') || !csv.includes('Muhammad Aslam')) problem('CSV is missing customers');
  else ok(`CSV downloaded offline (${download.suggestedFilename()}, ${csv.split('\n').length} lines, BOM present)`);

  step('7. Data survives a reload, and "Clear all data" really clears it (offline)');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await tab('customers').click();
  await page.getByText('Offline Test Customer').waitFor();
  ok('data is still there after reloading offline');
  await tab('settings').click();
  await page.getByRole('button', { name: 'Clear all data' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Yes, delete everything' }).click();
  await page.getByText('All data was deleted').waitFor();
  await tab('home').click();
  await page.getByText('Welcome to Khata').waitFor();
  ok('after clearing, the welcome screen returns');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('Welcome to Khata').waitFor();
  ok('and it stays cleared after a reload');
} catch (error) {
  problem(`script stopped early: ${error.message.split('\n')[0]}`);
  await page.screenshot({ path: join(OUT, 'failure.png') }).catch(() => undefined);
}

step('Console / page errors');
const relevant = consoleErrors.filter((e) => !/Failed to load resource|net::ERR_INTERNET_DISCONNECTED/.test(e));
if (relevant.length) relevant.slice(0, 8).forEach((e) => problem(e));
else ok('no unexpected console or page errors');

await browser.close();
console.log(`\n${problems.length === 0 ? 'ALL CHECKS PASSED' : `${problems.length} PROBLEM(S) FOUND`}  (screenshots in ${OUT}/)`);
process.exit(problems.length === 0 ? 1 - 1 : 1);
