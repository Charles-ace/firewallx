import hre from "hardhat";
const { ethers } = hre;

/**
 * Redeploy Registry + Auditor + Guard with rolling-window enforcement (v2).
 * TestTargetContract is reused — its bytecode is unchanged.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("DEPLOYER", deployer.address);
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("DEPLOYER BALANCE", ethers.formatEther(bal), "BOT");

  const TARGET = "0xc93932A69E2A9868AAAEC4CAaafB9B9DB508a555";

  const Registry = await ethers.getContractFactory("FirewallXRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("ADDRESS registry", registryAddress);
  console.log("HASH registry-deploy", registry.deploymentTransaction()!.hash);

  const Auditor = await ethers.getContractFactory("FirewallXAuditor");
  const auditor = await Auditor.deploy(registryAddress);
  await auditor.waitForDeployment();
  const auditorAddress = await auditor.getAddress();
  console.log("ADDRESS auditor", auditorAddress);
  console.log("HASH auditor-deploy", auditor.deploymentTransaction()!.hash);

  const Guard = await ethers.getContractFactory("FirewallXGuard");
  const guard = await Guard.deploy(registryAddress, auditorAddress);
  await guard.waitForDeployment();
  const guardAddress = await guard.getAddress();
  console.log("ADDRESS guard", guardAddress);
  console.log("HASH guard-deploy", guard.deploymentTransaction()!.hash);

  // sanity: deployment tx inputs must equal artifact.bytecode + encoded constructor args
  const art = hre.artifacts.readArtifactSync("FirewallXGuard");
  const expectedInput = art.bytecode + ethers.AbiCoder.defaultAbiCoder().encode(["address", "address"], [registryAddress, auditorAddress]).slice(2);
  const guardTx = guard.deploymentTransaction()!;
  const gotInput = guardTx.data;
  console.log("VERIFY guard-deploy-input-exact", gotInput === expectedInput ? "true" : "false");

  const artR = hre.artifacts.readArtifactSync("FirewallXRegistry");
  const regTx = registry.deploymentTransaction()!;
  console.log("VERIFY registry-deploy-input-exact", regTx.data === artR.bytecode ? "true" : "false");

  console.log("TARGET reused", TARGET);
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});