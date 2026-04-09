import asyncio
import json
import subprocess
import time

import os
import sys
import requests
import openai
from dotenv import load_dotenv
from eth_account.messages import encode_typed_data
from web3.auto import w3
from web3 import Web3

# python3 src/agent/delta_neutral.py
# Explicitly load .env from the project root (two levels up from src/agent/)
_project_root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
load_dotenv(os.path.join(_project_root, '.env'))

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from tee_auth import TEEAuthenticator
from data_provider import MarketScanner

class DeltaNeutralEngine:
    def __init__(self):
        self.is_running = True
        self.circuit_breaker_tripped = False  # Safety flag -- halts trading on extreme volatility
        self.last_price = None                # Tracks the previous spot price for swing detection
        self.last_llm_threshold: Optional[float] = None # Tracks the most recent AI risk limit
        self.short_term_memory: list = []     # Rolling 5-entry log of recent tick decisions

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

        print("[INFO] Initializing secure TEE environment...")
        private_key = os.getenv("PRIVATE_KEY")
        if not private_key:
            raise EnvironmentError(
                "PRIVATE_KEY is not defined in the project .env file."
            )
        self.tee_auth = TEEAuthenticator(
            domain="localhost:8000",
            salt=os.getenv("AGENT_SALT", "default_salt"),
            use_tee=False,
            private_key=private_key
        )

        # ------------------------------------------------------------------
        # LLM ADAPTIVE RISK ANALYZER (Groq Migration)
        # ------------------------------------------------------------------
        groq_key = os.getenv("GROQ_API_KEY")
        api_key  = groq_key or os.getenv("REDPILL_API_KEY") or os.getenv("FREE_LLM_API_KEY")
        
        # Default to Groq base URL if using Groq key, otherwise keep OpenRouter
        default_base = "https://api.groq.com/openai/v1" if groq_key else "https://openrouter.ai/api/v1"
        base_url = os.getenv("GROQ_BASE_URL") or os.getenv("FREE_LLM_BASE_URL", default_base)
        
        if not api_key:
            print("[WARN] No LLM API Key (GROQ_API_KEY / REDPILL_API_KEY) found. "
                  "LLM will use the default threshold each tick.")
        
        self.llm_client = openai.AsyncOpenAI(
            api_key=api_key or "no-key",
            base_url=base_url,
        )
        # Standard model for Groq: llama-3.1-8b-instant (stable)
        self.llm_model = os.getenv("LLM_MODEL", "llama-3.1-8b-instant")
        
        # ------------------------------------------------------------------
        # TRADING SYMBOLS (Dynamic for swarm deployment)
        # ------------------------------------------------------------------
        self.symbol_api    = os.getenv("TRADING_SYMBOL_API", "BTCUSDT")    # e.g., ETHUSDT
        self.symbol_market = os.getenv("TRADING_SYMBOL_MARKET", "BTC/USDC") # e.g., ETH/USDC

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
            print("=" * 60)
            print("[CRITICAL] CIRCUIT BREAKER TRIPPED: Trading Halted")
            print(f"   Cause  : price swing of {swing_pct:.2f}% "
                  f"(threshold: {self.CIRCUIT_BREAKER_THRESHOLD_PCT}%)")
            print(f"   Previous price: ${last_price:,.2f}  ->  Current price: ${current_price:,.2f}")
            print("   Manually reset self.circuit_breaker_tripped = False to resume.")
            print("=" * 60)

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

            wallet_address = w3_client.to_checksum_address(self.tee_auth.address)
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
        spread (%) required to justify opening a cash-and-carry position given
        current market conditions.

        Returns:
            required_spread_threshold (float, clamped to [0.015, 0.20] percent).
        """
        spread_pct = ((perp_price - spot_price) / spot_price) * 100
        funding_pct = funding_rate * 100

        prompt = f"""\
You are a quantitative risk manager evaluating a {self.symbol_market.split('/')[0]} delta-neutral
cash-and-carry trade opportunity. Analyze the following real-time
market metrics and determine the minimum required spread threshold
that justifies opening the position given current slippage and
volatility risk.

Market metrics:
- {self.symbol_market.split('/')[0]} Spot price:         ${spot_price:,.2f}
- {self.symbol_market.split('/')[0]} Perp price:         ${perp_price:,.2f}
- Current spread:         {spread_pct:.4f}%
- Funding rate (8h):      {funding_pct:.4f}%
- Recent tick volatility: {recent_volatility:.4f}% (price swing last tick)

Rules:
- In low-volatility conditions (recent_volatility < 0.05%) you may
  accept a lower spread threshold (closer to 0.05%).
- In high-volatility conditions (recent_volatility > 0.5%) demand a
  higher spread threshold (up to 0.20%) to compensate for slippage.
- The threshold must be a float strictly between 0.015 and 0.20
  (representing a percentage, e.g. 0.10 means 0.10%).

Respond ONLY with a valid JSON object, no extra text:
{{"required_spread_threshold": <float>}}
"""

        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"[INFO] Querying LLM for dynamic spread threshold (Attempt {attempt + 1}/{max_retries})...")

                # Build a concise text representation of recent decisions for the system prompt
                memory_block = (
                    "\n".join(f"  - {m}" for m in self.short_term_memory)
                    if self.short_term_memory
                    else "  (no prior decisions recorded yet)"
                )
                system_prompt = (
                    "You are a precise quantitative risk manager. "
                    "You only respond with valid JSON.\n\n"
                    "Recent agent memory (last 5 ticks):\n"
                    f"{memory_block}\n\n"
                    "Adaptive threshold guidance:\n"
                    "- If recent memory shows mostly SKIP entries with a high threshold, "
                    "consider lowering the threshold slightly if current volatility allows.\n"
                    "- If recent memory shows an EXECUTE entry, raise the threshold to "
                    "avoid over-trading and protect capital."
                )

                response = await self.llm_client.chat.completions.create(
                    model=self.llm_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    temperature=0.2,
                    max_tokens=64,
                    timeout=10
                )
                raw = response.choices[0].message.content.strip()
                # Strip markdown fences if present
                if raw.startswith("```"):
                    raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                data = json.loads(raw)
                threshold = float(data["required_spread_threshold"])
                # Clamp to allowed range
                threshold = max(0.015, min(threshold, 0.20))
                self.last_llm_threshold = threshold # Store for API access
                print(f"[INFO] LLM threshold received: {threshold:.4f}% "
                      f"(current spread: {spread_pct:.4f}%)")
                return threshold

            except openai.BadRequestError as e:
                print(f"[CRITICAL] Groq API 400 Bad Request: {e}")
                if hasattr(e, "response"):
                    print(f"DEBUG: API Response -> {e.response.text}")
                # Don't waste retries on 400 errors (usually model/config issues)
                break
            except Exception as e:
                print(f"[WARN] LLM call failed formatting or timed out ({type(e).__name__}: {e}).")
                if attempt < max_retries - 1:
                    backoff = 2 ** attempt
                    print(f"[INFO] Retrying LLM in {backoff} seconds...")
                    await asyncio.sleep(backoff)

        print(f"[WARN] LLM completely failed after {max_retries} attempts. Using default threshold: {self.LLM_DEFAULT_THRESHOLD}%")
        self.last_llm_threshold = self.LLM_DEFAULT_THRESHOLD
        return self.LLM_DEFAULT_THRESHOLD
            
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

        print("-" * 60)
        print(f"[INFO] {self.active_symbol} Spot:              ${spot:,.2f}")
        print(f"[INFO] {self.active_symbol} Perp:              ${perp:,.2f}")
        print(f"[INFO] Spread (premium):      {spread_pct:.4f}%")
        print(f"[INFO] Funding Rate:          {funding_rate_pct:.4f}% (per 8h)")
        print(f"[INFO] Estimated fees:       -{EXCHANGE_FEE_PCT:.2f}% (2 legs x 0.05%)")
        print(f"[INFO] Net Yield:             {net_yield_pct:.4f}%")
        print(f"[INFO] LLM Spread Threshold: {llm_threshold:.4f}% (minimum required)")
        print("-" * 60)

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
            print("[OK] Cash-and-Carry opportunity confirmed by LLM. Executing trade.")
            self._is_signing = True
            try:
                # --- Dynamic position sizing (fractional risk) ---
                available_eth    = self.get_available_capital()
                trade_size_eth   = available_eth * self.RISK_FRACTION
                trade_amount_wei = int(Web3.to_wei(trade_size_eth, "ether"))

                print(f"[INFO] Available capital  : {available_eth:.6f} ETH")
                print(f"[INFO] Position size ({int(self.RISK_FRACTION*100)}%): "
                      f"{trade_size_eth:.6f} ETH  ->  {trade_amount_wei} Wei (uint256)")

                self.create_trade_intent("LONG_SPOT_SHORT_PERP", self.active_symbol, trade_amount_wei)
                self.is_running = False
            finally:
                # Schedule flag reset
                import asyncio
                asyncio.create_task(self._clear_signing_flag(3))
        else:
            print("[INFO] Conditions not met. Waiting for better opportunity...")
            self._is_signing = False

        # --- Short-term memory: record this tick's outcome (rolling 5-entry window) ---
        tick_time = time.strftime("%H:%M:%S", time.localtime())
        decision  = "EXECUTE" if (spread_ok and yield_ok) else "SKIP"
        memory_entry = (
            f"[{tick_time}] {decision}: spread={spread_pct:.4f}%, "
            f"LLM_threshold={llm_threshold:.4f}%, net_yield={net_yield_pct:.4f}%"
        )
        self.short_term_memory.append(memory_entry)
        if len(self.short_term_memory) > 5:
            self.short_term_memory.pop(0)  # Evict oldest entry
        print(f"[MEM] {memory_entry}")

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
            private_key=self.tee_auth.private_key
        )

        print("[OK] TradeIntent signed successfully.")
        print(f"[INFO] Signature (hex): {signed_intent.signature.hex()}")

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
        risk_router_address = w3_client.to_checksum_address("0x0000000000000000000000000000000000000000")

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
            wallet_address = w3_client.to_checksum_address(self.tee_auth.address)
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

            tx = router_contract.functions.executeTrade(
                intent_tuple,
                signature_bytes
            ).build_transaction({
                'from':     wallet_address,
                'nonce':    nonce,
                'gas':      500000,
                'gasPrice': w3_client.eth.gas_price
            })

            # 4. Sign the transaction with the isolated TEE key
            signed_tx = w3_client.eth.account.sign_transaction(tx, private_key=self.tee_auth.private_key)

            print("[OK] Transaction built and signed. Ready for broadcast.")

            # 5. Broadcast (commented out until the real contract address is set)
            # tx_hash = w3_client.eth.send_raw_transaction(signed_tx.raw_transaction)
            # print(f"[OK] Transaction submitted to Risk Router. Hash: {w3_client.to_hex(tx_hash)}")

            print("[INFO] Simulation complete. Set the real Risk Router address to broadcast.")
            print("-" * 50)

        except Exception as e:
            print(f"[ERROR] Failed to submit transaction: {e}")
            print("-" * 50)

    # DELETED: buy_external_signals_x402 (Humo removed by Lead Developer)

    async def run_loop(self):
        print("[INFO] Starting Global Delta-Neutral Engine (Strykr Intelligence Pack)")
        while self.is_running:
            try:
                # --- Step 1: Multi-Asset Market Scan ---
                symbols = ["BTC", "ETH", "SOL"]
                scan_results = await self.scanner.get_batch_spreads(symbols)
                self._last_scan_results = scan_results

                # Use BTC as the volatility benchmark for the circuit breaker
                btc_data = next((r for r in scan_results if r["symbol"] == "BTC"), None)
                if btc_data:
                    self.check_circuit_breaker(btc_data["spot"], self.last_price)
                    self.last_price = btc_data["spot"]

                if self.circuit_breaker_tripped:
                    print("[HALT] Circuit breaker active. Standing by...")
                    await asyncio.sleep(10)
                    continue

                # --- Step 2: Risk Analysis per Opportunity ---
                # We analyze the candidate set to find the best spread
                base_threshold = float(os.getenv("MIN_SPREAD_THRESHOLD", "0.08"))
                
                # --- Step 3: AI Risk Enrichment ---
                # Use benchmark data for LLM context
                llm_threshold = await self.analyze_market_context_with_llm(
                    btc_data["spot"] if btc_data else 50000, 
                    btc_data["perp"] if btc_data else 50040, 
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

                # Professionalized loop delay
                await asyncio.sleep(5)

            except Exception as e:
                print(f"[CRITICAL] Unhandled global exception in run_loop: {e}. Surviving...")
                await asyncio.sleep(5)

if __name__ == "__main__":
    engine = DeltaNeutralEngine()
    asyncio.run(engine.run_loop())