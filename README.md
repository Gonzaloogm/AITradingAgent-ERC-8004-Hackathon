# STRIKER ⚡ Delta-Neutral Trading Agent  
*(Submission for the Lablab.ai ERC-8004 AI Trading Agents Hackathon)*

![Project Cover Placeholder - Please replace Logo1.jpg/Logo2.jpg or upload cover image here](./Logo1.jpg)

**Demo URL:** [Insert specific Demo URL here or mention it runs locally]  
**Pitch Deck:** [Link to your Pitch Deck PDF]  
**Video Presentation:** [Link to Loom / YouTube]  

---

## 📖 Short Description
STRIKER is an institutional-grade, autonomous Delta-Neutral Trading Agent that operates securely from within an Intel TDX Secure Enclave. It analyzes cross-exchange market inefficiencies and executes profitable *cash-and-carry* arbitrage loops using the ERC-8004 on-chain registry standards.

## 🚀 Long Description
In the fast-paced crypto markets, executing arbitrage requires strict latency controls, secure execution environments, and provable trust. STRIKER addresses these challenges by merging AI-driven market analysis with cryptographic security. 

STRIKER evaluates the spread between spot and perpetual mechanisms dynamically, utilizing an LLM (Gemini 1.5 Flash) to establish a risk-adjusted spread threshold. It strictly executes Delta-Neutral (cash-and-carry) strategies to capture funding rates and market premiums, effectively mitigating directional exposure.

To ensure compliance with the **ERC-8004 track**, STRIKER fundamentally operates on a workflow of trust:
1. **Identity Registration:** Registers via the `IdentityRegistry` on Base Sepolia.
2. **Capital Handling:** Retrieves mock/sandbox capital through the initial provisioning endpoints.
3. **Execution via RiskRouter:** Crafts and digitally signs an EIP-712 `TradeIntent` directly from its TEE-secured private key, routing it strictly through the RiskRouter.
4. **Reputation Update:** Sends an immutable `giveFeedback` transaction recording the trade’s exact P&L (yield metrics relative to max drawn down) back into the On-Chain reputation vector.

All of this happens inside a verifiable Intel TDX (via dstack) enclave, meaning STRIKER's code execution, prompts, and private keys can never be intercepted or altered, creating a truly trustless verifiable execution path.

## 🛠️ Tags & Technologies
- **Track:** ERC-8004
- **Categories:** AI Trading, TEE, Delta-Neutral
- **Tech Stack:** Python 3, FastAPI, Intel TDX (dstack), Web3.py, The Graph, Phala Cloud, Anthropic/Gemini LLMs.

---

## ⚙️ Architecture & ERC-8004 Integration

```text
┌─────────────────────────────────────────────────────────────────┐
│                    PRESENTATION / DASHBOARD                     │
│  Funding Page │ Dashboard │ Chat Interface │ Trust Center       │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AGENT LAYER (STRIKER)                       │
│  BaseAgent │ ChatAgent │ ServerAgent │ DeltaNeutralEngine       │
└─────────────────────────────────────────────────────────────────┘
                               │ Action: 1. Register 2. Strategy 3. Execute 4. Feedback
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ERC-8004 COMPLIANCE LAYER                     │
│  Registry Client │ EIP-712 Signer │ Validation Artifacts         │
└─────────────────────────────────────────────────────────────────┘
```

1. **Agent Registration:** Agents mint an ERC-721 token representing their identity via the `IdentityRegistry`.
2. **TEE Attestation:** Secure keys derived at runtime via Intel TDX. Hardware quote confirms environment integrity.
3. **Execution (EIP-712):** Agent crafts a `TradeIntent` detailing Market, Amount, Action, MaxSlippage, and Deadline, and signs it.
4. **Validation Artifact:** STRIKER hashes the proof into a JSON artifact.
5. **Reputation (Feedback):** Posts immutable fixed-point arithmetic scores matching realized PnL back into the `ReputationRegistry`.

---

## 💻 Local Testing & Setup

Follow these steps to run STRIKER locally. You will be able to access the internal dashboard, provide sandbox capital, and witness the EIP-712 ERC-8004 transaction loop.

### 1. Prerequisites
- Python 3.12+ 
- A Web3 RPC (e.g. Alchemy or Infura for Base Sepolia)
- Basic environment API keys (LLMs, Subgraphs)

### 2. Installation
```bash
git clone https://github.com/YOUR_USERNAME/AITradingAgent-ERC-8004-Hackathon.git
cd AITradingAgent-ERC-8004-Hackathon
cp .env.example .env

# Edit .env with your specific API Keys
```

### 3. Execution
```bash
pip3 install -e .
python3 deployment/local_agent_server.py
```

### 4. How to use the Demo
1. Navigate to `http://localhost:8000` via your browser.
2. Complete the **Funding** simulation to load the agent's wallet with ETH.
3. Observe the **Dashboard** as the agent connects to the ERC-8004 IdentityRegistry.
4. Open the server logs. STRIKER will begin reading the mock Kraken/Prism feeds, evaluating `Spot` vs `Perp`.
5. Once the dynamic threshold is cleared by the LLM, the `TradeIntent` is signed via EIP-712, creating the ERC-8004 validation artifact and pinging the RiskRouter.

## 📜 Full Documentation
For a deep dive into the inner workings, components, and the mathematical mechanics of our Delta-Neutral strategy, check out our [DOCUMENTACION_COMPLETA.md](./docs/DOCUMENTACION_COMPLETA.md).

## 📄 License
MIT License.
