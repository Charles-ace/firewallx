import puppeteer from 'puppeteer-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:3000/';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: EDGE,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1500,900'],
  defaultViewport: { width: 1500, height: 900 },
});

try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGE_ERROR', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('CONSOLE_ERROR', m.text().slice(0, 200));
  });

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);

  const tabClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const b = buttons.find((el) => el.textContent?.trim().toLowerCase().includes('live telemetry'));
    if (b) {
      b.click();
      return true;
    }
    return false;
  });
  console.log('TAB_CLICKED', tabClicked);

  await sleep(25000);

  const feed = await page.evaluate(() => {
    const panel = Array.from(document.querySelectorAll('div')).find((d) =>
      d.textContent?.includes('On-Chain Sentinel Events')
    );
    if (!panel) return null;
    const text = panel.textContent ?? '';
    const links = Array.from(panel.querySelectorAll('a')).map((a) => ({
      text: a.textContent?.trim() ?? '',
      href: a.getAttribute('href') ?? '',
    }));
    const rows = Array.from(panel.querySelectorAll('li, tr, [class*="event"], [class*="row"], [class*="item"]')).map((el) =>
      (el.textContent ?? '').replace(/\s+/g, ' ').trim()
    );
    return { text: text.replace(/\s+/g, ' ').slice(0, 6000), links, rows };
  });

  console.log('FEED_JSON', JSON.stringify(feed, null, 1));

  const el = await page.evaluate(() => {
    const panel = Array.from(document.querySelectorAll('div')).find((d) =>
      d.textContent?.includes('On-Chain Sentinel Events')
    );
    if (!panel) return null;
    const panelEl = panel.closest('[class*="rounded"]') ?? panel.parentElement ?? panel;
    const rect = panelEl.getBoundingClientRect();
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  });

  if (el && el.h > 20) {
    await page.screenshot({ path: 'shot-onchain-feed.png', clip: { x: Math.max(0, el.x - 8), y: Math.max(0, el.y - 8), width: Math.min(el.w + 16, 1500), height: Math.min(el.h + 16, 1400) } });
    console.log('SCREENSHOT', 'shot-onchain-feed.png');
  } else {
    await page.screenshot({ path: 'shot-onchain-feed.png', fullPage: true });
    console.log('SCREENSHOT fullPage');
  }
} finally {
  await browser.close();
}
