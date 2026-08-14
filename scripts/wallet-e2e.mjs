import puppeteer from 'puppeteer-core';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = process.argv[2] ?? 'https://firewall-x.vercel.app';
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
      const calls = [];
      let chainId = '0x1'; // start on the WRONG chain to force the switch path
      const eth = {
        isMetaMask: true,
        async request({ method, params }) {
          calls.push(method + (params ? ':' + JSON.stringify(params).slice(0, 120) : ''));
          if (method === 'eth_accounts') return []; // no pre-existing session
          if (method === 'eth_requestAccounts') return [account];
          if (method === 'eth_chainId') return chainId;
          if (method === 'wallet_switchEthereumChain') {
            if (params?.[0]?.chainId === botChainId) { chainId = botChainId; return null; } // approved
            const err = new Error('Unrecognized chain');
            err.code = 4902;
            throw err;
          }
          if (method === 'wallet_addEthereumChain') { chainId = botChainId; return null; } // approved add
          if (method === 'eth_getBalance') {
            const res = await fetch(rpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'eth_getBalance', params: [account, 'latest'] }),
            });
            const j = await res.json();
            return j.result ?? '0x0';
          }
          if (method === 'eth_blockNumber') {
            const res = await fetch(rpc, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'eth_blockNumber', params: [] }),
            });
            const j = await res.json();
            return j.result;
          }
          return null;
        },
        on: () => {},
        removeListener: () => {},
      };
      window.ethereum = eth;
      window.__rpcCalls = calls;
    },
    { account: ACCOUNT.toLowerCase(), rpc: RPC, botChainId: BOT_CHAIN_ID }
  );

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 90000 });
  await sleep(1500);

  const connectClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const b = buttons.find((el) => el.textContent?.trim().toLowerCase() === 'connect wallet');
    if (b) { b.click(); return true; }
    return false;
  });
  console.log('CONNECT_CLICKED', connectClicked);
  await sleep(1500);

  const injectedClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const b = buttons.find((el) => el.textContent?.includes('Browser Wallet'));
    if (b) { b.click(); return true; }
    return false;
  });
  console.log('BROWSER_WALLET_CLICKED', injectedClicked);
  await sleep(7000);

  const state = await page.evaluate(() => {
    const nav = Array.from(document.querySelectorAll('div')).find((d) =>
      d.textContent?.includes('tBOT') && d.textContent?.includes('...'));
    const navText = nav?.textContent?.replace(/\s+/g, ' ') ?? null;
    const switchPill = Array.from(document.querySelectorAll('button')).some((b) =>
      b.textContent?.includes('Switch to BOT Testnet'));
    const modalOpen = Array.from(document.querySelectorAll('div')).some((d) =>
      d.textContent?.includes('Connect to FirewallX'));
    const errText = (document.body.textContent ?? '').match(/Connection[^.]*\./)?.[0] ?? null;
    return {
      navText,
      switchPillVisible: switchPill,
      modalOpen,
      error: errText,
      calls: window.__rpcCalls ?? [],
    };
  });
  console.log('WALLET_STATE', JSON.stringify(state, null, 1));
  console.log('CONSOLE_ERRORS', JSON.stringify(consoleErrors));
  console.log('PAGE_ERRORS', JSON.stringify(pageErrors));

  await page.screenshot({ path: 'shot-deployed-wallet.png' });
  console.log('SCREENSHOT shot-deployed-wallet.png');
} finally {
  await browser.close();
}