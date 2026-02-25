# Delta-Neutral AI Trading Agent | ERC-8004 & TEE Secured

![EIP-8004 Compliant](https://img.shields.io/badge/EIP--8004_Compliant-success)
!(https://img.shields.io/badge/Security-Intel_TDX_TEE-orange)

Official submission for the **"AI Trading Agents with ERC-8004 Hackathon"** (March 2026).

This project implements a fully autonomous, trust-minimized financial AI agent. It executes a **Delta-Neutral (Cash-and-Carry) strategy**, capturing funding rates and basis spreads while maintaining zero directional market exposure to optimize its Sharpe ratio and minimize drawdowns.

## Key Features & Hackathon Compliance

* **Verifiable Identity:** Registered on-chain using the **ERC-8004 Identity Registry**, establishing a portable, tamper-proof agent passport.
* **TEE-Secured Execution:** Hosted within a Phala Network Trusted Execution Environment (Intel TDX). The agent's private keys never leave the hardware enclave.
* **Cryptographic Intent Signing:** Orders are not executed directly. The agent generates and signs `TradeIntents` using **EIP-712 typed data signatures** mapped to the Sepolia chain-id (EIP-155) to prevent replay attacks.
* **Risk Governance:** All signed intents are strictly routed through the hackathon's whitelisted **Risk Router** contract, ensuring programmatic adherence to max leverage and daily loss limits.

## Architecture Flow

1. **Market Intelligence:** The Python-based `DeltaNeutralEngine` ingests real-time spot and perpetual futures pricing.
2. **Spread Analysis:** Evaluates the price differential. If the spread exceeds the target threshold, a rebalancing order is triggered.
3. **TEE Attestation & Signing:** The `TEEAuthenticator` derives the isolated private key and signs the EIP-712 `TradeIntent` containing the exact operation (e.g., `LONG_SPOT` / `SHORT_PERP`).
4. **On-Chain Settlement:** The cryptographic signature is sent to the Risk Router operating on the Hackathon Capital Sandbox for validation and execution.

## Quick Start (Local Development)

### Prerequisites
* Python 3.10+
* Visual Studio Code

### Installation

1. **Clone the repository and set up the virtual environment:**
```bash
git clone <your-repo-url>
cd erc-8004-tee-agent
python3 -
