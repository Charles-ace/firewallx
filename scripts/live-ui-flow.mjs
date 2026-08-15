import { chromium } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';
const SHOTS = path.join(process.cwd(), 'docs/screenshots-live');
const RESULTS = path.join(process.cwd(), 'docs/live-ui-results.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTerminalLogs(page) {
  return page.$$eval('.font-mono', (els) => els.map((e) => e.textContent?.trim() ?? '').filter(Boolean));
}

async function extractTxHashes(logs) {
  const hashes = [];
  for (const line of logs) {
    const matches = line.match(/0x[0-9a-fA-F]{64}/g) || [];
    for (const m of matches) hashes.push(m);
  }
  return [...new Set(hashes)];
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const report = { url: URL, startedAt: new Date().toISOString(), steps: [] };
  const step = (key, data) => { report.steps.push({ key, ...data }); fs.writeFileSync(RESULTS, JSON.stringify(report, null, 2)); };

  console.log('Launching Edge (headless) via playwright-core...');
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  console.log('Navigating to', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(4000);
  await page.screenshot({ path: path.join(SHOTS, '01-home.png') });

  console.log('Opening Attack Sandbox...');
  await page.click('button:has-text("Attack Sandbox")');
  await sleep(2500);
  await page.screenshot({ path: path.join(SHOTS, '02-sandbox-ready.png') });

  const modeText = await page.evaluate(() => document.body.textContent?.includes('(Live On-Chain)') ?? false);
  console.log('On-chain mode active in UI:', modeText);
  step('mode', { onChainMode: modeText });

  // ---- STEP 1: LOOP BREACH VIA UI ----
  console.log('Triggering "2. Runaway Loop Attack" via UI click...');
  await page.click('button:has-text("2. Runaway Loop Attack")');
  await sleep(22000);
  let logs = await getTerminalLogs(page);
  let txHashes = await extractTxHashes(logs);
  console.log('Terminal log tail (loop attack):');
  console.log(logs.slice(-14).join('\n'));
  await page.screenshot({ path: path.join(SHOTS, '03-loop-attack-after.png') });
  step('loopAttack', {
    terminalTail: logs.slice(-14),
    txHashes,
    uiText: await page.evaluate(() => document.body.textContent),
  });

  // ---- STEP 2: RESET VIA UI ----
  console.log('Clicking "Reset Agent Breaker"...');
  await page.click('button:has-text("Reset Agent Breaker")');
  await sleep(12000);
  logs = await getTerminalLogs(page);
  console.log('Terminal tail (after reset):');
  console.log(logs.slice(-6).join('\n'));
  await page.screenshot({ path: path.join(SHOTS, '04-after-reset.png') });
  step('resetAfterLoop', { terminalTail: logs.slice(-6), txHashes: await extractTxHashes(logs) });

  // ---- STEP 3: VELOCITY BREACH VIA UI ----
  console.log('Triggering "6. Velocity Burst Flood" via UI click...');
  await page.click('button:has-text("6. Velocity Burst Flood")');
  await sleep(25000);
  logs = await getTerminalLogs(page);
  console.log('Terminal log tail (velocity burst):');
  console.log(logs.slice(-16).join('\n'));
  await page.screenshot({ path: path.join(SHOTS, '05-velocity-burst-after.png') });
  step('velocityBurst', {
    terminalTail: logs.slice(-16),
    txHashes: await extractTxHashes(logs),
    uiText: await page.evaluate(() => document.body.textContent),
  });

  // ---- STEP 4: RESET AGAIN ----
  console.log('Resetting breaker again via UI...');
  await page.click('button:has-text("Reset Agent Breaker")');
  await sleep(12000);
  logs = await getTerminalLogs(page);
  console.log('Terminal tail (final reset):');
  console.log(logs.slice(-6).join('\n'));
  await page.screenshot({ path: path.join(SHOTS, '06-final-reset.png') });
  step('finalReset', { terminalTail: logs.slice(-6), txHashes: await extractTxHashes(logs) });

  // ---- STEP 5: LIVE TELEMETRY / ON-CHAIN FEED ----
  console.log('Navigating to Live Telemetry...');
  await page.click('button:has-text("Live Telemetry")');
  await sleep(6000);
  const refreshBtn = page.locator('button:has-text("Refresh")').first();
  if (await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await refreshBtn.click();
    await sleep(5000);
  }
  const feedText = await page.evaluate(() => document.body.textContent ?? '');
  console.log('Feed contains GuardedExecution references:', feedText.includes('GuardedExecution'));
  console.log('Feed contains CircuitBreakerTripped references:', feedText.includes('CircuitBreakerTripped'));
  await page.screenshot({ path: path.join(SHOTS, '07-onchain-feed.png') });
  step('onChainFeed', {
    hasGuardedExecution: feedText.includes('GuardedExecution'),
    hasBreakerTripped: feedText.includes('CircuitBreakerTripped'),
    feedSnippet: feedText.slice(0, 2000),
  });

  step('pageErrors', { pageErrors });
  step('endedAt', { ts: new Date().toISOString() });
  console.log('DONE. Report saved to docs/live-ui-results.json');
  await browser.close();
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });