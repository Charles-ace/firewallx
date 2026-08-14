import React, { useState } from 'react';
import { X, Copy, Check, Code2, ExternalLink } from 'lucide-react';
import { BOTCHAIN_TESTNET } from '../config/botchain';

interface SDKModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SDKModal: React.FC<SDKModalProps> = ({ isOpen, onClose }) => {
  const [activeLang, setActiveLang] = useState<'ts' | 'py'>('ts');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const tsCode = `import { FirewallXSDK } from '@firewallx/sdk';

// 1. Initialize FirewallX with your Agent identity & BOT Chain RPC
const firewall = new FirewallXSDK({
  agentId: 'agent-sixa-telegram',
  agentWallet: '0x71C8366420A092671827649D3863464509520770',
  rpcUrl: '${BOTCHAIN_TESTNET.rpcUrl}',
});

// 2. Pre-execution Action Check
const verdict = await firewall.evaluateAction({
  target: '0x8ba1f109551bd432803012645ac136ddd64dba72',
  value: '0.05', // in tBOT
  data: '0x6080604052...',
});

// 3. Autonomous Decision Handling
if (verdict.verdict === 'ALLOW') {
  // Safe to execute on-chain
  const tx = await signer.sendTransaction({ to: verdict.target, value: parseEther(verdict.value) });
  console.log('Action executed safely:', tx.hash);
} else {
  console.error(\`FirewallX Intercepted [BLOCKED]: \${verdict.reasoning}\`);
  // If circuit tripped, agent automatically steps down
}`;

  const pyCode = `from firewallx import FirewallXSDK

# 1. Initialize FirewallX Agent Guardian
firewall = FirewallXSDK(
    agent_id="agent-sixa-telegram",
    agent_wallet="0x71C8366420A092671827649D3863464509520770",
    rpc_url="${BOTCHAIN_TESTNET.rpcUrl}",
    chain_id=968
)

# 2. Pre-execution Firewall Verification
verdict = firewall.evaluate_action(
    target="0x8ba1f109551bd432803012645ac136ddd64dba72",
    value="0.05",
    data="0x6080604052..."
)

# 3. Guarded Execution Loop
if verdict.decision == "ALLOW":
    tx_hash = web3.eth.send_raw_transaction(signed_tx.rawTransaction)
else:
    print(f"[BLOCKED] FirewallX triggered: {verdict.reasoning}")`;

  const codeToCopy = activeLang === 'ts' ? tsCode : pyCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl card p-6 relative space-y-4 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">FirewallX Agent Drop-In SDK</h3>
        </div>

<p className="text-xs text-slate-500">
  Add 3 lines to any AI agent (LangChain, CrewAI, AutoGPT, or custom bots) to score actions with 6-signal anomaly telemetry and route through the Sentinel Guard. Spend caps, velocity rate limits, loop repetition detection, allow/block lists, and autonomous circuit breaker tripping are enforced directly on-chain on BOT Chain.
</p>

        {/* Language Tabs & Copy Button */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <div className="flex p-1 bg-slate-100/80 rounded-full">
            <button
              onClick={() => setActiveLang('ts')}
              className={`px-4 py-1.5 text-xs font-mono rounded-full transition-all duration-200 ${
                activeLang === 'ts'
                  ? 'bg-white text-slate-900 font-bold shadow-[0_1px_3px_rgba(15,23,42,0.12)]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              TypeScript / Node.js
            </button>
            <button
              onClick={() => setActiveLang('py')}
              className={`px-4 py-1.5 text-xs font-mono rounded-full transition-all duration-200 ${
                activeLang === 'py'
                  ? 'bg-white text-slate-900 font-bold shadow-[0_1px_3px_rgba(15,23,42,0.12)]'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Python SDK
            </button>
          </div>

          <button onClick={handleCopy} className="btn-secondary !px-4 !py-1.5">
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Code Snippet Box (dark panel) */}
        <div className="bg-[#0a0a0f] rounded-xl p-4 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-96 shadow-[0_20px_50px_-24px_rgba(10,10,15,0.6)]">
          <pre>{codeToCopy}</pre>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-200">
          <span>Targets BOT Chain Testnet & Mainnet</span>
          <a
            href="https://dev-docs.botchain.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-blue-600 hover:underline font-mono text-[11px]"
          >
            BOT Chain Dev Docs
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
      </div>
    </div>
  );
};