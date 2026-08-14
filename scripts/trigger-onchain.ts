import hre from "hardhat";
const { ethers } = hre;

/**
 * Fire genuine on-chain events from the deployed sentinel suite on
 * BOT Chain Testnet (chainId 968) so the event-log indexer has real
 * data to pick up. Prints every tx hash for independent verification.
 *
 * Usage: npx hardhat run scripts/trigger-onchain.ts --network botchainTestnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("deployer:", deployer.address);

  const REGISTRY = "0x271b7549524fa569317f8abaa0EB4504C280F4AD";
  const AUDITOR = "0x0E969975A150AC0Fc8874dd6f68c0fE5c0b7EbAa";
  const GUARD = "0x84d6d903045D686550D4B2bA01003aDF5917f114";
  const TARGET = "0xc93932A69E2A9868AAAEC4CAaafB9B9DB508a555";

  const registry = await ethers.getContractAt("FirewallXRegistry", REGISTRY);
  const auditor = await ethers.getContractAt("FirewallXAuditor", AUDITOR);
  const guard = await ethers.getContractAt("FirewallXGuard", GUARD);
  const target = await ethers.getContractAt("TestTargetContract", TARGET);

  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);

  // 1. KeyValueSet on TestTarget
  const tx1 = await target.setKeyValue("indexer-probe", `firewallx-${stamp}`);
  await tx1.wait();
  console.log("KeyValueSet tx:", tx1.hash);

  // 2. ActionEvaluated on the Auditor (deployer is the authorized reporter)
  const actionHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint256", "string"],
    [deployer.address, TARGET, 0, `indexer-probe-${stamp}`]
  ));
  const tx2 = await auditor.recordEvaluation(
    deployer.address,
    actionHash,
    TARGET,
    0,
    0, // ALLOW
    5, // anomalyScore 5/1000
    "indexer-probe",
    "On-chain trigger from FirewallX indexer verification"
  );
  await tx2.wait();
  console.log("ActionEvaluated tx:", tx2.hash);

  // 3. GuardedExecution through the Guard (best-effort: needs registered agent)
  try {
    const tx3 = await guard.executeGuarded(TARGET, 0, "0x");
    await tx3.wait();
    console.log("GuardedExecution tx:", tx3.hash);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log("GuardedExecution skipped (needs registered agent policy):", msg.split("\n")[0].slice(0, 200));
  }

  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});