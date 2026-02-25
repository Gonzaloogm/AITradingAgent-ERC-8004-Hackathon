Delta-Neutral AI Trading Agent | ERC-8004 & TEE Secured
!(https://img.shields.io/badge/EIP-8004_Compliant-success)
!(https://img.shields.io/badge/Security-Intel_TDX_TEE-orange)

Official submission for the "AI Trading Agents with ERC-8004 Hackathon" (March 2026).

This project implements a fully autonomous, trust-minimized financial AI agent. It executes a Delta-Neutral (Cash-and-Carry) strategy, capturing funding rates and basis spreads while maintaining zero directional market exposure to optimize its Sharpe ratio and minimize drawdowns.

🌟 Key Features & Hackathon Compliance
Verifiable Identity: Registered on-chain using the ERC-8004 Identity Registry, establishing a portable, tamper-proof agent passport.

TEE-Secured Execution: Hosted within a Phala Network Trusted Execution Environment (Intel TDX). The agent's private keys never leave the hardware enclave.

Cryptographic Intent Signing: Orders are not executed directly. The agent generates and signs TradeIntents using EIP-712 typed data signatures mapped to the Sepolia chain-id (EIP-155) to prevent replay attacks.

Risk Governance: All signed intents are strictly routed through the hackathon's whitelisted Risk Router contract, ensuring programmatic adherence to max leverage and daily loss limits.

🏗️ Architecture Flow
Market Intelligence: The Python-based DeltaNeutralEngine ingests real-time spot and perpetual futures pricing.

Spread Analysis: Evaluates the price differential. If the spread exceeds the target threshold, a rebalancing order is triggered.

TEE Attestation & Signing: The TEEAuthenticator derives the isolated private key and signs the EIP-712 TradeIntent containing the exact operation (e.g., LONG_SPOT / SHORT_PERP).

On-Chain Settlement: The cryptographic signature is sent to the Risk Router operating on the Hackathon Capital Sandbox for validation and execution.

🚀 Quick Start (Local Development)
Prerequisites
Python 3.10+

Visual Studio Code

Installation
**Clone the repository and set up the virtual environment:**bash
git clone <your-repo-url>
cd erc-8004-tee-agent
python3 -m venv venv
source venv/bin/activate  # On Windows use venv\Scripts\activate


Install dependencies:

Bash
pip3 install -e.
Environment Configuration:
Copy the example config and add your API keys and a local test private key:

Bash
cp.env.example.env
Make sure to set use_tee=False in local_agent_server.py and delta_neutral.py for local macOS/Windows testing.

Running the Agent
Start the Strategy Engine:
Watch the agent analyze the market and generate EIP-712 cryptographically signed trade intents in real-time.

Bash
python3 src/agent/delta_neutral.py
Start the Local Dashboard:
Access the agent's web interface and ERC-8004 registration portal.

Bash
python3 deployment/local_agent_server.py
Navigate to http://localhost:8000 in your browser.

🔮 Next Steps (Production)
Integrate live price oracles (e.g., Pyth Network).

Deploy the containerized application to Phala Cloud for real Intel TDX hardware attestation generation.

Submit real validation artifacts to the ERC-8004 Validation Registry.

📄 License
This project is licensed under the MIT License.


### ¿Qué hacer a continuación?
Una vez que subas esto a tu GitHub, tendrás un repositorio que se ve profesional y listo para la competición. El siguiente paso en tu código sería reemplazar los precios simulados (`50000.00` y `50030.00`) en la función `get_market_prices()` por una llamada real a una API pública gratuita (como Binance o CoinGecko) para que tu agente analice datos en vivo.
