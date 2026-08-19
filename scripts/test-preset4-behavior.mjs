import { JsonRpcProvider, Wallet, Contract, parseEther, formatEther } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

const TESTNET_RPC = 'https://rpc.bohr.life';
const MAINNET_RPC = 'https://rpc.botchain.ai';

const testnetProvider = new JsonRpcProvider(TESTNET_RPC);
const mainnetProvider = new JsonRpcProvider(MAINNET_RPC);

const GUARD_ABI = [
  'function executeGuarded(address target, uint256 value, bytes calldata data) external payable returns (bytes memory)'
];

const TARGET_ABI = [
  'function setKeyValue(string calldata key, string calldata value) external payable',
  'function totalOps() external view returns (uint256)'
];

const REGISTRY_ABI = [
  'function isActionPermittedView(address agentWallet, address target, uint256 value, bytes32 calldataHash) external view returns (bool permitted, string memory reason)'
];

async function testNetwork(name, provider, guardAddr, registryAddr, targetAddr) {
  console.log(`\n======================================================`);
  console.log(`Testing Preset 4 Behavior on: ${name}`);
  console.log(`======================================================`);

  const wallet = new Wallet(process.env.PRIVATE_KEY, provider);
  const guard = new Contract(guardAddr, GUARD_ABI, wallet);
  const registry = new Contract(registryAddr, REGISTRY_ABI, wallet);
  const target = new Contract(targetAddr, TARGET_ABI, wallet);

  const randomHex = '0x' + Array.from({ length: 120 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
  const calldataHash = '0x1234567812345678123456781234567812345678123456781234567812345678';

  // 1. Check Registry preflight
  const [permitted, reason] = await registry.isActionPermittedView(wallet.address, targetAddr, parseEther('0.0001'), calldataHash);
  console.log(`1. Registry isActionPermittedView: permitted = ${permitted}, reason = "${reason}"`);

  // 2. Try direct call to target with random calldata
  try {
    const rawCallResult = await provider.call({
      to: targetAddr,
      data: randomHex,
      value: parseEther('0.0001'),
      from: wallet.address
    });
    console.log(`2. Direct call to target result:`, rawCallResult);
  } catch (err) {
    console.log(`2. Direct call to target reverted (as expected):`, err.shortMessage || err.message);
  }

  // 3. Try call to Guard with random calldata
  try {
    const guardCallResult = await provider.call({
      to: guardAddr,
      data: guard.interface.encodeFunctionData('executeGuarded', [targetAddr, parseEther('0.0001'), randomHex]),
      value: parseEther('0.0001'),
      from: wallet.address
    });
    console.log(`3. Guard.executeGuarded result:`, guardCallResult);
  } catch (err) {
    console.log(`3. Guard.executeGuarded reverted with:`, err.shortMessage || err.message);
    if (err.data) {
      console.log(`   Revert data:`, err.data);
      // Check if matches TargetCallFailed() selector (0x59902bd2 or similar)
      const errorSelector = err.data.slice(0, 10);
      console.log(`   Revert Selector:`, errorSelector);
    }
  }
}

async function main() {
  await testNetwork(
    'BOT Chain Testnet (Chain ID 968)',
    testnetProvider,
    '0xa9c078278a1164838Ab449e6019A779242605758',
    '0x3E0E9fbd6516CD5FDEd996E743A91343030C96A1',
    '0x35810D68685f11a792438E2Fd237A10313015228'
  );

  await testNetwork(
    'BOT Chain Mainnet (Chain ID 677)',
    mainnetProvider,
    '0x03c368fE89B7A7a75f3FCE186554F01a18FDAb0e',
    '0xbbEAf8B3445dBa8e2cC468Da27675A65e59D8fEf',
    '0x92078F723b8E557EF011C40e1c4413445574C158'
  );
}

main().catch(console.error);
