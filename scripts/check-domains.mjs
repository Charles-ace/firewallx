import https from 'https';

function checkUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = https.request({
        hostname: parsed.hostname,
        port: 443,
        path: parsed.pathname + (parsed.search || ''),
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 8000
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({
          url,
          status: res.statusCode,
          headers: res.headers,
          preview: data.slice(0, 150)
        }));
      });
      req.on('error', e => resolve({ url, error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ url, error: 'Timeout' }); });
      req.end();
    } catch (e) {
      resolve({ url, error: e.message });
    }
  });
}

async function main() {
  const txHash = '0x2769ffa6f5a9a2028ee12e6612ed58e90b311e0c4665c62786dc827bb1b50bed';
  
  console.log('=== EXPLORER DOMAIN CHECK ===');
  const expUrls = [
    `https://scan.bohr.life/tx/${txHash}`,
    `https://scan.botchain.ai/tx/${txHash}`,
    `https://testnet.bohr.life/tx/${txHash}`,
    `https://scan.bohr.life/address/0x3E0E9fbd6516CD5FDEd996E743A91343030C96A1`,
  ];

  for (const u of expUrls) {
    const res = await checkUrl(u);
    console.log(`URL: ${u}`);
    console.log(`Result:`, JSON.stringify(res, null, 2));
  }

  console.log('\n=== VERCEL DEPLOYMENT DOMAIN CHECK ===');
  const vUrls = [
    'https://firewall-x.vercel.app',
    'https://firewallx-agent-firewall.vercel.app',
  ];

  for (const u of vUrls) {
    const res = await checkUrl(u);
    console.log(`URL: ${u}`);
    console.log(`Result:`, JSON.stringify(res, null, 2));
  }
}

main();
