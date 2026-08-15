import { chromium } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  console.log('🚀 Launching Microsoft Edge via Playwright...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  
  const browser = await chromium.launch({
    executablePath: edgePath,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  console.log('🌐 Navigating to http://localhost:3000 ...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  const screenshotDir = path.join(process.cwd(), 'docs/screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  // 1. Home / Landing Page
  console.log('📸 Capturing Home Page...');
  await page.screenshot({ path: path.join(screenshotDir, '01-landing-page.png') });

  // 2. Open Attack Sandbox Tab
  console.log('👉 Navigating to Attack Sandbox...');
  await page.click('button:has-text("Attack Sandbox")');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(screenshotDir, '02-attack-sandbox-ready.png') });

  // 3. Trigger Real On-Chain Runaway Loop Attack
  console.log('⚡ Triggering Runaway Loop Attack on BOT Chain Testnet...');
  await page.click('button:has-text("2. Runaway Loop Attack")');
  
  // Wait for 3 on-chain transactions to process and autonomous breaker to trip
  console.log('⏳ Waiting for 3 on-chain loop transactions and autonomous breaker trip (~25s)...');
  await page.waitForTimeout(25000);

  let logs = await page.$$eval('.font-mono', (elements) => elements.map(e => e.textContent));
  console.log('\n--- TERMINAL OUTPUT (LOOP ATTACK) ---');
  console.log(logs.slice(-15).join('\n'));
  console.log('-------------------------------------\n');

  await page.screenshot({ path: path.join(screenshotDir, '03-loop-attack-tripped.png') });

  // 4. Reset Agent Breaker On-Chain
  console.log('🔄 Clicking Reset Agent Breaker on-chain...');
  await page.click('button:has-text("Reset Agent Breaker")');
  await page.waitForTimeout(10000);

  logs = await page.$$eval('.font-mono', (elements) => elements.map(e => e.textContent));
  console.log('\n--- TERMINAL OUTPUT (AFTER RESET) ---');
  console.log(logs.slice(-8).join('\n'));
  console.log('-------------------------------------\n');

  await page.screenshot({ path: path.join(screenshotDir, '04-breaker-reset-active.png') });

  // 5. Trigger Real On-Chain Velocity Burst Flood
  console.log('⚡ Triggering Velocity Burst Flood on BOT Chain Testnet...');
  await page.click('button:has-text("6. Velocity Burst Flood")');
  console.log('⏳ Waiting for 4 on-chain velocity transactions and autonomous rate-limit breaker trip (~25s)...');
  await page.waitForTimeout(25000);

  logs = await page.$$eval('.font-mono', (elements) => elements.map(e => e.textContent));
  console.log('\n--- TERMINAL OUTPUT (VELOCITY BURST) ---');
  console.log(logs.slice(-15).join('\n'));
  console.log('----------------------------------------\n');

  await page.screenshot({ path: path.join(screenshotDir, '05-velocity-burst-tripped.png') });

  // 6. Reset Breaker again
  console.log('🔄 Resetting Breaker after velocity test...');
  await page.click('button:has-text("Reset Agent Breaker")');
  await page.waitForTimeout(8000);

  // 7. Check Live Telemetry & On-Chain Feed
  console.log('👉 Navigating to Live Telemetry & On-Chain Feed...');
  await page.click('button:has-text("Live Telemetry")');
  await page.waitForTimeout(4000);

  // Click Refresh on OnChainFeed
  const refreshBtn = page.locator('button:has-text("Refresh")').first();
  if (await refreshBtn.isVisible()) {
    await refreshBtn.click();
    await page.waitForTimeout(3000);
  }

  await page.screenshot({ path: path.join(screenshotDir, '06-onchain-feed-live.png') });

  // 8. Test Wallet Connection Modal Flow
  console.log('👛 Testing Wallet Modal Flow...');
  await page.click('button:has-text("Connect")');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(screenshotDir, '07-wallet-modal-open.png') });

  // Click Demo Sentinel Wallet
  await page.click('button:has-text("Demo Sentinel Wallet")');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(screenshotDir, '08-wallet-connected-demo.png') });

  console.log('🎉 All UI flows successfully executed and screenshotted!');
  await browser.close();
}

main().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
