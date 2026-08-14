import puppeteer from 'puppeteer-core';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
});

const page = await browser.newPage();
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});
page.on('pageerror', (e) => consoleErrors.push(String(e)));

await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
await sleep(3000);

await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'));
  const b = buttons.find((el) => el.textContent?.trim().toLowerCase().includes('live telemetry'));
  b?.click();
});
await sleep(25000);

const feed = await page.evaluate(() => {
  const panel = Array.from(document.querySelectorAll('div')).find((d) =>
    d.textContent?.includes('On-Chain Sentinel Events')
  );
  if (!panel) return null;
  const text = (panel.textContent ?? '').replace(/\s+/g, ' ');
  const live = text.includes('LIVE');
  const blockMatch = text.match(/block #(\d+)/);
  const noEvents = text.includes('No on-chain events indexed yet');
  const txLinks = Array.from(panel.querySelectorAll('a[href*="/tx/"]')).length;
  return { live, block: blockMatch?.[1] ?? null, noEvents, txLinks, sample: text.slice(text.indexOf('On-Chain Sentinel Events'), text.indexOf('On-Chain Sentinel Events') + 900) };
});
console.log('FEED_DETAIL', JSON.stringify(feed));
console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
await browser.close();