import hre from "hardhat";
const { ethers } = hre;

async function main() {
  console.log("🚀 Deploying FirewallX Protocol on BOT Chain...");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer Address:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer Balance:", ethers.formatEther(balance), "BOT");

  // 1. Deploy FirewallXRegistry
  console.log("\n📦 Deploying FirewallXRegistry...");
  const RegistryFactory = await ethers.getContractFactory("FirewallXRegistry");
  const registry = await RegistryFactory.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ FirewallXRegistry deployed at:", registryAddress);

  // 2. Deploy FirewallXAuditor
  console.log("\n📦 Deploying FirewallXAuditor...");
  const AuditorFactory = await ethers.getContractFactory("FirewallXAuditor");
  const auditor = await AuditorFactory.deploy(registryAddress);
  await auditor.waitForDeployment();
  const auditorAddress = await auditor.getAddress();
  console.log("✅ FirewallXAuditor deployed at:", auditorAddress);

  // 3. Deploy FirewallXGuard
  console.log("\n📦 Deploying FirewallXGuard...");
  const GuardFactory = await ethers.getContractFactory("FirewallXGuard");
  const guard = await GuardFactory.deploy(registryAddress, auditorAddress);
  await guard.waitForDeployment();
  const guardAddress = await guard.getAddress();
  console.log("✅ FirewallXGuard deployed at:", guardAddress);

  // 4. Deploy TestTargetContract (Simulation KV store & Vault)
  console.log("\n📦 Deploying TestTargetContract for Agent simulation...");
  const TargetFactory = await ethers.getContractFactory("TestTargetContract");
  const target = await TargetFactory.deploy();
  await target.waitForDeployment();
  const targetAddress = await target.getAddress();
  console.log("✅ TestTargetContract deployed at:", targetAddress);

  console.log("\n=======================================================");
  console.log("🎉 FIREWALLX PROTOCOL DEPLOYMENT COMPLETE");
  console.log("=======================================================");
  console.log("Registry Address: ", registryAddress);
  console.log("Auditor Address:  ", auditorAddress);
  console.log("Guard Address:    ", guardAddress);
  console.log("Test Target:      ", targetAddress);
  console.log("BOT Chain Explorer: https://scan.bohr.life/ (Testnet) | https://scan.botchain.ai/ (Mainnet)");
  console.log("=======================================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
