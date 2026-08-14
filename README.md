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

`isActionPermitted` (source of truth: `contracts/FirewallXRegistry.sol`) is a `view` — it does not
track state. It evaluates only: registration, breaker status, blocklist, allowlist, spend cap.

### Deployed addresses (BOT Chain testnet, chainId 968)

| Contract | Address |
|----------|---------|
| `FirewallXRegistry` | `0x271b7549524fa569317f8abaa0EB4504C280F4AD` |
| `FirewallXAuditor` | `0x0E969975A150AC0Fc8874dd6f68c0fE5c0b7EbAa` |
| `FirewallXGuard` | `0x84d6d903045D686550D4B2bA01003aDF5917f114` |
| `TestTargetContract` | `0xc93932A69E2A9868AAAEC4CAaafB9B9DB508a555` |

Verified live: guarded executions (`GuardedExecution`), spend-cap blocks, circuit-breaker trips,
resets, and `ActionEvaluated` verdicts are all recorded as indexed events on-chain and rendered by
the app's on-chain event indexer.

## What is simulated in-browser (NOT enforced by the contract)

These are computed by the local engine (`src/engine/*`) and produce verdicts + `ActionEvaluated`
records, but the deployed Guard does **not** block on them:

- **Velocity / rate limit** (`maxTxPerMinute`) — rolling throughput, in-browser only.
- **Loop detection / identical-payload repetition** (`maxIdenticalPayloads`, `loopWindowSeconds`) —
  in-browser only.
- **AI 6-signal anomaly scoring** (`anomalyThreshold`, repetition/velocity/spend/entropy/destination
  risk) — in-browser only.
- **Autonomous breaker trip on sustained violations** — the sandbox trips an in-memory breaker;
  on-chain, a trip is a manual/sentinel call to `tripCircuitBreaker`.

Why: `isActionPermitted` does not receive calldata and does not maintain per-agent rolling state.
An on-chain velocity + identical-payload window is implementable (see Roadmap) but was not built
before this snapshot.

## What is logged (on-chain evidence) but not blocking

`FirewallXAuditor.recordEvaluation` emits `ActionEvaluated` (agent, actionHash, target, value,
verdict `ALLOW/BLOCK/FLAG`, anomalyScore, ruleTriggered, reasoning). These are append-only records —
they make verdicts verifiable on-chain but do **not** stop the transaction (the Guard does, and only
for the enforced checks above).

---

## Architecture

```
AI agent ──> FirewallXSDK / Guard.executeGuarded(target, value, data)
                  │
                  ▼
        Registry.isActionPermitted(agent, target, value)   ── enforced on-chain
                  │  (registration, breaker, blocklist, allowlist, spend cap)
                  ▼  pass?
        target.call{value}(data)  ── emits GuardedExecution
                  │
        Auditor.recordEvaluation(…)  ── emits ActionEvaluated (verdict record)

        In-browser engine (src/engine): velocity, loop, 6-signal scoring, breaker trip
          ── drives the sandbox / telemetry / policy UI; NOT contract-enforced.
```

## Reproduce the on-chain proof

```bash
npm run compile:contracts
npm run test:contracts           # 6 hardhat tests
npx hardhat run scripts/deploy.ts --network botchainTestnet
npx hardhat run scripts/prove-guard.ts --network botchainTestnet   # full breaker cycle
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

1. **On-chain velocity + identical-payload enforcement (est. 12–18 focused hours).** Add per-agent
   rolling-window state to the Registry, pass a `keccak256(target, value, data)` fingerprint from the
   Guard, enforce `maxTxPerMinute` and `maxIdenticalPayloads` inside `isActionPermitted`, redeploy +
   re-verify. The 6-signal AI scorer is *not* practical to replicate on-chain at comparable effort.
2. **GitHub submission prep.** Commit, add remote, grant judge access.
3. **Public demo deploy.** Vercel/Netlify (build = `npm run build`, output = `dist/`).

## Award eligibility checklist status

| Item | Status |
|------|--------|
| Public demo link live & stable | ❌ not deployed (runs locally) |
| Wallet connection end-to-end | ✅ implemented (MetaMask/Rabby inject, chain switch, RPC balance); pending live verification |
| Repo accessible to judges | ❌ no commits / no remote yet |
| On-chain contracts live on testnet | ✅ deployed + verified |

---

© 2026 FirewallX — AI Agent Action Firewall for BOT Chain. BOT Chain Testnet · EVM Compatible.