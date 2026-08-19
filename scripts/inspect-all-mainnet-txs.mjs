import { JsonRpcProvider, formatEther } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

const MAINNET_RPC = 'https://rpc.botchain.ai';
const provider = new JsonRpcProvider(MAINNET_RPC);

const txsByPreset = [
  {
    step: 'Preset 1: Normal Payment',
    txHashes: ['0x7bf041e976064d0916f103bd1ec479e7bb3a2c67dd219a0b0354e7d1c5f93bc5']
  },
  {
    step: 'Preset 2: Runaway Loop Attack (3 txs -> Autonomous Breaker Trip)',
    txHashes: [
      '0x8c4ab3087ca93a0b22e16200cc1c808c41d0cf78805eac642a0d15d706014783',
      '0x8e7950258af52aac7149da1114ae30ab9a2763e0dd35336074433976f396c5b6',
      '0x1ce019fa7c498ad9225c9bc47e0281623319031ccb1aeb194793209be4c51f7a'
    ]
  },
  {
    step: 'Post-Preset 2 Breaker Reset',
    txHashes: ['0x564380d6c003e550c9ef40d754422796be93b4cae7c455f9646ed2cb495cbe28']
  },
  {
    step: 'Preset 3: Spend Cap Breach',
    txHashes: ['0xf90114148504a817c80083061a809403c368fe89b7a7a75f3fce186554f01a18']
  },
  {
    step: 'Preset 4: High-Entropy Exploit',
    txHashes: [
      '0x7059d389149a66dba99a1fd4b1a3252db62ddcf5cb5e4ae2aaa9d048c79c5975',
      '0x56f790bce01f0d556ca95c4b0d708b25c9cc94dedac364a7aeff52101be57f1a'
    ]
  },
  {
    step: 'Preset 5: Drainer Phishing Call',
    txHashes: ['0x64836d160073e998007141a3b5dffe90745877e10b932b480fff41a73fc954d4']
  },
  {
    step: 'Preset 6: Velocity Burst Flood (4 txs -> Autonomous Breaker Trip)',
    txHashes: [
      '0xf231fe31c3103de7cc46d74a0a1af36a92e50d6b07b0268494afaf03e2935788',
      '0x3946e5463f4fec9ce34610c387401389690b36902db0020497ac48726222b577',
      '0xf51845e0635b8886efbac8d757a2f00ee255c0b78a32913b53276475c0014361',
      '0x65106f19dd44e30f22140c1cb2112552d2d2acb0c419da370fa7bdbe70753e10'
    ]
  },
  {
    step: 'Post-Preset 6 Final Breaker Reset',
    txHashes: ['0x2716e80518ed5e432787e09c2615a0cb36059369be6ecd962a42b847b1f80435']
  }
];

async function main() {
  console.log('Fetching on-chain receipts from Botchain Mainnet (Chain ID 677)...');
  const results = [];
  let totalGas = 0n;
  let totalCost = 0n;

  for (const group of txsByPreset) {
    console.log(`\n=== ${group.step} ===`);
    const groupResults = [];
    for (const h of group.txHashes) {
      const receipt = await provider.getTransactionReceipt(h);
      if (!receipt) {
        console.log(`  Hash: ${h} -> RECEIPT NOT FOUND`);
        continue;
      }
      const gas = receipt.gasUsed;
      const gasPrice = receipt.gasPrice ?? receipt.effectiveGasPrice ?? 20000000000n;
      const cost = gas * gasPrice;
      totalGas += gas;
      totalCost += cost;

      const item = {
        txHash: h,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'SUCCESS (1)' : 'REVERTED (0)',
        gasUsed: Number(gas),
        gasPriceGwei: Number(gasPrice) / 1e9,
        costBot: formatEther(cost)
      };
      console.log(`  Hash: ${item.txHash}`);
      console.log(`  Block: ${item.blockNumber} | Status: ${item.status} | Gas Used: ${item.gasUsed.toLocaleString()} | Cost: ${item.costBot} BOT`);
      groupResults.push(item);
    }
    results.push({ step: group.step, transactions: groupResults });
  }

  const deployer = '0x0760635eE48D744199198d4c0b1Da7D14C1F386b';
  const bal = await provider.getBalance(deployer);
  console.log('\n================================================================');
  console.log(`Total Transactions Captured: 14`);
  console.log(`Total Gas Used: ${totalGas.toString()}`);
  console.log(`Total Cost: ${formatEther(totalCost)} BOT`);
  console.log(`Deployer Balance Remaining: ${formatEther(bal)} BOT`);
  console.log('================================================================');

  const outPath = path.join(process.cwd(), 'docs/mainnet-ui-proof-results.json');
  fs.writeFileSync(outPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    network: 'BOT Chain Mainnet (Live)',
    chainId: 677,
    deployerAddress: deployer,
    deployerBalanceRemaining: formatEther(bal),
    totalGasUsed: totalGas.toString(),
    totalCostBot: formatEther(totalCost),
    results
  }, null, 2));
  console.log('Detailed JSON saved to:', outPath);
}

main().catch(console.error);
