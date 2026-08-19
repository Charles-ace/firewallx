import { JsonRpcProvider, Wallet, Contract, parseEther, formatEther } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

const MAINNET_RPC = 'https://rpc.botchain.ai';
const provider = new JsonRpcProvider(MAINNET_RPC);

const REGISTRY_ADDR = '0xbbEAf8B3445dBa8e2cC468Da27675A65e59D8fEf';
const REGISTRY_ABI = [
  'function agents(address) external view returns (address owner, string name, string aidid, uint8 status, uint256 registeredAt, uint256 lastTripTime, string lastTripReason, bytes32 lastTripPayloadHash, uint256 totalActionsEvaluated, uint256 totalBlocks, uint256 totalTrips)',
  'function policies(address) external view returns (uint256 maxSpendPerTx, uint256 maxHourlySpend, uint32 maxTxPerMinute, uint32 loopWindowSeconds, uint32 maxIdenticalPayloads, uint16 anomalyThreshold, bool enforceAllowlist)',
  'function updatePolicy(address agentWallet, tuple(uint256 maxSpendPerTx, uint256 maxHourlySpend, uint32 maxTxPerMinute, uint32 loopWindowSeconds, uint32 maxIdenticalPayloads, uint16 anomalyThreshold, bool enforceAllowlist) newPolicy) external',
  'function setBlocklist(address agentWallet, address target, bool blocked) external',
  'function blocklist(address agentWallet, address target) external view returns (bool)'
];

async function main() {
  const deployer = new Wallet(process.env.PRIVATE_KEY, provider);
  console.log('Updating Mainnet Agent Policy & Blocklist for:', deployer.address);

  const registry = new Contract(REGISTRY_ADDR, REGISTRY_ABI, deployer);

  const newPolicy = {
    maxSpendPerTx: parseEther('0.05'), // 0.05 BOT cap per tx
    maxHourlySpend: parseEther('1.0'),
    maxTxPerMinute: 3,
    loopWindowSeconds: 60,
    maxIdenticalPayloads: 2,
    anomalyThreshold: 750,
    enforceAllowlist: false
  };

  console.log('Submitting updatePolicy tx...');
  const tx1 = await registry.updatePolicy(deployer.address, newPolicy);
  console.log('UpdatePolicy TX Hash:', tx1.hash);
  const rc1 = await tx1.wait();
  console.log('Policy updated in Block:', rc1.blockNumber);

  // Set blocklist for drainer address
  const drainerAddress = '0x000000000000000000000000000000000000dEaD';
  console.log('Setting blocklist for drainer:', drainerAddress);
  const tx2 = await registry.setBlocklist(deployer.address, drainerAddress, true);
  console.log('SetBlocklist TX Hash:', tx2.hash);
  const rc2 = await tx2.wait();
  console.log('Blocklist set in Block:', rc2.blockNumber);

  const pol = await registry.policies(deployer.address);
  console.log('Active Policy on Mainnet:', {
    maxSpendPerTx: formatEther(pol.maxSpendPerTx) + ' BOT',
    maxTxPerMinute: Number(pol.maxTxPerMinute),
    maxIdenticalPayloads: Number(pol.maxIdenticalPayloads)
  });
}

main().catch(console.error);
