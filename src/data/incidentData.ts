export interface IncidentDataPoint {
  time: string;
  operationsWithoutFirewall: number;
  operationsWithFirewallX: number;
  incidentStatus: string;
  verdict: 'ALLOW' | 'BLOCK' | 'TRIPPED' | 'NORMAL' | 'FLAG';
  notes: string;
}

export const SIXA_INCIDENT_TIMELINE: IncidentDataPoint[] = [
  {
    time: '14:00',
    operationsWithoutFirewall: 12,
    operationsWithFirewallX: 12,
    incidentStatus: 'Normal Background Polling',
    verdict: 'NORMAL',
    notes: 'Agent running scheduled healthchecks.',
  },
  {
    time: '14:30',
    operationsWithoutFirewall: 18,
    operationsWithFirewallX: 18,
    incidentStatus: 'Webhook Retries Start',
    verdict: 'NORMAL',
    notes: 'Upstream webhook received HTTP 500 error, triggered 1st retry.',
  },
  {
    time: '14:35',
    operationsWithoutFirewall: 95,
    operationsWithFirewallX: 24,
    incidentStatus: 'Retry Loop Multiplies',
    verdict: 'FLAG',
    notes: 'Without Firewall: Recursive webhook spawn. With FirewallX: Anomaly score jumps to 580/1000 (FLAG).',
  },
  {
    time: '14:37',
    operationsWithoutFirewall: 380,
    operationsWithFirewallX: 26,
    incidentStatus: 'Tripwire Interception (Tx #4)',
    verdict: 'TRIPPED',
    notes: 'FirewallX detects 4th identical calldata payload in 60s sliding window. Autonomous Circuit Breaker trips! Agent wallet state changed to TRIPPED.',
  },
  {
    time: '15:00',
    operationsWithoutFirewall: 1240,
    operationsWithFirewallX: 26,
    incidentStatus: 'Autonomous Protection Active',
    verdict: 'BLOCK',
    notes: 'Without Firewall: KV queries flood unchecked. With FirewallX: All subsequent 1,214 runaway calls blocked instantly at zero gas cost.',
  },
  {
    time: '16:00',
    operationsWithoutFirewall: 2850,
    operationsWithFirewallX: 26,
    incidentStatus: 'Human Investigation (Unprotected)',
    verdict: 'BLOCK',
    notes: 'Without Firewall: Engineer notices latency, begins pulling logs manually. With FirewallX: Incident already contained 1.5h ago.',
  },
  {
    time: '17:30',
    operationsWithoutFirewall: 4120,
    operationsWithFirewallX: 26,
    incidentStatus: 'Manual Killswitch Finally Triggered',
    verdict: 'BLOCK',
    notes: 'Without Firewall: Human finds webhook URL and kills it after 4,120 runaway ops and billing damage. With FirewallX: Zero collateral damage.',
  },
];

export const INCIDENT_SUMMARY = {
  incidentDate: 'August 12, 2026',
  project: 'sixa-telegram (KV Worker & Autonomous Relay)',
  rootCause: 'Unbounded retry-loop on unhandled upstream webhook timeout, spawning recursive KV writes',
  unprotectedImpact: {
    totalOps: 4120,
    timeToMitigation: '3 hours 30 mins (human response time)',
    costWaste: 'Significant Vercel KV read/write quota burst',
    verdict: 'Post-mortem manual log diagnosis',
  },
  firewallXImpact: {
    totalOps: 26,
    timeToMitigation: '< 120 milliseconds (autonomous loop trip at transaction #4)',
    costWaste: '$0.00 (Prevented 4,094 unauthorized transactions)',
    verdict: 'Auto-Tripped Circuit Breaker + Public Audit Log on BOT Chain',
  },
};
