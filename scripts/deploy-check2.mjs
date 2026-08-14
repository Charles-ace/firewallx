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
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
  });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(1000);

  const corsProbe = await page.evaluate(async () => {
    try {
      const r = await fetch('https://rpc.bohr.life', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
      });
      return { ok: r.ok, status: r.status, body: (await r.text()).slice(0, 200) };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
  console.log('CORS_PROBE', JSON.stringify(corsProbe));

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const b = buttons.find((el) => el.textContent?.trim().toLowerCase().includes('live telemetry'));
    b?.click();
  });
  await sleep(30000);

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
    const rows = Array.from(panel.querySelectorAll('a[href*="/tx/"]')).map((a) => a.getAttribute('href'));
    return { live, block: blockMatch?.[1] ?? null, noEvents, txLinks, sample: text.slice(text.indexOf('On-Chain Sentinel Events'), text.indexOf('On-Chain Sentinel Events') + 700) };
  });
  console.log('FEED_DETAIL', JSON.stringify(feed));
  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
} finally {
  await browser.close();
}