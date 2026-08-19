import { JsonRpcProvider, formatEther } from 'ethers';

const MAINNET_RPC = 'https://rpc.botchain.ai';
const provider = new JsonRpcProvider(MAINNET_RPC);
const DEPLOYER = '0x0760635eE48D744199198d4c0b1Da7D14C1F386b'.toLowerCase();

async function main() {
  const currentBlock = await provider.getBlockNumber();
  console.log('Current Mainnet Block:', currentBlock);

  const startBlock = 20255790;
  console.log(`Scanning blocks ${startBlock} to ${currentBlock} for deployer txs...`);

  const foundTxs = [];
  for (let b = startBlock; b <= currentBlock; b++) {
    const block = await provider.getBlock(b, true);
    if (!block || !block.prefetchedTransactions) continue;
    for (const tx of block.prefetchedTransactions) {
      if (tx.from && tx.from.toLowerCase() === DEPLOYER) {
        const receipt = await provider.getTransactionReceipt(tx.hash);
        foundTxs.push({
          block: b,
          hash: tx.hash,
          to: tx.to,
          value: formatEther(tx.value),
          gasUsed: receipt?.gasUsed?.toString(),
          status: receipt?.status === 1 ? 'SUCCESS' : 'REVERTED'
        });
      }
    }
  }

  console.log(`\nFound ${foundTxs.length} transactions by deployer:`);
  for (const t of foundTxs) {
    console.log(`Block ${t.block} | Hash: ${t.hash} | To: ${t.to} | Gas: ${t.gasUsed} | Status: ${t.status}`);
  }
}

main().catch(console.error);
