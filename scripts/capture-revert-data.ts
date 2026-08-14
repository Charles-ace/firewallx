import hre from "hardhat";
const { ethers } = hre;

/**
 * Capture byte-exact revert data (ExecutionBlocked selector + reason string)
 * for loop and velocity denials on the v2 contracts, via staticCall.
 * Waits 61s first so no stale rolling-window entries from prior runs interfere.
 */
async function main() {
  const REGISTRY = "0x8e55ac0a66E9E34376dcCb7D693FeBfF239C3145";
  const GUARD = "0x2985B6e0dE7F34c503a52F217927d23bb129aa67";
  const TARGET = "0xc93932A69E2A9868AAAEC4CAaafB9B9DB508a555";

  const registry = await ethers.getContractAt("FirewallXRegistry", REGISTRY);
  const guard = await ethers.getContractAt("FirewallXGuard", GUARD);

  const agent = ethers.Wallet.fromPhrase(process.env.PROOF_AGENT_MNEMONIC ?? "test test test test test test test test test test test junk")
    .connect(ethers.provider);

  const existing = await registry.agents(agent.address);
  if (existing.registeredAt === 0n) throw new Error("proof agent not registered");
  if (existing.status === 2n) throw new Error("breaker tripped — reset before capturing");
  console.log("AGENT", agent.address, "status", existing.status.toString());

  console.log("SLEEP waiting 61s so rolling windows are empty...");
  await new Promise((r) => setTimeout(r, 61000));

  const targetIface = new ethers.Interface(["function setKeyValue(string key, string value) external payable"]);
  const kvAllow = targetIface.encodeFunctionData("setKeyValue", ["capture2", "allow"]);
  const kvOther = targetIface.encodeFunctionData("setKeyValue", ["capture2", "other"]);
  const kvBurst = targetIface.encodeFunctionData("setKeyValue", ["capture2", "burst"]);

  const capture = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      console.log(label, "unexpectedly succeeded");
    } catch (err) {
      const e = err as { data?: string; message?: string };
      console.log(label, String(e.data ?? e.message ?? "").slice(0, 400));
    }
  };

  // loop: 2 allowed identical calls, then staticCall the 3rd -> raw revert data
  const a1 = await guard.connect(agent).executeGuarded(TARGET, 0n, kvAllow, { gasLimit: 300000 });
  await a1.wait();
  console.log("HASH capture-loop-allow-1", a1.hash);
  const a2 = await guard.connect(agent).executeGuarded(TARGET, 0n, kvAllow, { gasLimit: 300000 });
  await a2.wait();
  console.log("HASH capture-loop-allow-2", a2.hash);
  await capture("REVERT-DATA loop-breach", () =>
    guard.connect(agent).executeGuarded.staticCall(TARGET, 0n, kvAllow));

  // velocity: 1 more allowed distinct call (3rd in window), staticCall the 4th
  const a3 = await guard.connect(agent).executeGuarded(TARGET, 0n, kvOther, { gasLimit: 300000 });
  await a3.wait();
  console.log("HASH capture-velocity-allow-3", a3.hash);
  await capture("REVERT-DATA velocity-breach", () =>
    guard.connect(agent).executeGuarded.staticCall(TARGET, 0n, kvBurst));

  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});