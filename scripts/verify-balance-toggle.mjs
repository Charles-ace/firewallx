import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'https://firewall-x.vercel.app';

async function main() {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  
  // Connect Demo Wallet
  const connectBtn = await page.$('button:has-text("Connect Wallet")');
  await connectBtn?.click();
  await page.waitForSelector('text=Connect to FirewallX');
  
  // Click Demo Sentinel Wallet
  const demoWalletBtn = await page.$('button:has-text("Demo Sentinel Wallet")');
  await demoWalletBtn?.click();
  await new Promise(r => setTimeout(r, 1200));

  let headerText = await page.evaluate(() => document.querySelector('header')?.textContent || '');
  console.log('>>> TESTNET CONNECTED HEADER:', headerText);

  // Switch to Mainnet via Navbar Toggle
  const mainnetToggle = await page.$('header button:has-text("Mainnet")');
  await mainnetToggle?.click();
  await new Promise(r => setTimeout(r, 2000));

  headerText = await page.evaluate(() => document.querySelector('header')?.textContent || '');
  console.log('>>> MAINNET TOGGLED HEADER:', headerText);

  await browser.close();
}

main().catch(console.error);
