/**
 * Live Dashboard Logic for UI Simulation
 * Generates events and pulses data to simulate the Agent processing
 */

const terminalLogs = document.getElementById('terminal-logs');
const prismLatency = document.getElementById('prism-latency');
const kpiPnl = document.getElementById('kpi-pnl');
const kpiX402 = document.getElementById('kpi-x402');

// Mock Logs array combining the diverse elements of the Hackathon
const logTemplates = [
    { sys: '[PRISM-API]', type: 'prism', msgs: ['Resolved intent asset "WBTC" to canonical -> [BITCOIN:0x...]', 'Fetching L2 liquidity depth for cbBTC/USD', 'Symbol collision avoided (97% Confidence).'] },
    { sys: '[KRAKEN-MCP]', type: 'kraken', msgs: ['Evaluating Delta-neutral spread (Spot vs Perp)', 'Circuit Breaker Check: Volatility 1.2% (SAFE)', 'Submitting trade intent... Execution 32ms.', 'Error HTTP 429: Rate Limit. Utilizing MCP Error Envelope fallback.'] },
    { sys: '[TDX-ENV]', type: 'tee', msgs: ['Generating Intel TDX Quote for state validation...', 'Attestation signed with derived EIP-1271 key.', 'SHA-256 Hash matches RedPill inference manifest.'] },
    { sys: '[X402-NET]', type: 'x402', msgs: ['Intercepted 402 PAYMENT-REQUIRED from external Oracle.', 'Cost evaluating... 0.05 USDC is within threshold.', 'Signing payload and dispensing micropayment via Base L2.', 'Access Granted. Data synchronized.'] },
    { sys: '[ERC-8004]', type: 'tee', msgs: ['Pushing Reputation Feedback to Identity Registry.', 'Validation artifact uploaded to Sandbox.', 'Smart Contract Event emitted: TradeVerified()'] }
];

let basePnl = 1452.80;
let baseX402 = 284;

function formatTime() {
    const now = new Date();
    return now.toISOString().split('T')[1].slice(0, -1); 
}

function addLog() {
    // Choose random template
    const template = logTemplates[Math.floor(Math.random() * logTemplates.length)];
    const msg = template.msgs[Math.floor(Math.random() * template.msgs.length)];
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${template.type}`;
    
    entry.innerHTML = `
        <span class="log-time">${formatTime()}</span>
        <span class="log-sys">${template.sys}</span>
        <span class="log-msg">${msg}</span>
    `;
    
    terminalLogs.appendChild(entry);
    
    // Auto scroll and keep max 12 logs
    if (terminalLogs.children.length > 12) {
        terminalLogs.removeChild(terminalLogs.firstChild);
    }
    
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
}

function pulseMetrics() {
    // Randomly change Prism Latency
    prismLatency.innerText = Math.floor(Math.random() * 15 + 15) + 'ms';
    
    // Simulate tiny PnL changes
    if (Math.random() > 0.5) {
        basePnl += (Math.random() * 2 - 0.5); // Slight upward bias
        kpiPnl.innerText = '+$' + basePnl.toFixed(2);
        
        // Sometimes get X402 revenue
        if (Math.random() > 0.8) {
            baseX402 += 0.05;
            kpiX402.innerText = baseX402.toFixed(2) + ' USDC';
        }
    }
}

// Start Loops
setInterval(addLog, 1200);   // New log every 1.2 seconds
setInterval(pulseMetrics, 3000); // Pulse metrics every 3 seconds

// Initialize dashboard with a few logs
for(let i=0; i<6; i++) {
    setTimeout(addLog, i * 200);
}
