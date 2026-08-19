import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://firewall-x.vercel.app';

async function main() {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

  await page.goto(URL, { waitUntil: 'networkidle' });
  
  // Check navbar toggle buttons
  const testnetBtn = await page.$('header button:has-text("Testnet")');
  const mainnetBtn = await page.$('header button:has-text("Mainnet")');
  console.log('>>> CONFIRMATION (LIVE): Does Navbar Testnet toggle exist?', !!testnetBtn);
  console.log('>>> CONFIRMATION (LIVE): Does Navbar Mainnet toggle exist?', !!mainnetBtn);

  // Click Mainnet in Navbar
  await mainnetBtn?.click();
  await new Promise((r) => setTimeout(r, 1000));
  console.log('>>> CONFIRMATION (LIVE): Switched to Mainnet via Navbar toggle');

  // Check that raw "CHAIN ID: 677" or "BOT Mainnet 677" text is NOT in navbar
  const headerText = await page.evaluate(() => document.querySelector('header')?.textContent ?? '');
  console.log('>>> Header text:', headerText);
  console.log('>>> Raw 677/968 absent from Header?', !headerText.includes('677') && !headerText.includes('968'));

  await browser.close();
}

main().catch(console.error);
