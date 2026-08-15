import https from 'https';

function fetchBody(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', e => resolve('Error: ' + e.message));
  });
}

async function run() {
  const txHash = '0x2769ffa6f5a9a2028ee12e6612ed58e90b311e0c4665c62786dc827bb1b50bed';
  
  console.log('=== Checking scan.bohr.life ===');
  const bohrHtml = await fetchBody(`https://scan.bohr.life/tx/${txHash}`);
  console.log('bohr length:', bohrHtml.length);
  console.log('Contains txHash?', bohrHtml.includes(txHash) || bohrHtml.includes('0x2769'));
  console.log('Contains "0xa9c078278a1164838ab449e6019a779242605758"?', bohrHtml.includes('0xa9c078278a1164838ab449e6019a779242605758') || bohrHtml.includes('a9c078'));
  console.log('Contains "Transaction"?', bohrHtml.includes('Transaction') || bohrHtml.includes('Success'));

  console.log('\n=== Checking scan.botchain.ai ===');
  const botchainHtml = await fetchBody(`https://scan.botchain.ai/tx/${txHash}`);
  console.log('botchain length:', botchainHtml.length);
  console.log('Contains txHash?', botchainHtml.includes(txHash) || botchainHtml.includes('0x2769'));
  console.log('Contains "404" or "Not Found"?', botchainHtml.includes('404') || botchainHtml.includes('Not Found'));
}

run();
