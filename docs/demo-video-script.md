# FirewallX — Screen-Recorded Demo Video Script (3–5 min)

**Target:** 3:45–4:30 total. Screen 1440×900 or 1920×1080, browser at 100% zoom.
**Record in one take with natural narration; retake only if a step visually fails.**
**Pre-check before recording:** fresh browser (no extensions), visit `https://firewall-x.vercel.app`, wait 2s. Have the testnet explorer (`scan.bohr.life`) and mainnet explorer (`scan.botchain.ai`) open in the background.

---

## Beat 1 — Opening + honest framing (0:00–0:25, ~25s)

- Screen: landing page, hero headline visible. Hold still 3s.
- **Narration:** "This is FirewallX — an action firewall for AI agents on BOT Chain. One thing to keep in mind as you watch: everything that matters here — rate limits, loop detection, the circuit breaker — is enforced on-chain by deployed smart contracts. What runs in this browser is the control room: the dashboard that watches the chain, scores actions, and shows you the receipts. The enforcement happens on the chain, not in the page."
- Mouse: slow scroll down the hero once (architecture strip), then back up to the navbar.

## Beat 2 — Wallet connect (0:25–0:45, ~20s)

- Click **Connect Wallet** (top right). Modal opens — hold 2s (options visible: MetaMask/Rabby + Demo Sentinel Wallet).
- Click **Demo Sentinel Wallet**. Wait 2s until the `0x9965…A4df` pill + balance appear in the navbar.
- **Narration:** "Connecting the demo sentinel wallet — the same flow works with a real MetaMask or Rabby wallet on BOT Chain testnet."
- **Zoom** on the navbar pill (2s).

## Beat 3 — Sandbox intro + Normal Payment (0:45–1:20, ~35s)

- Click **Attack Sandbox** tab.
- **Pause 2s** on the mode toggle: confirm *"BOT Chain Testnet (On-Chain)"* is the highlighted default, and the policy strip (Spend/Tx 1.0, Rate Limit 3 tx/min, Loop Trip 2 calls/60s).
- **Narration:** "This toggle is on BOT Chain testnet — live on-chain — by default. The policy is simple: three transactions per minute, two identical payloads per minute, one tBOT per transaction."
- Click **1. Normal Payment**. Wait ~5s for the terminal line: `✅ ON-CHAIN ALLOWED … Tx: 0x…`.
- **Zoom + 3s hold** on the tx hash in the terminal.
- **Narration:** "A normal payment goes through the guard, allowed on-chain. That hash is a real transaction — verifiable in the explorer."

## Beat 4 — Runaway Loop Attack + trip (1:20–2:15, ~55s) ⭐ evidence beat

- Click **2. Runaway Loop Attack**. Watch the terminal live.
- **Narration (as it runs):** "Now the same payload fired three times in a row — a webhook retry gone wild. Transaction one… allowed. Transaction two… still inside the limit. Transaction three… the registry's rolling loop window catches it, and the contract trips the breaker itself — no dashboard involved."
- When `⚡⚡⚡ ON-CHAIN CIRCUIT BREAKER TRIPPED!` appears: **pause 4s, zoom on the line** + the `⚡ CIRCUIT TRIPPED` status chip pulsing in the policy strip.
- **Optional +10s beat (strongest evidence):** open `scan.bohr.life`, paste the trip tx hash, show `Status: Success` + the `CircuitBreakerTripped` event. Zoom on the event. *("You can see it on the chain — the contract state changed, not a UI flag.")*
- **Narration:** "That's the on-chain breaker: status moved to TRIPPED inside the contract. Nothing in the browser tripped it."

## Beat 5 — Reset (2:15–2:30, ~15s)

- Click **Reset Agent Breaker**. Wait ~4s.
- **Pause 2s** on the terminal line (`Circuit Breaker RESET on-chain`) + chip back to `STATUS: ACTIVE`.
- **Narration:** "Reset is also a contract call — status restored to ACTIVE on-chain."

## Beat 6 — Velocity Burst Flood + trip (2:30–3:25, ~55s) ⭐ evidence beat

- Click **6. Velocity Burst Flood**. Watch 4 rapid txs.
- **Narration:** "This one is velocity: four distinct transactions in under a minute against a limit of three. The registry's rolling timestamp buffer counts them, and on the fourth… the breaker trips again, autonomously."
- When `ON-CHAIN VELOCITY BREACH` appears: **pause 4s, zoom** on the line + chip.
- **Optional +10s:** explorer check of the trip tx, zoom on `CircuitBreakerTripped` / `GuardedExecutionBlocked` event.
- Click **Reset Agent Breaker** again; wait 4s; brief zoom on `ACTIVE`.

## Beat 7 — Live Telemetry + Audit Log (3:25–3:55, ~30s)

- Click **Live Telemetry** tab. Click **Refresh** in the *On-Chain Sentinel Events* panel.
- **Pause 3s** on the feed: fresh `GuardedExecution` / `CircuitBreakerTripped` rows with truncated tx hashes linking to `scan.bohr.life`.
- **Narration:** "Every event you just triggered is here, indexed directly from the chain — Guard, Registry, Auditor — each with its explorer link."
- Click **Audit Log** tab. **Pause 3s** on the verdict table (ALLOW / BLOCK / TRIP entries).
- **Narration:** "And the audit log keeps the verdicts — allowed, blocked, tripped — including the two autonomous trips you just caused."

## Beat 8 — Mainnet deployment + close (3:55–4:30, ~35s)

- **Narration (over landing page or a quick README/explorer cut):** "The same verified contracts are also live on BOT Chain mainnet — Registry, Auditor, Guard, and test target — deployed with the mainnet gas grant. The interactive demo stays on testnet so it's free and safe to play with; mainnet is the production proof. FirewallX: enforcement on-chain, visibility in-browser."
- Show if quick: `scan.botchain.ai` address page for the Guard (`0x03c368fE…Ab0e`) — 3s hold, no narration needed.
- End card: project name + `firewall-x.vercel.app`.

---

## Timing summary

| Beat | Time | Cumulative |
|---|---|---|
| 1. Opening + framing | 0:25 | 0:25 |
| 2. Wallet connect | 0:20 | 0:45 |
| 3. Normal payment | 0:35 | 1:20 |
| 4. Loop attack + trip | 0:55 | 2:15 |
| 5. Reset | 0:15 | 2:30 |
| 6. Velocity burst + trip | 0:55 | 3:25 |
| 7. Telemetry + audit | 0:30 | 3:55 |
| 8. Mainnet + close | 0:35 | 4:30 |

## Pause/zoom beats (strongest evidence)

1. **1:35 — normal-payment tx hash** in terminal (2–3s).
2. **~2:00 — loop-trip terminal line + TRIPPED chip (4s)** — the key evidence beat.
3. **~2:05 — optional explorer receipt for the trip tx (10s)** — strongest possible proof.
4. **~3:00 — velocity-breach terminal line (4s)** + optional explorer check.
5. **~3:35 — telemetry feed rows** showing the same hashes the terminal logged.

## Honest framing line (Beat 1, say naturally, once)

> "What you'll see in the browser is the control room — the dashboard that watches the chain and shows the receipts. The enforcement — rate limits, loop detection, the breaker trip — happens inside the deployed contracts. The page never fakes a verdict."

## Pitfalls to avoid while recording

- Don't leave the sandbox before the trip line lands (block time ~1–2s per tx; wait for the terminal).
- Don't click **Local Sandbox** — the whole demo is the on-chain toggle.
- If the telemetry feed is empty on arrival, click **Refresh** and wait one poll cycle (~20s).
- Keep the wallet pill visible (it proves live connection) — avoid covering the navbar with the cursor.