# FirewallX

AI Agent Action Firewall for BOT Chain — an on-chain smart-contract sentinel suite with autonomous circuit breaker enforcement, paired with an in-browser policy engine and live event telemetry.

> **Standing Principle.** This project strictly separates **on-chain enforcement** from **in-browser / client-side analysis**. Every check that matters — velocity rate limits, identical-payload loop detection, spend caps, allowlists/blocklists, and autonomous circuit breaker tripping — is enforced by the deployed contracts themselves.

---

## What is enforced on-chain (deployed & verified on testnet)

The deployed smart-contract suite directly gates *actual* agent transactions. The Guard halts execution before reaching the target when **any** policy rule fails:

| Check | Enforced? | Where | On Breach Behavior |
|---|---|---|---|
| Agent is registered | ✅ | Registry `isActionPermitted` | Halts execution (`"Agent not registered"`) |
| Circuit breaker status (TRIPPED / PAUSED) | ✅ | Registry `isActionPermitted` | Halts execution (`"Circuit Breaker TRIPPED"`) |
| Destination blocklist | ✅ | Registry `isActionPermitted` | Halts execution (`"Target in blocklist"`) |
| Destination allowlist (when `enforceAllowlist`) | ✅ | Registry `isActionPermitted` | Halts execution (`"Target not in allowlist"`) |
| Per-tx spend cap (`maxSpendPerTx`) | ✅ | Registry `isActionPermitted` | Halts execution (`"Spend cap exceeded"`) |
| Velocity rate limit (`maxTxPerMinute`, rolling 60s) | ✅ | Registry ring buffer | **Autonomously trips circuit breaker on-chain** |
| Identical-payload loop limit (`maxIdenticalPayloads`, `loopWindowSeconds`) | ✅ | Registry repetition window | **Autonomously trips circuit breaker on-chain** |

`isActionPermitted(agentWallet, target, value, calldataHash)` (source of truth: `contracts/FirewallXRegistry.sol`) is **stateful**: it maintains rolling timestamp buffers and per-fingerprint repetition state. When a threshold is breached, the contract **autonomously trips the agent's circuit breaker on-chain** (`status = TRIPPED`, `totalTrips += 1`), emits `CircuitBreakerTripped` and `AgentStatusChanged`, and prevents any forward calls to the target.

### Deployed addresses (BOT Chain testnet, chainId 968)

| Contract | Address | Verification Status |
|---|---|---|
| `FirewallXRegistry` (v3, autonomous breaker) | `0x3E0E9fbd6516CD5FDEd996E743A91343030C96A1` | Bytecode verified (9,384 bytes) |
| `FirewallXAuditor` (v3, immutable telemetry) | `0x3F9f55ff8c3C5090b8321E9ecB8B6c02a13a055A` | Bytecode verified (4,428 bytes) |
| `FirewallXGuard` (v3, gatekeeper & refund) | `0xa9c078278a1164838Ab449e6019A779242605758` | Bytecode verified (1,227 bytes) |
| `TestTargetContract` (KV store & vault) | `0x35810D68685f11a792438E2Fd237A10313015228` | Bytecode verified (1,570 bytes) |

Explorer links:
- Registry: https://scan.bohr.life/address/0x3E0E9fbd6516CD5FDEd996E743A91343030C96A1
- Auditor: https://scan.bohr.life/address/0x3F9f55ff8c3C5090b8321E9ecB8B6c02a13a055A
- Guard: https://scan.bohr.life/address/0xa9c078278a1164838Ab449e6019A779242605758
- TestTarget: https://scan.bohr.life/address/0x35810D68685f11a792438E2Fd237A10313015228

---

## On-Chain Proof Artifacts (Raw Testnet Transactions)

Autonomous Circuit Breaker proof executed against BOT Chain Testnet (`scripts/prove-onchain-autonomous-breaker.ts`):

1. **Agent Registration**: [`0x2120b9f0…c318`](https://scan.bohr.life/tx/0x2120b9f0a515901adbc02c0f4434b66aa831708e265356db5439b693fed3c318) (Block `#19881023`)
2. **Compliant Call 1 (Allow)**: [`0x50ef2c15…2d15`](https://scan.bohr.life/tx/0x50ef2c157eb0521205070d55ac70b8ede8e1782ac60799db64a25b6ed5732d15) (Block `#19881028`)
3. **Compliant Call 2 (Allow)**: [`0xad9298c8…0964`](https://scan.bohr.life/tx/0xad9298c8091d43840a7ddd42977378926e14bf76134d3fd53a0a76f969210964) (Block `#19881033`)
4. **Call 3 (Loop Breaker Trip)**: [`0xa6fca345…a695`](https://scan.bohr.life/tx/0xa6fca345ae89e50a0b5d48fc3deb579d68a03b4ed507050852b2d46532dfa695) (Block `#19881038`) — *Autonomously tripped breaker on-chain! Status became TRIPPED, target protected.*
5. **Follow-up Blocked by Tripped Breaker**: [`0xd38d2edb…6507`](https://scan.bohr.life/tx/0xd38d2edb37a21f10d408ed4929d52b2154fc657e1a4069335f924f9df57e6507) (Block `#19881043`)
6. **Auditor Record**: [`0xbd2be5b7…ece0`](https://scan.bohr.life/tx/0xbd2be5b7798e4063b2144796f1afbd9a9cacc29a2c7addb45d6c6589615aece0) (Block `#19881048`)
7. **Reset Breaker on-chain**: [`0xa1788bb8…151d`](https://scan.bohr.life/tx/0xa1788bb819209066d81bacdbc00517a80ad9b423696cc23582d708ecffa4151d) (Block `#19881052`)
8. **Velocity Tx 1**: [`0x3a99f6ed…531`](https://scan.bohr.life/tx/0x3a99f6edea23ff42ffab5a202d13c69f6084246b82fe17be617c70b0ce76f531)
9. **Velocity Tx 2**: [`0xf1094e43…82b4`](https://scan.bohr.life/tx/0xf1094e43fee48caaeba8311ce6bdc5ddc12907843fb6701066b19ea8ad8a82b4)
10. **Velocity Breach Breaker Trip**: [`0x5618ca6c…dd58`](https://scan.bohr.life/tx/0x5618ca6cf72bf1c95bd13919f60d4d7091af1a937854fac02dcdcae07cb9dd58) (Block `#19881065`) — *Autonomously tripped breaker on-chain! Status became TRIPPED.*
11. **Reset Final**: [`0x98c429a2…b46a`](https://scan.bohr.life/tx/0x98c429a2d61e5eb131e3beb96ad822a9185fa032bd0b6a033e9a27861291b46a)

---

## Client-Side AI 6-Signal Anomaly Scorer (Roadmap Item)

- **6-Signal Anomaly Scoring** (calldata entropy, spend deviation, destination familiarity, velocity spikes, repetition scoring, composite risk) computes client-side / SDK to provide real-time risk scores from 0 to 1000.
- Evaluated verdicts are logged to `FirewallXAuditor` on-chain for transparent auditing.
- Future roadmap includes cryptographic ZK-SNARK / TEE oracle verification for zero-knowledge on-chain anomaly proofs.

---

## How to Reproduce

```bash
# 1. Run Unit Tests (Local Hardhat Network)
npm run test:contracts

# 2. Deploy to BOT Chain Testnet
npm run deploy:testnet

# 3. Verify On-Chain Bytecode
node scripts/verify-bytecode.mjs

# 4. Run On-Chain Autonomous Breaker Proof
node ./node_modules/hardhat/internal/cli/cli.js run scripts/prove-onchain-autonomous-breaker.ts --network botchainTestnet
```