import https from 'https';

const hosts = [
  'scan.bohr.life',
  'testnet-scan.bohr.life',
  'testnet.scan.bohr.life',
  'explorer.bohr.life',
  'testnet-explorer.bohr.life',
  'testnet-explorer.botchain.ai',
  'explorer.botchain.ai',
  'testnet-scan.botchain.ai',
];

async function check(h) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: h,
      port: 443,
      path: '/',
      method: 'GET',
      timeout: 4000
    }, (res) => {
      resolve({ host: h, status: res.statusCode });
    });
    req.on('error', e => resolve({ host: h, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ host: h, error: 'Timeout' }); });
    req.end();
  });
}

async function main() {
  for (const h of hosts) {
    const res = await check(h);
    console.log(JSON.stringify(res));
  }
}

main();
