import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function main() {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage();
  await page.goto('https://zw-arm.vercel.app/', { waitUntil: 'networkidle', timeout: 30000 });
  
  const title = await page.title();
  console.log('PAGE TITLE:', title);

  const scripts = await page.$$eval('script[src]', els => els.map(s => s.src));
  console.log('SCRIPTS:', scripts);

  const canvasList = await page.$$eval('canvas', els => els.map(c => ({
    width: c.width,
    height: c.height,
    className: c.className,
    id: c.id
  })));
  console.log('CANVASES:', canvasList);

  const bgInfo = await page.evaluate(() => {
    const mainEl = document.querySelector('main') || document.body;
    return {
      bodyBg: window.getComputedStyle(document.body).background,
      mainHtml: document.body.innerHTML.slice(0, 1500)
    };
  });
  console.log('MAIN HTML:', bgInfo.mainHtml.slice(0, 500));

  await browser.close();
}

main().catch(console.error);
