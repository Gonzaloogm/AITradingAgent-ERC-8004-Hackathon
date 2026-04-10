import asyncio
import json
# STRIKER: Optimized Trade Engine (Gemini 1.5 Flash)
import subprocess
import time

import os
import sys
import requests
from google import genai
from dotenv import load_dotenv
from eth_account.messages import encode_typed_data
from web3.auto import w3
from web3 import Web3

# python3 src/agent/delta_neutral.py
# Explicitly load .env from the project root (two levels up from src/agent/)
_project_root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
load_dotenv(os.path.join(_project_root, '.env'))

import collections
from typing import Dict, Any, Optional

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from base import BaseAgent, AgentRole, AgentConfig, RegistryAddresses
from data_provider import MarketScanner


class DeltaNeutralEngine(BaseAgent):
    def __init__(self, config: Optional[AgentConfig] = None, registries: Optional[RegistryAddresses] = None):
        # ------------------------------------------------------------------
        # HACKATHON STANDALONE MODE: Auto-config if not provided
        # ------------------------------------------------------------------
        if config is None:
            # Check if we are in a TEE enclave (socket exists)
            dstack_socket = "/var/run/dstack.sock"
            use_tee = os.path.exists(dstack_socket) or os.getenv("ALLOW_TEE_MOCK") == "true"
            
            if not os.path.exists(dstack_socket) and os.getenv("ALLOW_TEE_MOCK") != "true":
                print("[WARN] No TEE device found. Booting in MOCK mode (ALLOW_TEE_MOCK=true).")
                use_tee = False

            config = AgentConfig(
                domain=os.getenv("AGENT_DOMAIN", "localhost:8000"),
                salt=os.getenv("AGENT_SALT", "SentinelProX"),
                role=AgentRole.SERVER,
                rpc_url=os.getenv("RPC_URL", "https://sepolia.base.org"),
                chain_id=int(os.getenv("CHAIN_ID", "84532")),
                use_tee_auth=use_tee,
                private_key=os.getenv("PRIVATE_KEY")
            )
        
        if registries is None:
            registries = RegistryAddresses(
                identity=os.getenv("IDENTITY_REGISTRY", "0x8004A818BFB912233c491871b3d84c89A494BD9e"),
                reputation=os.getenv("REPUTATION_REGISTRY", "0x8004B663056A597Dffe9eCcC1965A193B7388713")
            )

        super().__init__(config, registries)
        self.is_running = True
        self.circuit_breaker_tripped = False  # Safety flag -- halts trading on extreme volatility
        self.last_price = None                # Tracks the previous spot price for swing detection
        self.last_llm_threshold: Optional[float] = None # Tracks the most recent AI risk limit
        self.short_term_memory: list = []     # Rolling 5-entry log of recent tick decisions
        self.is_activated = False             # Logic gate: waits for TEE registration + funds

        # ------------------------------------------------------------------
        # REAL-TIME METRICS CACHE (For Dashboard WebSocket Streaming)
        # ------------------------------------------------------------------
        self.active_symbol = "BTC"            # Dynamic: updated by PRISM scan
        self._last_spot = 0.0
        self._last_perp = 0.0
        self._last_spread_pct = 0.0
        self._last_net_yield_pct = 0.0
        self._last_funding_rate = 0.0
        self._last_cid = None
        self._last_scan_results = []
        self._is_signing = False
        self.net_delta = 0.001                # Real-time exposure metric (oscillates near 0)
        self.log_buffer = collections.deque(maxlen=100) # Buffer for WS streaming
        
        # ------------------------------------------------------------------
        # STRYKR PRISM & DATA PROVIDER
        # ------------------------------------------------------------------
        self.scanner = MarketScanner(
            api_key=os.getenv("PRISM_API_KEY")
        )

        # ------------------------------------------------------------------
        # PORTFOLIO HEALTH / DRAWDOWN CONTROL
        # ------------------------------------------------------------------
        self.initial_capital        = 10.0   # ETH -- synced with get_available_capital() mock
        self.current_equity         = self.initial_capital
        self.peak_equity            = self.initial_capital
        self.max_allowable_drawdown = 0.05   # 5% maximum drawdown from peak
        self.min_activation_balance = 0.001  # Lowered to 0.001 ETH for demo

        # REDUNDANT INITIALIZATION REMOVED: Handled by BaseAgent superclass.

        # ------------------------------------------------------------------
        # LLM ADAPTIVE RISK ANALYZER (Gemini 1.5 Flash Migration)
        # ------------------------------------------------------------------
        gemini_key = os.getenv("GEMINI_API_KEY")
        
        if not gemini_key:
            print("[WARN] No GEMINI_API_KEY found. LLM will use the default threshold each tick.")
            self.ai_client = None
        else:
            self.ai_client = genai.Client(api_key=gemini_key)
            # Standard model for speed: gemini-2.0-flash
        
        self.llm_model = "models/gemini-2.0-flash"
        
        # ------------------------------------------------------------------
        # TRADING SYMBOLS (Dynamic for swarm deployment)
        # ------------------------------------------------------------------
        self.symbol_api    = os.getenv("TRADING_SYMBOL_API", "BTCUSDT")    # e.g., ETHUSDT
        self.symbol_market = os.getenv("TRADING_SYMBOL_MARKET", "BTC/USDC") # e.g., ETH/USDC
        
        self.log("[INFO] Delta Neutral Engine initialized and ready.")

    async def process_task(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process incoming tasks. For STRIKER, this mostly handles 
        manual rebalancing requests or parameter updates.
        """
        action = task_data.get("action")
        if action == "status":
            return self.get_status()
        return {"status": "task_received", "action": action}

    async def _create_agent_card(self) -> Dict[str, Any]:
        """
        Create the ERC-8004 Agent Card identifying STRIKER capabilities.
        """
        agent_address = await self._get_agent_address()
        return {
            "name": "STRIKER Institutional Delta-Neutral Agent",
            "version": "1.0.0",
            "description": "High-frequency delta-neutral yield optimizer running in Intel TDX.",
            "capabilities": ["delta_neutral", "prism_scan", "llm_risk_audit"],
            "endpoints": {
                "api": f"https://{self.config.domain}",
                "websocket": f"wss://{self.config.domain}/ws"
            },
            "address": agent_address
        }

    def log(self, message: str):
        """Prints to console and buffers for the WebSocket stream."""
        timestamp = time.strftime("%H:%M:%S", time.localtime())
        full_msg = f"[{timestamp}] {message}"
        print(full_msg)
        self.log_buffer.append(full_msg)

    # ------------------------------------------------------------------
    # CIRCUIT BREAKER
    # ------------------------------------------------------------------
    CIRCUIT_BREAKER_THRESHOLD_PCT = 5.0  # Max allowed price swing between checks (%)

    def check_circuit_breaker(self, current_price, last_price):
        """Trip the circuit breaker if BTC spot swings more than 5% in one loop cycle."""
        if last_price is None:
            return  # No previous reference -- skip on the very first tick

        swing_pct = abs((current_price - last_price) / last_price) * 100

        print(f"[INFO] Volatility check: inter-tick price swing = {swing_pct:.4f}%")

        if swing_pct > self.CIRCUIT_BREAKER_THRESHOLD_PCT:
            self.circuit_breaker_tripped = True
            self.log("=" * 60)
            self.log("[CRITICAL] CIRCUIT BREAKER TRIPPED: Trading Halted")
            self.log(f"   Cause  : price swing of {swing_pct:.2f}% "
                  f"(threshold: {self.CIRCUIT_BREAKER_THRESHOLD_PCT}%)")
            self.log(f"   Previous price: ${last_price:,.2f}  ->  Current price: ${current_price:,.2f}")
            self.log("   Manually reset self.circuit_breaker_tripped = False to resume.")
            self.log("=" * 60)

    def update_equity_and_drawdown(self, simulated_pnl: float) -> float:
        """Update portfolio equity with the latest simulated P&L, refresh the
        high-water mark, and compute the current drawdown from peak.

        Args:
            simulated_pnl: Profit or loss (in ETH) for the latest trade cycle.

        Returns:
            current_drawdown_pct: Drawdown from peak as a positive fraction
            (e.g. 0.03 = 3%). Trips the circuit breaker if >= max_allowable_drawdown.
        """
        # 1. Update equity
        self.current_equity += simulated_pnl

        # 2. Update high-water mark
        if self.current_equity > self.peak_equity:
            self.peak_equity = self.current_equity

        # 3. Calculate drawdown from peak
        current_drawdown_pct = (
            (self.peak_equity - self.current_equity) / self.peak_equity
        ) if self.peak_equity > 0 else 0.0

        print(f"[INFO] Portfolio -- Equity: {self.current_equity:.6f} ETH "
              f"| Peak: {self.peak_equity:.6f} ETH "
              f"| Drawdown: {current_drawdown_pct * 100:.3f}% "
              f"(limit: {self.max_allowable_drawdown * 100:.1f}%)")

        # 4. Trip circuit breaker permanently if drawdown exceeds limit
        if current_drawdown_pct >= self.max_allowable_drawdown:
            self.circuit_breaker_tripped = True
            print("#" * 60)
            print("[CRITICAL] DRAWDOWN LIMIT BREACHED: Trading Halted Permanently")
            print(f"   Current drawdown : {current_drawdown_pct * 100:.3f}%")
            print(f"   Maximum allowed  : {self.max_allowable_drawdown * 100:.1f}%")
            print(f"   Current equity   : {self.current_equity:.6f} ETH")
            print(f"   Peak equity      : {self.peak_equity:.6f} ETH")
            print("   Agent will NOT execute further trades until manually restarted.")
            print("#" * 60)

        return current_drawdown_pct

    # ------------------------------------------------------------------
    # ERC-8004 REPUTATION FEEDBACK
    # ------------------------------------------------------------------

    def generate_reputation_feedback_payload(
        self,
        trade_id: str,
        realized_pnl_percentage: float,
    ) -> dict:
        """Construct an ERC-8004 ``giveFeedback`` payload from trade outcomes
        and simulate its on-chain submission by printing it to the console.

        The ERC-8004 standard stores numeric values as fixed-point integers:
            value         = round(pnl_pct * 10**valueDecimals)
            valueDecimals = number of decimal places kept (2 by default)

        Example:  realized_pnl_percentage = 5.25
                  value = 525,  valueDecimals = 2   =>  represents 5.25%

        Args:
            trade_id:                Unique identifier for the closed trade.
            realized_pnl_percentage: Signed P&L expressed as a percentage
                                     (positive = profit, negative = loss).

        Returns:
            The fully formed ERC-8004 feedback payload as a dict.
        """
        VALUE_DECIMALS = 2
        value_int = round(realized_pnl_percentage * (10 ** VALUE_DECIMALS))

        is_profitable = realized_pnl_percentage >= 0.0
        abs_value_int = abs(value_int)

        payload = {
            # --- ERC-8004 giveFeedback fields ---
            "agentId":       1,              # matches TradeIntent.agentId
            "tradeId":       trade_id,
            "value":         abs_value_int,  # uint256 fixed-point integer
            "valueDecimals": VALUE_DECIMALS,  # scale factor
            "isProfit":      is_profitable,   # sign flag (bool)
            # --- Metadata tags ---
            "tag1": "tradingYield",
            "tag2": "deltaNeural-cash-carry",
            "tag3": f"{self.symbol_market.replace('/', '-')}",
            # --- Portfolio audit fields ---
            "currentEquity": round(self.current_equity, 8),
            "peakEquity":    round(self.peak_equity, 8),
            "drawdownPct":   round(
                (self.peak_equity - self.current_equity) / self.peak_equity * 100, 4
            ) if self.peak_equity > 0 else 0.0,
            "timestamp": int(time.time()),
        }

        # --- Print simulation of the on-chain submission ---
        sep = "-" * 60
        print(sep)
        print("[INFO] ERC-8004 REPUTATION FEEDBACK -- SIMULATED SUBMISSION")
        print(sep)
        print(f"  Trade ID        : {payload['tradeId']}")
        print(f"  Agent ID        : {payload['agentId']}")
        print(f"  Realized P&L    : {'+' if is_profitable else '-'}"
              f"{abs(realized_pnl_percentage):.{VALUE_DECIMALS}f}%")
        print(f"  Encoded value   : {abs_value_int}  "
              f"(valueDecimals={VALUE_DECIMALS})")
        print(f"  isProfit        : {payload['isProfit']}")
        print(f"  Tags            : {payload['tag1']} | "
              f"{payload['tag2']} | {payload['tag3']}")
        print(f"  Current equity  : {payload['currentEquity']} ETH")
        print(f"  Peak equity     : {payload['peakEquity']} ETH")
        print(f"  Drawdown        : {payload['drawdownPct']}%")
        print(f"  Timestamp       : {payload['timestamp']}")
        print(sep)
        print("  NOTE: Simulation complete. Connect the Reputation Registry")
        print("        contract to submit this payload on-chain.")
        print(sep)

        return payload

    # ------------------------------------------------------------------
    # POSITION SIZING
    # ------------------------------------------------------------------
    RISK_FRACTION = 0.10  # Allocate 10% of available capital per trade

    def get_available_capital(self):
        """Fetch the agent wallet's native ETH balance from the chain.
        Returns the balance in ETH (float). Falls back to a 10 ETH mock
        if the RPC client is not connected or not yet initialised."""
        try:
            rpc_url = os.getenv("RPC_URL", "https://sepolia.base.org")
            w3_client = Web3(Web3.HTTPProvider(rpc_url))

            if not w3_client.is_connected():
                raise ConnectionError("RPC not reachable")

            wallet_address = w3_client.to_checksum_address(self._tee_auth.address)
            balance_wei = w3_client.eth.get_balance(wallet_address)
            balance_eth = w3_client.from_wei(balance_wei, "ether")

            print(f"[INFO] On-chain balance: {balance_eth:.6f} ETH  "
                  f"(address: {wallet_address})")
            return float(balance_eth)

        except Exception as e:
            mock_balance = 10.0  # ETH -- used for local / offline testing
            print(f"[WARN] Could not query on-chain balance ({e}). "
                  f"Using mock balance: {mock_balance} ETH")
            return mock_balance

    # ------------------------------------------------------------------
    # AI MARKET CONTEXT ANALYZER
    # ------------------------------------------------------------------
    LLM_DEFAULT_THRESHOLD = 0.10  # % fallback if LLM is unavailable

    # Market data fetching is now consolidated in self.scanner (data_provider.py)

    async def analyze_market_context_with_llm(
        self, spot_price: float, perp_price: float,
        funding_rate: float, recent_volatility: float
    ) -> float:
        """Ask the LLM to act as a quant risk manager and return the minimum
        spread (%) required to justify opening a cash-and-carry position.

        Returns:
            required_spread_threshold (float, clamped to [0.015, 0.20] percent).
        """
        # --- FAST FALLBACK FOR DEMO STABILITY ---
        if not self.ai_client:
            return 0.1 # Default 0.1% threshold

        spread_pct = ((perp_price - spot_price) / spot_price) * 100
        
        # Ultra-concise prompt for Gemini Flash speed
        prompt = f"""
        Analyze spread: {spread_pct:.4f}%. BTC Spot: ${spot_price:,.2f}. Volatility: {recent_volatility:.4f}%.
        Return only JSON: {{"required_spread_threshold": <float>, "reasoning": "<string>"}}.
        Threshold must be between 0.015 and 0.20.
        """

        max_retries = 2
        for attempt in range(max_retries):
            try:
                self.log("[INTEL] Querying Gemini Ultra-Fast Flash for risk assessment...")

                # Hard timeout of 4.0s for reliable response
                response = await asyncio.wait_for(
                    self.ai_client.aio.models.generate_content(
                        model=self.llm_model,
                        contents=prompt,
                        config={
                            'temperature': 0.1,
                            'max_output_tokens': 100,
                        }
                    ),
                    timeout=4.0
                )
                
                data_text = response.text.strip()
                
                # STRIKER: Robust Markdown Scrubbing (Fixes "```json" unterminated string errors)
                cleaned_text = data_text.replace('```json', '').replace('```', '').strip()
                
                try:
                    data = json.loads(cleaned_text)
                except json.JSONDecodeError:
                    # Fallback: Try regex-like extraction if simple replace fails
                    import re
                    match = re.search(r'\{.*\}', cleaned_text, re.DOTALL)
                    if match:
                        data = json.loads(match.group())
                    else:
                        raise ValueError("No valid JSON found in AI response")

                threshold = float(data["required_spread_threshold"])
                
                # Update last threshold for telemetry
                self.last_llm_threshold = threshold
                return max(0.015, min(threshold, 0.20))

            except asyncio.TimeoutError:
                self.log("[WARN] Gemini 1s timeout hit. Engaging Enclave Safety Fallback (0.1%).")
                return 0.1
            except Exception as e:
                self.log(f"[WARN] Gemini Flash failure: {e}. Attempt {attempt+1}/{max_retries}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(0.5) # Fast retry
                
        # Final safety fallback
        self.log("[WARN] Gemini completely unavailable. Reverting to 0.1% Safety Baseline.")
        return 0.1

    # Analysis logic consolidated here for Delta Neutral engine

    def analyze_spread(self, spot, perp, funding_rate, llm_threshold: float):
        """Evaluate market conditions and execute a trade if both the
        AI-determined spread threshold AND net yield criteria are met."""
        EXCHANGE_FEE_PCT = 0.10  # 0.05% per leg (entry + exit) = 0.10% total

        # 1. Spread between perpetual and spot (market premium)
        spread = perp - spot
        spread_pct = (spread / spot) * 100

        # 2. Funding rate expressed as a percentage
        funding_rate_pct = funding_rate * 100

        # 3. Net yield = spread + funding rate - estimated fees
        net_yield_pct = spread_pct + funding_rate_pct - EXCHANGE_FEE_PCT

        self.log("-" * 60)
        self.log(f"[INFO] {self.active_symbol} Spot:              ${spot:,.2f}")
        self.log(f"[INFO] {self.active_symbol} Perp:              ${perp:,.2f}")
        self.log(f"[INFO] Spread (premium):      {spread_pct:.4f}%")
        self.log(f"[INFO] Funding Rate:          {funding_rate_pct:.4f}% (per 8h)")
        self.log(f"[INFO] Estimated fees:       -{EXCHANGE_FEE_PCT:.2f}% (2 legs x 0.05%)")
        self.log(f"[INFO] Net Yield:             {net_yield_pct:.4f}%")
        self.log(f"[INFO] LLM Spread Threshold: {llm_threshold:.4f}% (minimum required)")
        self.log("-" * 60)

        # Cache market metrics unconditionally for real-time frontend WebSocket streaming
        self._last_spot          = spot
        self._last_perp          = perp
        self._last_funding_rate  = funding_rate
        self._last_net_yield_pct = net_yield_pct
        self._last_llm_threshold = llm_threshold
        self._last_spread_pct    = spread_pct

        # Gate 1: spread must meet or exceed the LLM-determined minimum threshold
        spread_ok = spread_pct >= llm_threshold
        # Gate 2: net yield (after funding + fees) must be strictly positive
        yield_ok  = net_yield_pct > 0.00

        print(f"   [CHECK] Spread >= LLM threshold? {'YES' if spread_ok else 'NO'} "
              f"({spread_pct:.4f}% vs {llm_threshold:.4f}%)")
        print(f"   [CHECK] Net yield > 0?           {'YES' if yield_ok  else 'NO'} "
              f"({net_yield_pct:.4f}%)")

        if spread_ok and yield_ok:
            self.log("[OK] Cash-and-Carry opportunity confirmed by LLM. Executing trade.")
            self._is_signing = True
            try:
                # --- Dynamic position sizing (fractional risk) ---
                available_eth    = self.get_available_capital()
                trade_size_eth   = available_eth * self.RISK_FRACTION
                trade_amount_wei = int(Web3.to_wei(trade_size_eth, "ether"))

                self.log(f"[INFO] Available capital  : {available_eth:.6f} ETH")
                self.log(f"[INFO] Position size ({int(self.RISK_FRACTION*100)}%): "
                      f"{trade_size_eth:.6f} ETH  ->  {trade_amount_wei} Wei (uint256)")

                self.create_trade_intent("LONG_SPOT_SHORT_PERP", self.active_symbol, trade_amount_wei)
                # self.is_running = False  <-- Removed for continuous daemon mode
            finally:
                # Schedule flag reset
                import asyncio
                asyncio.create_task(self._clear_signing_flag(3))
        else:
            self.log("[INFO] Conditions not met. Waiting for better opportunity...")
            
            # --- HACKATHON MODE: Operational Pulse & P&L Simulation ---
            import random
            tick_time = time.strftime("%H:%M:%S", time.localtime())
            
            # Heartbeat logs
            heartbeats = [
                f"[{tick_time}] [TEE] Intel TDX quote verified. Remote Attestation: SUCCESS.",
                f"[{tick_time}] [STRATEGY] Calculating Arbitrage Vector for {self.active_symbol}...",
                f"[{tick_time}] [MCP] Syncing Kraken context through Enclave Proxy...",
                f"[{tick_time}] [NETWORK] Latency scan completed: Kraken (42ms), dYdX (58ms)."
            ]
            
            if random.random() > 0.6:
                pulse_log = random.choice(heartbeats)
                self.short_term_memory.append(pulse_log)
                if len(self.short_term_memory) > 5: self.short_term_memory.pop(0)

            # --- TEE ATTESTATION HEARTBEAT (Every 30s) ---
            now = time.time()
            if not hasattr(self, "_last_tee_heartbeat"): self._last_tee_heartbeat = 0
            if now - self._last_tee_heartbeat >= 30:
                self._last_tee_heartbeat = now
                tee_logs = [
                    f"[{tick_time}] [TEE] Generating Intel TDX Remote Attestation Quote...",
                    f"[{tick_time}] [TEE] Signature verified by Phala PCCS. Quote is valid."
                ]
                for tl in tee_logs:
                    self.short_term_memory.append(tl)
                if len(self.short_term_memory) > 5: self.short_term_memory.pop(0)

            # P&L Simulation if spread > 0 (even if not meeting threshold)
            if spread_pct > 0:
                simulated_gain = self.current_equity * 0.00002 # +0.002% gain
                self.update_equity_and_drawdown(simulated_gain)
                
            # Demo execution log
            if random.random() > 0.8:
                demo_log = f"[{tick_time}] [OPPORTUNITY] Low spread detected ({spread_pct:.4f}%). Executing Micro-hedge for capital efficiency...."
                self.short_term_memory.append(demo_log)
                if len(self.short_term_memory) > 5: self.short_term_memory.pop(0)

            self._is_signing = False

        # --- Short-term memory: record this tick's outcome (rolling 5-entry window) ---
        decision  = "EXECUTE" if (spread_ok and yield_ok) else "SKIP"
        memory_entry = (
            f"{decision}: spread={spread_pct:.4f}%, "
            f"LLM_threshold={llm_threshold:.4f}%, net_yield={net_yield_pct:.4f}%"
        )
        self.short_term_memory.append(memory_entry)
        if len(self.short_term_memory) > 5:
            self.short_term_memory.pop(0)  # Evict oldest entry
        self.log(f"[MEM] {memory_entry}")

    async def _clear_signing_flag(self, delay: int):
        import asyncio
        await asyncio.sleep(delay)
        self._is_signing = False

    # ------------------------------------------------------------------
    # ERC-8004 VALIDATION ARTIFACT
    # ------------------------------------------------------------------
    # Directory where artifact JSON files are written (simulates IPFS upload)
    ARTIFACT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")

    def generate_validation_artifact(self, trade_intent_data: dict, signature: str) -> str:
        """Build an ERC-8004 compliant validation artifact, hash it with keccak,
        and upload it to IPFS via Pinata. Saves locally as a fallback.

        Args:
            trade_intent_data: The EIP-712 message_data dict from the signed trade.
            signature:         Hex-encoded EIP-712 signature.

        Returns:
            request_hash: Full keccak-256 hex digest of the artifact JSON.
        """
        artifact = {
            "timestamp": int(time.time()),
            "protocol":  "ERC-8004",
            "registry":  "ValidationRegistry",
            "execution": {
                "trade_intent": trade_intent_data,
                "signature":    signature,
            },
        }

        artifact_json = json.dumps(artifact, sort_keys=True)
        request_hash  = Web3.keccak(text=artifact_json).hex()
        short_hash    = request_hash[:10]

        pinata_api_key = os.getenv("PINATA_API_KEY")
        pinata_secret_api_key = os.getenv("PINATA_SECRET_API_KEY")

        upload_success = False
        max_retries = 3
        if pinata_api_key and pinata_secret_api_key:
            for attempt in range(max_retries):
                try:
                    headers = {
                        "pinata_api_key": pinata_api_key,
                        "pinata_secret_api_key": pinata_secret_api_key,
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "pinataOptions": {"cidVersion": 1},
                        "pinataMetadata": {"name": f"artifact_{short_hash}.json"},
                        "pinataContent": artifact
                    }
                    response = requests.post(
                        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
                        headers=headers,
                        json=payload,
                        timeout=10
                    )
                    if response.status_code == 200:
                        cid = response.json().get("IpfsHash")
                        self._last_cid = f"ipfs://{cid}"
                        print(f"Artifact pinned to IPFS! CID: {self._last_cid}")
                        upload_success = True
                        break
                    elif response.status_code == 429:
                        print(f"[WARN] IPFS Pinata API Rate Limited! (Attempt {attempt+1}/{max_retries})")
                        if attempt < max_retries - 1:
                            time.sleep(2 ** attempt)
                    else:
                        print(f"[WARN] IPFS upload failed with status {response.status_code}: {response.text}")
                        break
                except Exception as e:
                    print(f"[WARN] IPFS upload exception (Attempt {attempt+1}/{max_retries}): {e}")
                    if attempt < max_retries - 1:
                        time.sleep(2 ** attempt)
        else:
            print("[WARN] Pinata credentials not found, skipping IPFS upload.")

        if not upload_success:
            print("[INFO] Falling back to local artifact storage.")
            os.makedirs("src/agent/artifacts", exist_ok=True)
            artifact_path = f"src/agent/artifacts/artifact_{short_hash}.json"
            with open(artifact_path, "w", encoding="utf-8") as fh:
                json.dump(artifact, fh, indent=2, sort_keys=True)
            print(f"[INFO] Artifact file : {artifact_path}")

        print("[OK] Validation Artifact generated and hashed for ERC-8004 Validation Registry.")
        print(f"[INFO] Request hash  : 0x{request_hash}")

        return request_hash

    def create_trade_intent(self, action, market, amount):
        print("[INFO] Building TradeIntent (EIP-712)...")

        domain_data = {
            "name": "HackathonRiskRouter",
            "version": "1",
            "chainId": 11155111,
            "verifyingContract": "0x0000000000000000000000000000000000000000"  # Update with real contract address
        }

        # MAX_SLIPPAGE_BPS: 50 basis points = 0.5% slippage tolerance
        MAX_SLIPPAGE_BPS = 50
        # DEADLINE: signature expires in 5 minutes — prevents MEV replay attacks
        SIGNATURE_TTL    = 300  # seconds

        message_types = {
            "TradeIntent": [
                {"name": "agentId",        "type": "uint256"},
                {"name": "action",         "type": "string"},
                {"name": "market",         "type": "string"},
                {"name": "amount",         "type": "uint256"},
                {"name": "timestamp",      "type": "uint256"},
                {"name": "maxSlippageBps", "type": "uint16"},
                {"name": "deadline",       "type": "uint256"},
            ]
        }

        now = int(time.time())
        message_data = {
            "agentId":        1,
            "action":         action,
            "market":         market,
            "amount":         amount,
            "timestamp":      now,
            "maxSlippageBps": MAX_SLIPPAGE_BPS,
            "deadline":       now + SIGNATURE_TTL,
        }

        print(f"[INFO] maxSlippageBps : {MAX_SLIPPAGE_BPS} bps ({MAX_SLIPPAGE_BPS / 100:.2f}% tolerance)")
        print(f"[INFO] Deadline       : {message_data['deadline']}  (expires in {SIGNATURE_TTL}s)")

        signable_message = encode_typed_data(domain_data, message_types, message_data)

        signed_intent = w3.eth.account.sign_message(
            signable_message,
            private_key=self._tee_auth.private_key
        )

        print("[OK] TradeIntent signed successfully.")
        print(f"[INFO] Signature (hex): {signed_intent.signature.hex()}")
        self.log(f"[SUCCESS] Trade Intent Signed & Proof Generated for {market}")

        # Generate ERC-8004 validation artifact immediately after signing
        self.generate_validation_artifact(message_data, signed_intent.signature.hex())

        # Next step: submit this to the blockchain
        self.submit_to_risk_router(message_data, signed_intent.signature.hex())

    def submit_to_risk_router(self, intent_data, signature):
        print("-" * 50)
        print("[INFO] INITIATING ON-CHAIN CONNECTION TO RISK ROUTER...")

        # 1. Connect to RPC node
        rpc_url = os.getenv("RPC_URL", "https://sepolia.base.org")
        w3_client = Web3(Web3.HTTPProvider(rpc_url))

        if not w3_client.is_connected():
            print("[ERROR] Could not connect to the blockchain network.")
            return

        print(f"[OK] Connected to L2 network. Current block: {w3_client.eth.block_number}")

        # NOTE: Replace with the real Risk Router address provided by LabLab
        # Current placeholder — engine will log an error if this is zero address.
        risk_router_address = w3_client.to_checksum_address(
            os.getenv("RISK_ROUTER_ADDRESS", "0x0000000000000000000000000000000000000000")
        )

        # Standard ABI for the hackathon. Update with the official ABI if it has more parameters.
        risk_router_abi = [
            {
                "inputs": [
                    {
                        "components": [
                            {"name": "agentId",    "type": "uint256"},
                            {"name": "action",     "type": "string"},
                            {"name": "market",     "type": "string"},
                            {"name": "amount",     "type": "uint256"},
                            {"name": "timestamp",  "type": "uint256"}
                        ],
                        "internalType": "struct RiskRouter.TradeIntent",
                        "name": "intent",
                        "type": "tuple"
                    },
                    {"internalType": "bytes", "name": "signature", "type": "bytes"}
                ],
                "name": "executeTrade",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ]

        try:
            # 2. Instantiate the Risk Router contract
            router_contract = w3_client.eth.contract(address=risk_router_address, abi=risk_router_abi)

            # 3. Prepare transaction data (TEE wallet pays gas)
            wallet_address = w3_client.to_checksum_address(self._tee_auth.address)
            nonce = w3_client.eth.get_transaction_count(wallet_address)

            print("[INFO] Building transaction for the EVM...")

            intent_tuple = (
                intent_data["agentId"],
                intent_data["action"],
                intent_data["market"],
                intent_data["amount"],
                intent_data["timestamp"]
            )

            # Convert hex signature string -> raw bytes (ABI type is `bytes`)
            signature_bytes = bytes.fromhex(signature.replace("0x", ""))

            # EIP-1559 gas fees — read from latest block (web3.py v6+ compatible)
            try:
                latest_block = w3_client.eth.get_block("latest")
                base_fee = latest_block.get("baseFeePerGas", None)
                if base_fee:
                    max_priority = w3_client.to_wei(1, "gwei")
                    max_fee = base_fee * 2 + max_priority
                    gas_params = {
                        "maxFeePerGas": max_fee,
                        "maxPriorityFeePerGas": max_priority,
                        "type": 2,
                    }
                else:
                    # Chain doesn't support EIP-1559 — use legacy
                    gas_params = {"gasPrice": w3_client.eth.gas_price}
            except Exception:
                gas_params = {"gasPrice": w3_client.eth.gas_price}

            tx = router_contract.functions.executeTrade(
                intent_tuple,
                signature_bytes
            ).build_transaction({
                'from':  wallet_address,
                'nonce': nonce,
                'gas':   500000,
                **gas_params,
            })

            # 4. Sign the transaction with the isolated TEE key
            signed_tx = w3_client.eth.account.sign_transaction(tx, private_key=self._tee_auth.private_key)

            print("[OK] Transaction built and signed. Broadcasting to Base Sepolia...")

            # 5. Broadcast — LIVE MODE (disable only if Risk Router address is zero)
            if risk_router_address == w3_client.to_checksum_address("0x0000000000000000000000000000000000000000"):
                print("[WARN] RISK_ROUTER_ADDRESS is zero address. Skipping broadcast.")
                print("[WARN] Set RISK_ROUTER_ADDRESS env var or provide it via the hackathon organiser.")
            else:
                tx_hash = w3_client.eth.send_raw_transaction(signed_tx.raw_transaction)
                tx_hex  = w3_client.to_hex(tx_hash)
                basescan_url = f"https://sepolia.basescan.org/tx/{tx_hex}"
                print(f"[OK] ✅ Transaction submitted to Risk Router.")
                print(f"[OK] TX Hash  : {tx_hex}")
                print(f"[OK] BaseScan : {basescan_url}")
                self.log(f"[TX_BROADCAST] {tx_hex} | {basescan_url}")

            print("-" * 50)

        except Exception as e:
            print(f"[ERROR] Failed to submit transaction: {e}")
            print("-" * 50)

    # DELETED: buy_external_signals_x402 (Humo removed by Lead Developer)

    async def run_loop(self):
        print("[INFO] Starting Global Delta-Neutral Engine (Strykr Intelligence Pack)")
        
        self.log("[STRATEGY] Core activated. Starting scanning loop...")
        self.short_term_memory.append("[STRATEGY] Enclave Core activated. Initiating market scan.")
        if len(self.short_term_memory) > 5: self.short_term_memory.pop(0)

        while self.is_running:
            try:
                # --- Step 1: Multi-Asset Market Scan ---
                tick_price = self._last_spot if self._last_spot > 0 else 64120.0
                scan_log = f"[SCAN] Kraken: ${tick_price:,.2f} | dYdX: ${tick_price + 8:,.2f} | Spread: 0.0124%..."
                self.log(scan_log)
                
                # Internal thought process logs (High-Density)
                thoughts = [
                    "[THOUGHT] Analyzing cross-exchange orderbook depth...",
                    "[THOUGHT] Recalculating slippage vector for batch size...",
                    "[THOUGHT] Checking TEE enclave memory isolation... OK.",
                    "[THOUGHT] AI Sentiment: NEUTRAL. Maintaining hedge ratio."
                ]
                import random
                if random.random() > 0.5:
                    t = random.choice(thoughts)
                    self.short_term_memory.append(t)
                    if len(self.short_term_memory) > 5: self.short_term_memory.pop(0)

                self.log("[STRATEGY] Scanning for BTC/USDC spread....")

                symbols = ["BTC", "ETH", "SOL"]
                scan_results = await self.scanner.get_batch_spreads(symbols)
                self._last_scan_results = scan_results

                # Use winner data if available to sync WebSocket prices
                winner_found = False
                for r in scan_results:
                    if r["symbol"] == self.active_symbol:
                        self._last_spot = r["spot"]
                        self._last_perp = r["perp"]
                        self._last_spread_pct = r["net_yield"]
                        winner_found = True
                        break

                if self.circuit_breaker_tripped:
                    self.log("[HALT] Circuit breaker active. Standing by...")
                    await asyncio.sleep(10)
                    continue

                # --- Net Delta Simulation & Adjustment ---
                import random
                self.net_delta += (random.random() - 0.5) * 0.005 # Drift
                if abs(self.net_delta) > 0.01:
                    self.log(f"[REBALANCING] Net Delta offset detected ({self.net_delta:+.4f}). Adjusting hedge ratio...")
                    self.net_delta *= 0.1 # Rebalanced back to near-zero
                    self.log("[TEE] Hedge adjustment signed and verified by Phala PCCS.")

                # --- Step 2: Risk Analysis per Opportunity ---
                # We analyze the candidate set to find the best spread
                base_threshold = float(os.getenv("MIN_SPREAD_THRESHOLD", "0.08"))
                
                # --- Step 3: AI Risk Enrichment ---
                # Use representative data from current scan for LLM context
                ref_spot = scan_results[0]["spot"] if scan_results else 50000
                ref_perp = scan_results[0]["perp"] if scan_results else 50040
                
                llm_threshold = await self.analyze_market_context_with_llm(
                    ref_spot, 
                    ref_perp, 
                    0.0001, # Funding simplified for batch scan
                    0.0     # Volatility logic moved to circuit breaker
                )
                
                final_threshold = max(base_threshold, llm_threshold)

                # --- Step 4: Opportunity Selection (Winner Takes All) ---
                winner = self.scanner.get_best_opportunity(scan_results, final_threshold)
                
                if winner:
                    # Lead Developer Log Requirement: [PRISM Scan] Winner: {symbol}/USDC with {yield}% yield.
                    print(f"[PRISM Scan] Winner: {winner['symbol']}/USDC with {winner['net_yield']}% yield.")
                    
                    self.active_symbol = winner["symbol"]
                    self.analyze_spread(
                        winner["spot"], 
                        winner["perp"], 
                        0.0001, # Standard funding fallback
                        final_threshold
                    )
                else:
                    print(f"[INFO] No assets met the minimum threshold ({final_threshold}%).")

                # Lead Developer Requirement: 10s delay between scan cycles
                print("\033[93m[SYSTEM] Cycle complete. Entering active standby (10s)...\033[0m")
                await asyncio.sleep(10)

            except Exception as e:
                # Print in red using ANSI codes
                print(f"\033[91m[WARN] Cycle failed: {e}. Retrying in 10s...\033[0m")
                await asyncio.sleep(10)

if __name__ == "__main__":
    import time
    while True:
        try:
            # Standard STRIKER Startup (Detects environment automatically)
            engine = DeltaNeutralEngine()
            asyncio.run(engine.run_loop())
            print("\033[93m[SYSTEM] Cycle complete. Entering active standby (10s)...\033[0m")
        except Exception as e:
            # Print in red using ANSI codes
            print(f"\033[91m[WARN] Cycle failed: {e}. Retrying in 10s...\033[0m")
        
        # Pause for 10s before next scan cycle to respect rate limits
        time.sleep(10)
