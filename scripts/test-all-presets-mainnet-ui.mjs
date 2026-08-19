import { chromium } from 'playwright-core';
import { JsonRpcProvider, formatEther } from 'ethers';
import * as path from 'path';
import * as fs from 'fs';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:3000';
const SHOTS = path.join(process.cwd(), 'docs/screenshots-mainnet-ui');
const RESULTS = path.join(process.cwd(), 'docs/mainnet-ui-proof-results.json');
const MAINNET_RPC = 'https://rpc.botchain.ai';
const provider = new JsonRpcProvider(MAINNET_RPC);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTerminalLogs(page) {
  return page.$$eval('.font-mono', (els) => els.map((e) => e.textContent?.trim() ?? '').filter(Boolean));
}

async function extractTxHashes(logs) {
  const hashes = [];
  for (const line of logs) {
    const matches = line.match(/0x[0-9a-fA-F]{64}/g) || [];
    for (const m of matches) {
      if (m !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        hashes.push(m);
      }
    }
  }
  return [...new Set(hashes)];
}

async function getTxDetails(txHash) {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return { txHash, status: 'PENDING' };
    const gasUsed = receipt.gasUsed;
    const effectiveGasPrice = receipt.gasPrice ?? receipt.effectiveGasPrice ?? 20000000000n;
    const cost = gasUsed * effectiveGasPrice;
    return {
      txHash,
      blockNumber: receipt.blockNumber,
      status: receipt.status === 1 ? 'SUCCESS (1)' : 'REVERTED (0)',
      gasUsed: gasUsed.toString(),
      costBot: formatEther(cost),
    };
  } catch (err) {
    return { txHash, error: err.message };
  }
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  console.log('================================================================');
  console.log('STARTING VERIFICATION PASS ON MAINNET VIA LIVE UI CLICK-THROUGH');
  console.log('================================================================');

  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  console.log('\n[1] Navigating to:', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  // Check default mode
  console.log('\n[2] Navigating to Attack Sandbox...');
  await page.click('button:has-text("Attack Sandbox")');
  await sleep(2000);

  const defaultModeButton = await page.$('button:has-text("BOT Chain Testnet (On-Chain)")');
  const isDefaultSelected = await defaultModeButton?.evaluate((el) => el.classList.contains('bg-blue-600'));
  console.log('>>> CONFIRMATION: Is BOT Chain Testnet (On-Chain) the DEFAULT mode on page load?', isDefaultSelected);
  await page.screenshot({ path: path.join(SHOTS, '01-default-testnet-mode.png') });

  // Switch to Mainnet Mode
  console.log('\n[3] Switching to "BOT Chain Mainnet (Live)" mode...');
  await page.click('button:has-text("BOT Chain Mainnet (Live)")');
  await sleep(1500);

  const warningVisible = await page.evaluate(() => document.body.textContent?.includes('BOT Chain Mainnet (Live) Mode Active') ?? false);
  console.log('>>> CONFIRMATION: Is Mainnet Warning Banner Visible?', warningVisible);
  await page.screenshot({ path: path.join(SHOTS, '02-mainnet-warning-banner.png') });

  const allCapturedTxs = [];
  const presetResults = [];

  // Helper to record new TXs
  const recordNewTxs = async (stepName) => {
    const logs = await getTerminalLogs(page);
    const txs = await extractTxHashes(logs);
    const fresh = txs.filter((h) => !allCapturedTxs.includes(h));
    fresh.forEach((h) => allCapturedTxs.push(h));
    console.log(`[${stepName}] Captured TXs (${fresh.length}):`, fresh);
    presetResults.push({ preset: stepName, txs: fresh });
    return fresh;
  };

  // PRESET 1: Normal Payment
  console.log('\n--- EXECUTING PRESET 1: Normal Payment ---');
  await page.click('button:has-text("1. Normal Payment")');
  await sleep(14000);
  await recordNewTxs('1. Normal Payment');
  await page.screenshot({ path: path.join(SHOTS, '03-preset-1-normal.png') });

  // PRESET 2: Runaway Loop Attack
  console.log('\n--- EXECUTING PRESET 2: Runaway Loop Attack ---');
  await page.click('button:has-text("2. Runaway Loop Attack")');
  await sleep(25000);
  await recordNewTxs('2. Runaway Loop Attack');
  await page.screenshot({ path: path.join(SHOTS, '04-preset-2-loop.png') });

  // RESET BREAKER
  console.log('\n--- RESETTING BREAKER AFTER PRESET 2 ---');
  await page.click('button:has-text("Reset Agent Breaker")');
  await sleep(10000);
  await recordNewTxs('Reset Breaker (Post-Loop)');

  // PRESET 3: Spend Cap Breach
  console.log('\n--- EXECUTING PRESET 3: Spend Cap Breach ---');
  await page.click('button:has-text("3. Spend Cap Breach")');
  await sleep(14000);
  await recordNewTxs('3. Spend Cap Breach');
  await page.screenshot({ path: path.join(SHOTS, '05-preset-3-spend.png') });

  // PRESET 4: High-Entropy Exploit (Off-Chain Sentinel SDK Intercept)
  console.log('\n--- EXECUTING PRESET 4: High-Entropy Exploit ---');
  await page.click('button:has-text("4. High-Entropy Exploit")');
  await sleep(3000);
  const p4Logs = await getTerminalLogs(page);
  const p4QuarantineFound = p4Logs.some((l) => l.includes('QUARANTINED BY SENTINEL SDK') || l.includes('High Shannon entropy'));
  console.log('>>> CONFIRMATION: Did Sentinel SDK intercept and quarantine off-chain?', p4QuarantineFound);
  await recordNewTxs('4. High-Entropy Exploit');
  await page.screenshot({ path: path.join(SHOTS, '06-preset-4-entropy.png') });

  // PRESET 5: Drainer Phishing Call
  console.log('\n--- EXECUTING PRESET 5: Drainer Phishing Call ---');
  await page.click('button:has-text("5. Drainer Phishing Call")');
  await sleep(14000);
  await recordNewTxs('5. Drainer Phishing Call');
  await page.screenshot({ path: path.join(SHOTS, '07-preset-5-drainer.png') });

  // PRESET 6: Velocity Burst Flood
  console.log('\n--- EXECUTING PRESET 6: Velocity Burst Flood ---');
  await page.click('button:has-text("6. Velocity Burst Flood")');
  await sleep(28000);
  await recordNewTxs('6. Velocity Burst Flood');
  await page.screenshot({ path: path.join(SHOTS, '08-preset-6-velocity.png') });

  // FINAL RESET BREAKER
  console.log('\n--- FINAL RESETTING BREAKER AFTER PRESET 6 ---');
  await page.click('button:has-text("Reset Agent Breaker")');
  await sleep(10000);
  await recordNewTxs('Final Reset Breaker (Post-Velocity)');
  await page.screenshot({ path: path.join(SHOTS, '09-final-state.png') });

  await browser.close();

  console.log('\n================================================================');
  console.log('FETCHING ON-CHAIN RECEIPTS & GAS FOR ALL CAPTURED TRANSACTIONS');
  console.log('================================================================');

  const detailedTxReports = [];
  let totalGasUsed = 0n;
  let totalCost = 0n;

  for (const h of allCapturedTxs) {
    const detail = await getTxDetails(h);
    if (detail.gasUsed) {
      totalGasUsed += BigInt(detail.gasUsed);
      totalCost += BigInt(detail.gasUsed) * 20000000000n;
    }
    console.log(`TX: ${detail.txHash} | Block: ${detail.blockNumber} | Status: ${detail.status} | Gas: ${detail.gasUsed} | Cost: ${detail.costBot} BOT`);
    detailedTxReports.push(detail);
  }

  const finalBal = await provider.getBalance('0x0760635eE48D744199198d4c0b1Da7D14C1F386b');
  console.log('\n================================================================');
  console.log(`Total Captured On-Chain Transactions: ${allCapturedTxs.length}`);
  console.log(`Total Gas Used: ${totalGasUsed.toString()}`);
  console.log(`Total Cost: ${formatEther(totalCost)} BOT`);
  console.log(`Final Deployer Balance: ${formatEther(finalBal)} BOT`);
  console.log('================================================================');

  const finalOutput = {
    testedAt: new Date().toISOString(),
    network: 'BOT Chain Mainnet (Live)',
    chainId: 677,
    defaultModeOnLoad: isDefaultSelected ? 'BOT Chain Testnet (On-Chain)' : 'UNKNOWN',
    warningBannerVisible: warningVisible,
    preset4QuarantinedOffChain: p4QuarantineFound,
    totalOnChainTransactions: allCapturedTxs.length,
    totalGasUsed: totalGasUsed.toString(),
    totalCostBot: formatEther(totalCost),
    finalDeployerBalance: formatEther(finalBal),
    presetResults,
    detailedTxReports,
  };

  fs.writeFileSync(RESULTS, JSON.stringify(finalOutput, null, 2));
  console.log('\nResults written to:', RESULTS);
}

main().catch(console.error);
