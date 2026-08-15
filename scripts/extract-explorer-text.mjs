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
  const html = await fetchBody(`https://scan.bohr.life/tx/${txHash}`);
  
  // Extract title and text snippets
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  console.log('Page Title:', titleMatch ? titleMatch[1] : 'No title');
  
  // Look for any status, block number, or not found message
  if (html.includes('404') || html.includes('Not Found') || html.includes('not found')) {
    console.log('Contains 404 / Not Found keyword');
  }
  
  // Print a clean extract
  const text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                   .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                   .replace(/<[^>]+>/g, ' ')
                   .replace(/\s+/g, ' ')
                   .trim();
  
  console.log('Text snippet (first 600 chars):', text.slice(0, 600));
}

run();
