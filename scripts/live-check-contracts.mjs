import { ethers } from "ethers";

const RPC_URL = "https://rpc.bohr.life";
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Addresses the app currently pins in src/config/botchain.ts
const CONTRACTS = {
  Registry: "0x3E0E9fbd6516CD5FDEd996E743A91343030C96A1",
  Auditor: "0x3F9f55ff8c3C5090b8321E9ecB8B6c02a13a055A",
  Guard: "0xa9c078278a1164838Ab449e6019A779242605758",
  TestTarget: "0x35810D68685f11a792438E2Fd237A10313015228",
};

async function main() {
  console.log("Live contract check on BOT Chain Testnet (chainId 968, rpc.bohr.life)");
  console.log("--------------------------------------------------------");
  let allLive = true;
  for (const [name, address] of Object.entries(CONTRACTS)) {
    const code = await provider.getCode(address);
    const len = (code.length - 2) / 2;
    const live = code !== "0x" && code.length > 2;
    if (!live) allLive = false;
    console.log(`${name.padEnd(11)} ${address}  -> ${len} bytes  ${live ? "LIVE" : "DEAD/EMPTY"}`);
  }
  console.log("--------------------------------------------------------");
  console.log(allLive ? "ALL 4 CONTRACTS LIVE" : "SOME CONTRACTS MISSING - ABORT");

  // Also check demo signer balance (the UI's demo signer)
  const demoSigner = ethers.Wallet.fromPhrase("test test test test test test test test test test test junk").connect(provider);
  const bal = await provider.getBalance(demoSigner.address);
  console.log(`Demo UI signer ${demoSigner.address} balance: ${ethers.formatEther(bal)} tBOT`);

  process.exit(allLive ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});