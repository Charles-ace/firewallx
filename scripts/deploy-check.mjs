import puppeteer from 'puppeteer-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = process.argv[2] ?? 'https://firewallx-agent-firewall-g2xtcgx7n.vercel.app';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox'],
  defaultViewport: { width: 1500, height: 900 },
});

try {
  const page = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('requestfailed', (r) => failedRequests.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText}`));

  const resp = await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
  console.log('HTTP_STATUS', resp.status());
  console.log('FINAL_URL', page.url());
  await sleep(1500);

  const hero = await page.evaluate(() => document.title);
  console.log('TITLE', hero);

  const tabClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const b = buttons.find((el) => el.textContent?.trim().toLowerCase().includes('live telemetry'));
    if (b) { b.click(); return true; }
    return false;
  });
  console.log('TAB_CLICKED', tabClicked);
  await sleep(22000);

  const feed = await page.evaluate(() => {
    const panel = Array.from(document.querySelectorAll('div')).find((d) =>
      d.textContent?.includes('On-Chain Sentinel Events')
    );
    if (!panel) return { present: false };
    const header = panel.querySelector('div:first-child')?.textContent?.replace(/\s+/g, ' ') ?? '';
    const rows = Array.from(panel.querySelectorAll('a[href*="/tx/"]')).length;
    return { present: true, header: header.slice(0, 160), txLinks: rows };
  });
  console.log('FEED', JSON.stringify(feed));

  await page.screenshot({ path: 'shot-deployed-demo.png', fullPage: false });
  console.log('SCREENSHOT shot-deployed-demo.png');

  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
  console.log('PAGE_ERRORS', JSON.stringify(pageErrors));
  console.log('FAILED_REQUESTS', JSON.stringify(failedRequests));
} finally {
  await browser.close();
}