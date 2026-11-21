/**
 * Real-browser check of the production Clinic Queue build (service worker,
 * offline, Urdu/RTL, 360px layout, touch targets, the waiting-room display
 * updating from another tab). It drives the Google Chrome that is already
 * installed, so nothing is downloaded.
 *
 *   npm run build --workspace=apps/clinic-queue
 *   npm run preview --workspace=apps/clinic-queue -- --port 4174 --strictPort      (in another terminal)
 *   npm run e2e:clinic
 *
 * Environment: E2E_URL (default http://localhost:4174), E2E_OUT (screenshots, default e2e-output/clinic),
 *              E2E_CHANNEL (chrome | msedge, default chrome)
 * Exit code is 1 if any problem was found.
 */
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const URL = process.env.E2E_URL ?? 'http://localhost:4174';
const OUT = process.env.E2E_OUT ?? 'e2e-output/clinic';
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
const watch = (p) => {
  p.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  p.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`console: ${m.text()}`);
  });
};
watch(page);

let lang = 'en';
const NAV_LABEL = { en: 'Main menu', ur: 'مین مینو' };
const TAB = {
  en: { queue: 'Queue', patients: 'Patients', summary: 'Summary', settings: 'Settings' },
  ur: { queue: 'قطار', patients: 'مریض', summary: 'خلاصہ', settings: 'سیٹنگز' },
};
const FAB = { en: 'Issue token', ur: 'ٹوکن دیں' };
const tab = (name) => page.getByRole('navigation', { name: NAV_LABEL[lang] }).getByRole('button', { name: TAB[lang][name] });
const fab = () => page.getByRole('button', { name: FAB[lang], exact: true }).last();
const shot = (name, p = page) => p.screenshot({ path: join(OUT, `${lang}-${name}.png`) });
const settle = (p = page) => p.waitForTimeout(350); // lets the fade-in animation finish

/** No horizontal overflow, and every control is at least 44px. */
async function audit(label, p = page) {
  const result = await p.evaluate(() => {
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

const keyLeak = async (label, p = page) => {
  const text = await p.evaluate(() => document.body.innerText);
  if (/clinic\.[a-zA-Z]+\.[a-zA-Z]+/.test(text)) problem(`${label}: untranslated key visible`);
};

/** The token shown as "now serving" on the display. */
const servingOnDisplay = (p) => p.locator('main [aria-live] [dir="ltr"]').first().innerText();

try {
  // ---------------------------------------------------------------- first visit
  step('1. First visit (online): the service worker installs and caches everything');
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.getByText('No patients yet today').waitFor();
  await shot('00-empty-queue');
  await audit('empty queue');

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
    [/favicon\.svg$/, 'the favicon'],
    [/pwa-192x192\.png$/, 'the 192px icon'],
    [/pwa-512x512\.png$/, 'the 512px icon'],
    [/pwa-maskable-512x512\.png$/, 'the maskable icon'],
    [/noto-nastaliq-urdu-arabic.*\.woff2$/, 'the Urdu font (Arabic script)'],
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
  await page.getByRole('button', { name: 'Load demo data' }).click();
  await shot('01-demo-dialog');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Yes, add sample data' }).click();
  await page.getByText('Sample data added').waitFor();
  await page.getByRole('button', { name: 'Load demo data' }).click();
  await page.getByText('Sample data is already loaded').waitFor();
  await tab('patients').click();
  await settle();
  const patientRows = await page.locator('main ul').first().locator('> li').count();
  if (patientRows !== 10) problem(`expected 10 demo patients, found ${patientRows}`);
  else ok('pressing "Load demo data" twice still gives exactly 10 patients');

  // ---------------------------------------------------------------- English screens
  step('3. Every screen in English at 360px');
  await tab('queue').click();
  await settle();
  await page.getByRole('heading', { name: 'Shifa Family Clinic' }).waitFor();
  await shot('02-queue');
  await audit('queue');
  const callNext = page.getByRole('button', { name: 'Complete & call next' });
  const callBox = await callNext.boundingBox();
  if (callBox.height < 56) problem(`"Call next" should be large (is ${Math.round(callBox.height)}px tall)`);
  else ok(`"Complete & call next" is ${Math.round(callBox.height)}px tall`);
  const fabBox = await fab().boundingBox();
  const navBox = await page.getByRole('navigation', { name: 'Main menu' }).boundingBox();
  if (fabBox.y + fabBox.height > navBox.y) problem('floating + overlaps the bottom navigation');
  else ok(`floating + clears the bottom navigation (${Math.round(navBox.y - fabBox.y - fabBox.height)}px gap)`);
  if (fabBox.x + fabBox.width / 2 < 180) problem('floating + should be on the right in English');

  await page.getByRole('heading', { name: 'Waiting list' }).locator('..').getByRole('listitem').first().click();
  await settle();
  await shot('03-token-waiting');
  await audit('token (waiting)');
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'Notes / complete' }).click();
  await settle();
  await shot('04-token-serving');
  await audit('token (serving)');
  await page.getByRole('button', { name: 'Back' }).click();

  await fab().click();
  await page.getByLabel('Search patient by name or phone').fill('ghulam');
  await page.getByText('Ghulam Rasool').click();
  await page.getByLabel('Reason for visit (optional)').fill('Blood pressure');
  await shot('05-issue-confirm');
  await page.getByRole('button', { name: 'Issue token', exact: true }).first().click();
  await page.getByText('Token issued').waitFor();
  await settle();
  await shot('06-issued');
  await audit('token issued');
  const hero = await page.getByText(/^A-\d+$/).first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  if (hero < 64) problem(`issued token number should be very large (font ${hero}px)`);
  else ok(`issued token number shown at ${hero}px`);
  await page.getByRole('button', { name: 'Done' }).click();

  await tab('patients').click();
  await settle();
  await shot('07-patients');
  await audit('patients');
  await page.getByText('Muhammad Asif').click();
  await settle();
  await shot('08-patient-detail');
  await audit('patient detail');
  if (!(await page.getByText('Viral fever', { exact: false }).count())) problem('patient history is missing the doctor notes');
  else ok('patient history shows past visits with doctor notes');

  await tab('summary').click();
  await settle();
  await shot('09-summary');
  await audit('summary');
  if (!(await page.getByRole('img', { name: 'Bar chart of patients arriving and seen per hour' }).count())) problem('summary chart missing');

  await tab('settings').click();
  await settle();
  await shot('10-settings');
  await audit('settings');
  await keyLeak('english screens');

  // ---------------------------------------------------------------- display
  step('4. Waiting-room display: big numbers, no names, follows the reception tab');
  await tab('queue').click();
  await settle();
  const [display] = await Promise.all([
    context.waitForEvent('page'),
    page.getByRole('button', { name: 'Waiting-room display' }).click(),
  ]);
  watch(display);
  await display.setViewportSize({ width: 360, height: 740 });
  await display.getByRole('button', { name: 'Exit display' }).waitFor();
  await settle(display);
  await shot('11-display', display);
  await audit('display', display);
  const before = await servingOnDisplay(display);
  const size = await display.locator('main [aria-live] [dir="ltr"]').first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  if (size < 80) problem(`display token should be huge (font ${size}px)`);
  else ok(`display shows ${before} at ${size}px`);
  const displayText = await display.evaluate(() => document.body.innerText);
  if (/Shazia Parveen|Abdul Rehman|Hina Tariq/.test(displayText)) problem('display shows patient names');
  else ok('display shows token numbers only, no patient names');
  const nextCount = await display.getByRole('heading', { name: 'Next' }).locator('..').getByRole('listitem').count();
  if (nextCount !== 3) problem(`display should show the next 3 tokens, shows ${nextCount}`);

  await page.getByRole('button', { name: 'Complete & call next' }).click();
  const updated = await display
    .waitForFunction((old) => {
      const el = document.querySelector('main [aria-live] [dir="ltr"]');
      return el && el.textContent !== old;
    }, before, { timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (!updated) problem('display did not update after "Call next" in the other tab');
  else ok(`display updated by itself: ${before} → ${await servingOnDisplay(display)}`);

  // ---------------------------------------------------------------- Urdu
  step('5. Urdu: right-to-left layout and the bundled Nastaliq font');
  await page.getByRole('button', { name: 'Switch language' }).click();
  await page.waitForFunction(() => document.documentElement.dir === 'rtl');
  lang = 'ur';
  await settle();
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family));
  if (!fonts.some((f) => f.includes('Noto Nastaliq Urdu'))) problem(`Urdu font not loaded (loaded: ${fonts.join(', ') || 'none'})`);
  else ok('Noto Nastaliq Urdu is loaded');

  await tab('queue').click();
  await settle();
  await shot('20-queue');
  await audit('urdu queue');
  const fabUr = await fab().boundingBox();
  if (fabUr.x + fabUr.width / 2 > 180) problem('floating + should be on the LEFT in Urdu');
  else ok('floating + moved to the left in Urdu');
  const navButtons = await page.getByRole('navigation', { name: 'مین مینو' }).getByRole('button').all();
  const xs = [];
  for (const b of navButtons) xs.push((await b.boundingBox()).x);
  if (!(xs[0] > xs[xs.length - 1])) problem('bottom navigation order did not mirror in Urdu');
  else ok('bottom navigation order mirrored');

  await fab().click();
  await settle();
  await shot('21-issue');
  await audit('urdu issue token');
  const backBox = await page.getByRole('button', { name: 'واپس' }).boundingBox();
  if (backBox.x < 180) problem('back button should be on the right in Urdu');
  else ok('back button on the right in Urdu');
  await page.getByRole('button', { name: 'واپس' }).click();

  for (const [name, file] of [
    ['patients', '22-patients'],
    ['summary', '23-summary'],
    ['settings', '24-settings'],
  ]) {
    await tab(name).click();
    await settle();
    await shot(file);
    await audit(`urdu ${name}`);
  }
  await page.getByRole('button', { name: 'سارا ڈیٹا مٹائیں' }).click();
  await settle();
  await shot('25-clear-dialog');
  await page.getByRole('alertdialog').getByRole('button', { name: 'منسوخ کریں' }).click();
  await keyLeak('urdu screens');

  await display.reload({ waitUntil: 'domcontentloaded' });
  await display.getByRole('button', { name: 'اسکرین بند کریں' }).waitFor();
  await settle(display);
  await shot('26-display', display);
  ok('display follows the Urdu language');
  await keyLeak('urdu display', display);

  // ---------------------------------------------------------------- offline
  step('6. Offline: no network at all after the first visit');
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: 'مین مینو' }).waitFor({ timeout: 15000 });
  ok('the app reloads and opens with the network off');
  const urduFontLoaded = await page
    .waitForFunction(
      () => [...document.fonts].some((f) => f.status === 'loaded' && f.family.includes('Noto Nastaliq Urdu')),
      undefined,
      { timeout: 8000 },
    )
    .then(() => true)
    .catch(() => false);
  if (!urduFontLoaded) problem('Urdu font is not available offline');
  else ok('the Urdu font loads from the cache offline');

  await page.getByRole('button', { name: 'زبان تبدیل کریں' }).click();
  await page.waitForFunction(() => document.documentElement.dir === 'ltr');
  lang = 'en';
  await settle();

  step('7. Offline actions: register + issue, call, complete with notes, skip, re-queue, CSV');
  await tab('queue').click();
  await fab().click();
  await page.getByRole('button', { name: 'New patient' }).first().click();
  await page.getByLabel('Name').fill('Offline Test Patient');
  await page.getByLabel('Phone (optional)').fill('0300-5551234');
  await page.getByLabel('Age (optional)').fill('33');
  await page.getByRole('button', { name: 'Save and issue token' }).click();
  await page.getByText('Token for Offline Test Patient').waitFor();
  const offlineLabel = await page.getByText(/^A-\d+$/).first().innerText();
  ok(`patient registered and token ${offlineLabel} issued offline`);
  const wa = await page.getByRole('link', { name: 'Notify on WhatsApp' }).getAttribute('href');
  if (!wa?.startsWith('https://wa.me/923005551234?text=')) problem(`WhatsApp link is wrong: ${wa}`);
  else ok('WhatsApp link uses 92300… and a pre-filled message');
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('heading', { name: 'Waiting list' }).locator('..').getByText('Offline Test Patient').click();
  await page.getByRole('button', { name: 'Call this patient' }).click();
  await page.getByText('Being seen').first().waitFor();
  await page.getByLabel("Doctor's notes (optional)").fill('Checked offline. All fine.');
  await page.getByRole('button', { name: 'Complete visit' }).click();
  await page.getByRole('heading', { name: 'Shifa Family Clinic' }).waitFor();
  ok('called and completed with notes offline');

  await page.getByRole('heading', { name: 'Now serving' }).locator('..').getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: 'Re-queue' }).first().waitFor();
  await page.getByRole('button', { name: 'Re-queue' }).first().click();
  ok('skip and re-queue work offline');
  await shot('30-offline-queue');

  await tab('settings').click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download data (CSV)' }).click(),
  ]);
  const csvBytes = readFileSync(await download.path());
  const csv = csvBytes.toString('utf8');
  if (csvBytes[0] !== 0xef || csvBytes[1] !== 0xbb || csvBytes[2] !== 0xbf) problem('CSV has no UTF-8 BOM');
  if (!csv.includes('Offline Test Patient') || !csv.includes('Checked offline. All fine.')) problem('CSV is missing the offline visit');
  else ok(`CSV downloaded offline (${download.suggestedFilename()}, ${csv.split('\n').length} lines, BOM present)`);

  step('8. Data survives a reload, and "Clear all data" really clears it (offline)');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await tab('patients').click();
  await page.getByText('Offline Test Patient').waitFor();
  ok('data is still there after reloading offline');
  await tab('settings').click();
  await page.getByRole('button', { name: 'Clear all data' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Yes, delete everything' }).click();
  await page.getByText('All data was deleted').waitFor();
  await tab('queue').click();
  await page.getByText('No patients yet today').waitFor();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('No patients yet today').waitFor();
  ok('after clearing, the empty queue returns and stays after a reload');
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
process.exit(problems.length === 0 ? 0 : 1);
