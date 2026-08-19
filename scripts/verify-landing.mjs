import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://firewall-x.vercel.app';

async function main() {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  await page.goto(URL, { waitUntil: 'networkidle' });
  
  const heading = await page.$('h2:has-text("Target networks, verified live")');
  console.log('>>> CONFIRMATION (LIVE): Target networks section found?', !!heading);
  
  const mainnetBtn = await page.$('button:has-text("BOT Chain Mainnet (Live)")');
  const testnetBtn = await page.$('button:has-text("BOT Chain Testnet (On-Chain)")');
  console.log('>>> CONFIRMATION (LIVE): Mainnet selector found?', !!mainnetBtn);
  console.log('>>> CONFIRMATION (LIVE): Testnet selector found?', !!testnetBtn);

  // Scroll to section and take screenshot
  await heading?.scrollIntoViewIfNeeded();
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: 'docs/screenshots-live-vercel/03-landing-networks-verified.png' });
  console.log('>>> Screenshot captured: docs/screenshots-live-vercel/03-landing-networks-verified.png');

  await browser.close();
}

main().catch(console.error);
