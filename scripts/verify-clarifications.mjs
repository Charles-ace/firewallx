import https from 'https';
import http from 'http';

function postRpc(url, method, params = []) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    });

    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 8000,
    };

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (err) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'Timeout' });
    });

    req.write(payload);
    req.end();
  });
}

function checkHttp(url) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      timeout: 8000,
    };

    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk.slice(0, 500)));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          location: res.headers.location,
          preview: data.slice(0, 300),
        });
      });
    });

    req.on('error', (err) => resolve({ error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ error: 'Timeout' });
    });
    req.end();
  });
}

async function run() {
  console.log('=== 1. RPC ETH_CHAINID AUDIT ===');
  const rpcs = [
    'https://testnet-rpc.botchain.ai',
    'https://rpc.bohr.life',
    'https://rpc.botchain.ai',
  ];

  for (const rpc of rpcs) {
    console.log(`\nTesting RPC: ${rpc}`);
    const chainIdRes = await postRpc(rpc, 'eth_chainId');
    console.log('eth_chainId response:', JSON.stringify(chainIdRes));
    if (chainIdRes.data && chainIdRes.data.result) {
      console.log(`Parsed chainId decimal: ${parseInt(chainIdRes.data.result, 16)}`);
    }
  }

  console.log('\n=== 2. TX HASH VERIFICATION ON-CHAIN ===');
  const testTxs = [
    '0x2769ffa6f5a9a2028ee12e6612ed58e90b311e0c4665c62786dc827bb1b50bed',
    '0x7b87cde538953bfd1a530d0ad01ca22dcc837270ac9c13cd47741831e2b42e9c',
    '0x604c0ec5554121d641bab51fc295d567016361411d40d68d5611b87a7821a7c2',
  ];

  for (const txHash of testTxs) {
    console.log(`\nChecking Tx: ${txHash}`);
    const txReceipt = await postRpc('https://testnet-rpc.botchain.ai', 'eth_getTransactionReceipt', [txHash]);
    if (txReceipt.data && txReceipt.data.result) {
      const r = txReceipt.data.result;
      console.log(`Receipt: blockNumber=${parseInt(r.blockNumber, 16)}, status=${parseInt(r.status, 16)}, gasUsed=${parseInt(r.gasUsed, 16)}, to=${r.to}`);
    } else {
      console.log('Receipt not found on testnet-rpc.botchain.ai, testing rpc.bohr.life...');
      const bohrReceipt = await postRpc('https://rpc.bohr.life', 'eth_getTransactionReceipt', [txHash]);
      console.log('bohr receipt:', JSON.stringify(bohrReceipt));
    }
  }

  console.log('\n=== 3. EXPLORER DOMAIN AUDIT ===');
  const explorerUrls = [
    'https://testnet-scan.botchain.ai/tx/0x2769ffa6f5a9a2028ee12e6612ed58e90b311e0c4665c62786dc827bb1b50bed',
    'https://scan.botchain.ai/tx/0x2769ffa6f5a9a2028ee12e6612ed58e90b311e0c4665c62786dc827bb1b50bed',
    'https://scan.bohr.life/tx/0x2769ffa6f5a9a2028ee12e6612ed58e90b311e0c4665c62786dc827bb1b50bed',
    'https://testnet.bohr.life/tx/0x2769ffa6f5a9a2028ee12e6612ed58e90b311e0c4665c62786dc827bb1b50bed',
  ];

  for (const expUrl of explorerUrls) {
    const res = await checkHttp(expUrl);
    console.log(`\nURL: ${expUrl}`);
    console.log(`Status Code: ${res.statusCode}`);
    if (res.location) console.log(`Redirect Location: ${res.location}`);
  }

  console.log('\n=== 4. VERCEL DEPLOYMENT DOMAINS AUDIT ===');
  const vercelUrls = [
    'https://firewall-x.vercel.app',
    'https://firewallx-agent-firewall.vercel.app',
  ];

  for (const vUrl of vercelUrls) {
    const res = await checkHttp(vUrl);
    console.log(`\nURL: ${vUrl}`);
    console.log(`Status Code: ${res.statusCode}`);
    if (res.headers && res.headers['x-vercel-id']) {
      console.log(`Vercel ID: ${res.headers['x-vercel-id']}`);
    }
  }
}

run();
