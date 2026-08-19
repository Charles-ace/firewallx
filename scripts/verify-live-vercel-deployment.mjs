import { chromium } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const LIVE_URL = 'https://firewall-x.vercel.app';
const SHOTS = path.join(process.cwd(), 'docs/screenshots-live-vercel');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  console.log('================================================================');
  console.log('VERIFYING LIVE VERCEL PRODUCTION SITE:', LIVE_URL);
  console.log('================================================================');

  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  console.log('\n[1] Loading live site fresh...');
  await page.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 45000 });
  await sleep(3000);

  // Navigate to Attack Sandbox
  console.log('\n[2] Navigating to Attack Sandbox on Live Site...');
  await page.click('button:has-text("Attack Sandbox")');
  await sleep(2000);

  // Check default mode
  const defaultModeButton = await page.$('button:has-text("BOT Chain Testnet (On-Chain)")');
  const isDefaultSelected = await defaultModeButton?.evaluate((el) => el.classList.contains('bg-blue-600'));
  console.log('>>> CONFIRMATION (LIVE): Is BOT Chain Testnet (On-Chain) the DEFAULT mode on page load?', isDefaultSelected);
  await page.screenshot({ path: path.join(SHOTS, '01-live-default-testnet.png') });

  // Check that Mainnet button exists
  const mainnetButton = await page.$('button:has-text("BOT Chain Mainnet (Live)")');
  console.log('>>> CONFIRMATION (LIVE): Does "BOT Chain Mainnet (Live)" toggle button exist?', !!mainnetButton);

  // Switch to Mainnet Mode
  console.log('\n[3] Clicking "BOT Chain Mainnet (Live)" on Live Site...');
  await page.click('button:has-text("BOT Chain Mainnet (Live)")');
  await sleep(1500);

  const isWarningVisible = await page.evaluate(() => document.body.textContent?.includes('BOT Chain Mainnet (Live) Mode Active') ?? false);
  console.log('>>> CONFIRMATION (LIVE): Is Mainnet Warning Banner Visible on Live Site?', isWarningVisible);

  // Check Preset 4 description
  const preset4Text = await page.evaluate(() => {
    const el = document.body.textContent;
    return el?.includes('Intercepted off-chain by SDK: BLOCK') ?? false;
  });
  console.log('>>> CONFIRMATION (LIVE): Is Preset 4 off-chain copy present on Live Site?', preset4Text);

  await page.screenshot({ path: path.join(SHOTS, '02-live-mainnet-active.png') });

  await browser.close();

  console.log('\n================================================================');
  console.log('LIVE VERCEL VERIFICATION COMPLETE');
  console.log('================================================================');
}

main().catch(console.error);
