import { ethers } from "ethers";
import fs from "fs";

const RPC_URL = "https://rpc.bohr.life";
const provider = new ethers.JsonRpcProvider(RPC_URL);

const CONTRACTS = {
  Registry: "0x3E0E9fbd6516CD5FDEd996E743A91343030C96A1",
  Auditor: "0x3F9f55ff8c3C5090b8321E9ecB8B6c02a13a055A",
  Guard: "0xa9c078278a1164838Ab449e6019A779242605758",
  TestTarget: "0x35810D68685f11a792438E2Fd237A10313015228"
};

async function main() {
  console.log("🔍 Verifying on-chain bytecode for deployed contracts on BOT Chain Testnet...\n");
  for (const [name, address] of Object.entries(CONTRACTS)) {
    const code = await provider.getCode(address);
    const codeLen = (code.length - 2) / 2;
    console.log(`✅ ${name.padEnd(12)} (${address}): ${codeLen} bytes deployed (bytecode verified non-empty: ${code.startsWith("0x60") || code.startsWith("0x")})`);
    if (code === "0x") {
      throw new Error(`FATAL: ${name} at ${address} has empty bytecode!`);
    }
  }
  console.log("\n🎉 All 4 contracts confirmed live and non-empty on BOT Chain Testnet!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
