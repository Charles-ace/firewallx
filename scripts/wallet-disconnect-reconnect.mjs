import puppeteer from 'puppeteer-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://localhost:3000';
const ACCOUNT = '0xA8D9FB24d62c0c459C86240e2ff7EB68981F58E0';
const RPC = 'https://rpc.bohr.life';
const BOT_CHAIN_ID = '0x3c8';

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
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.evaluateOnNewDocument(
    ({ account, rpc, botChainId }) => {
      let chainId = '0x1';
      const eth = {
        isMetaMask: true,
        async request({ method, params }) {
          if (method === 'eth_accounts') return [];
          if (method === 'eth_requestAccounts') return [account];
          if (method === 'eth_chainId') return chainId;
          if (method === 'wallet_switchEthereumChain') {
            if (params?.[0]?.chainId === botChainId) { chainId = botChainId; return null; }
            const err = new Error('Unrecognized chain'); err.code = 4902; throw err;
          }
          if (method === 'wallet_addEthereumChain') { chainId = botChainId; return null; }
          if (method === 'eth_getBalance') {
            const res = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_getBalance', params: [account, 'latest'] }) });
            const j = await res.json();
            return j.result ?? '0x0';
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
      window.ethereum = eth;
    },
    { account: ACCOUNT.toLowerCase(), rpc: RPC, botChainId: BOT_CHAIN_ID }
  );

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1500);

  // 1. Connect
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim().toLowerCase() === 'connect wallet')?.click());
  await sleep(1200);
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Browser Wallet'))?.click());
  await sleep(7000);

  const connected1 = await page.evaluate(() => document.body.textContent?.includes('tBOT') && document.body.textContent?.includes('...'));
  const navAfterConnect = await page.evaluate(() => Array.from(document.querySelectorAll('div')).find((d) => d.textContent?.includes('tBOT') && d.textContent?.includes('...'))?.textContent?.replace(/\s+/g, ' ') ?? null);
  console.log('CONNECTED_1', connected1, '| NAV:', navAfterConnect);

  // 2. Disconnect via the ✕ button in nav
  const disconnected = await page.evaluate(() => {
    const disBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === '✕' || b.getAttribute('aria-label')?.includes('Disconnect'));
    if (disBtn) { disBtn.click(); return true; }
    const nav = Array.from(document.querySelectorAll('div')).find((d) => d.textContent?.includes('tBOT') && d.textContent?.includes('...'));
    if (nav) {
      const x = nav.querySelector('button');
      if (x) { x.click(); return true; }
    }
    return false;
  });
  console.log('DISCONNECT_CLICKED', disconnected);
  await sleep(3000);

  const disconnectedState = await page.evaluate(() => ({
    stillConnected: document.body.textContent?.includes('0xa8d9') ?? false,
    connectVisible: Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.trim().toLowerCase() === 'connect wallet'),
  }));
  console.log('AFTER_DISCONNECT', JSON.stringify(disconnectedState));

  // 3. Reconnect
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim().toLowerCase() === 'connect wallet')?.click());
  await sleep(1200);
  await page.evaluate(() => Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes('Browser Wallet'))?.click());
  await sleep(7000);

  const reconnected = await page.evaluate(() => document.body.textContent?.includes('0xa8d9') ?? false);
  console.log('RECONNECTED', reconnected);

  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
  console.log('PAGE_ERRORS', JSON.stringify(pageErrors));
  await page.screenshot({ path: 'docs/screenshots-live/08-wallet-reconnected.png' });
  console.log('SCREENSHOT saved');
} finally {
  await browser.close();
}