import { ethers } from "ethers";

const RPC_URL = "https://rpc.bohr.life";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const CONTRACTS = {
  registry: "0x3E0E9fbd6516CD5FDEd996E743A91343030C96A1",
  auditor: "0x3F9f55ff8c3C5090b8321E9ecB8B6c02a13a055A",
  guard: "0xa9c078278a1164838Ab449e6019A779242605758",
  testTarget: "0x35810D68685f11a792438E2Fd237A10313015228"
};

async function main() {
  console.log("🔍 Checking on-chain logs across deployment & proof blocks [19881000, 19881100]...\n");

  const logs = await provider.getLogs({
    fromBlock: 19881000,
    toBlock: 19881100,
    address: Object.values(CONTRACTS)
  });

  console.log(`Found ${logs.length} on-chain logs:`);
  for (const log of logs) {
    const contractName = Object.keys(CONTRACTS).find(k => CONTRACTS[k].toLowerCase() === log.address.toLowerCase());
    console.log(`- #${log.blockNumber} [${contractName?.padEnd(10)}] Tx: ${log.transactionHash} | Topic0: ${log.topics[0]}`);
  }
}

main().catch(console.error);
