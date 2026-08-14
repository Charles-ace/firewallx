# FirewallX

AI Agent Action Firewall for BOT Chain — a smart-contract sentinel suite plus an in-browser policy
engine that evaluates agent transactions before they execute.

> **Honesty note.** This project deliberately separates **on-chain enforcement** from
> **in-browser simulation**. Read the "What is enforced" section before judging capabilities —
> the marketing copy and this file use the same vocabulary.

---

## What is enforced on-chain (deployed & verified on testnet)

The deployed smart-contract suite gates *actual* agent transactions. The Guard rejects a call
(and `executeGuarded` reverts `ExecutionBlocked(reason)`) when **any** of these fail:

| Check | Enforced? | Where |
|-------|-----------|-------|
| Agent is registered | ✅ | Registry `isActionPermitted` |
| Circuit breaker status (TRIPPED / PAUSED) | ✅ | Registry `isActionPermitted` |
| Destination blocklist | ✅ | Registry `isActionPermitted` |
| Destination allowlist (when `enforceAllowlist`) | ✅ | Registry `isActionPermitted` |
| Per-tx spend cap (`maxSpendPerTx`) | ✅ | Registry `isActionPermitted` |
| Velocity / rate limit (`maxTxPerMinute`, rolling 60s) | ✅ | Registry rolling ring buffer |
| Identical-payload loop limit (`maxIdenticalPayloads`, `loopWindowSeconds`) | ✅ | Registry repetition window |

`isActionPermitted(agentWallet, target, value, calldataHash)` (source of truth:
`contracts/FirewallXRegistry.sol`) is **stateful**: it records velocity + repetition entries for
permitted calls (denied attempts revert the whole tx, so nothing is recorded). The Guard computes
`calldataHash = keccak256(abi.encodePacked(target, value, data))`. A `view` mirror
`isActionPermittedView` exists for off-chain pre-flights.

Proof of the enforcement arc (agent `0xf39F…9226`, policy cap 1 tBOT/tx, 3 tx/min, max 2 identical
payloads per 60s):

- `GuardedExecution` (success=true): `0x8f76b333…d924`, `0x679ba4a4…c2f`, `0x1730a4dc…a643`, recovery `0xba8d2882…f9f`
- `ExecutionBlocked("Repetitive loop detected")` (mined, status 0): `0xc68e12fa…a653` — raw revert `0x5f1a2fdb…"Repetitive loop detected"`
- `ExecutionBlocked("Spend cap exceeded")` (mined, status 0): `0x7cb4208c…ebae5`
- `ExecutionBlocked("Rate limit exceeded")` (mined, status 0): `0x59966987…e9fe` — raw revert `0x5f1a2fdb…"Rate limit exceeded"`
- `ExecutionBlocked("Circuit Breaker TRIPPED")` (mined, status 0): `0xbf62f497…e6aa8` — raw revert `0x5f1a2fdb…"Circuit Breaker TRIPPED"`
- Trip `0x8db9afcc…79c1e` → reset `0xe49d5ec0…821` (status ACTIVE↔TRIPPED via `AgentStatusChanged`, `totalTrips=1`)
- `ActionEvaluated` BLOCK records: `0x32d37fce…21f` (900/spend-cap), `0xb473c283…9edc` (950/circuit-breaker)
- Verify with `npx hardhat run scripts/verify-onchain-events.ts --network botchainTestnet` (33 rows)

### Deployed addresses (BOT Chain testnet, chainId 968)

| Contract | Address | Deploy tx |
|----------|---------|-----------|
| `FirewallXRegistry` (v2, rolling-window) | `0x8e55ac0a66E9E34376dcCb7D693FeBfF239C3145` | `0xdcd869d1…d113` |
| `FirewallXAuditor` (v2, repointed) | `0x87432661f99EcbD0f1510Eda4a0AfAF5540C93bB` | `0xd2395b44…d39a` |
| `FirewallXGuard` (v2, passes calldata hash) | `0x2985B6e0dE7F34c503a52F217927d23bb129aa67` | `0x53be207c…b2c23` |
| `TestTargetContract` (unchanged, reused) | `0xc93932A69E2A9868AAAEC4CAaafB9B9DB508a555` | — |

Deploy inputs verified byte-exact against artifacts (`scripts/redeploy-v2.ts` prints `VERIFY … true`).

## What is simulated in-browser (NOT enforced by the contract)

Computed by the local engine (`src/engine/*`) and rendered in the sandbox / telemetry UI. The
deployed Guard does **not** block on these:

- **AI 6-signal anomaly scoring** (`anomalyThreshold`; repetition, velocity burst, spend deviation,
  calldata entropy, destination familiarity, composite risk) — a probabilistic heuristic, not a
  deterministic rule, so it stays in-browser and is recorded as an `ActionEvaluated` verdict.
- **Sandbox circuit-breaker trip on sustained in-browser violations** — in-memory only; the
  on-chain breaker trips via `tripCircuitBreaker` (sentinel/owner) and only the owner resets it.

## What is logged (on-chain evidence) but not blocking

`FirewallXAuditor.recordEvaluation` emits `ActionEvaluated` (agent, actionHash, target, value,
verdict `ALLOW/BLOCK/FLAG`, anomalyScore, ruleTriggered, reasoning). These are append-only records —
they make verdicts verifiable on-chain but do **not** stop the transaction (the Guard does, for the
enforced checks above).

---

## Architecture

```
AI agent ──> FirewallXSDK / Guard.executeGuarded(target, value, data)
                  │
                  ▼
        Registry.isActionPermitted(agent, target, value,
                                   keccak256(target,value,data))   ── enforced on-chain
                  │  (registration, breaker, blocklist, allowlist, spend cap,
                  │   velocity ring buffer, identical-payload window)
                  ▼  pass?
        target.call{value}(data)  ── emits GuardedExecution
                  │
        Auditor.recordEvaluation(…)  ── emits ActionEvaluated (verdict record)

        In-browser engine (src/engine): 6-signal AI scoring, sandbox breaker
          ── drives the sandbox / telemetry / policy UI; verdicts are logged, not contract-enforced.
```

## Reproduce the on-chain proof

```bash
npm run compile:contracts
npm run test:contracts           # 11 hardhat tests (incl. velocity + loop enforcement)
npx hardhat run scripts/redeploy-v2.ts --network botchainTestnet      # deploys Registry+Auditor+Guard, verifies bytecode
npx hardhat run scripts/prove-guard.ts --network botchainTestnet      # full breaker cycle + velocity/loop/spend blocks
npx hardhat run scripts/capture-revert-data.ts --network botchainTestnet  # byte-exact revert data for each denial
npx hardhat run scripts/verify-onchain-events.ts --network botchainTestnet
```

Requires `.env` with `PRIVATE_KEY` (deployer/sentinel). See `.env.example`.

## Frontend

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
```

Stack: React 18 + TypeScript + Vite + Tailwind. Hardhat + Solidity 0.8.24 + ethers v6.

---

## Roadmap (honest)

1. ~~On-chain velocity + identical-payload enforcement~~ **done 2026-08-14.** Registry rolling
   windows, Guard calldata fingerprint, redeployed + byte-verified + proven on testnet (evidence
   above). The 6-signal AI scorer remains in-browser by design (heuristic, not a deterministic rule).
2. **GitHub submission prep.** Commit, add remote, grant judge access — done (private repo,
   `main`; judge access granted by repo owner).
3. **Public demo deploy.** Vercel build (`npm run build`, output `dist/`) — live.

## Award eligibility checklist status

| Item | Status |
|------|--------|
| Public demo link live & stable | ✅ deployed: `https://firewall-x.vercel.app` |
| Wallet connection end-to-end | ✅ verified live (real account + chain switch to 968 + RPC balance via rpc.bohr.life) |
| Repo accessible to judges | ✅ private repo on GitHub (`main`); collaborators added by owner |
| On-chain contracts live on testnet | ✅ v2 suite deployed, byte-verified, proof reproduced |

---

© 2026 FirewallX — AI Agent Action Firewall for BOT Chain. BOT Chain Testnet · EVM Compatible.