import asyncio
import json
import time
import os
import sys
import requests
import openai
from dotenv import load_dotenv
from eth_account.messages import encode_typed_data
from web3.auto import w3
from web3 import Web3

#python3 src/agent/delta_neutral.py
# Explicitly load .env from the project root (two levels up from src/agent/)
_project_root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
load_dotenv(os.path.join(_project_root, '.env'))

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from tee_auth import TEEAuthenticator

class DeltaNeutralEngine:
    def __init__(self):
        self.is_running = True
        self.circuit_breaker_tripped = False  # Safety flag — halts trading on extreme volatility
        self.last_price = None                # Tracks the previous spot price for swing detection

        # ------------------------------------------------------------------
        # PORTFOLIO HEALTH / DRAWDOWN CONTROL
        # ------------------------------------------------------------------
        self.initial_capital      = 10.0   # ETH — synced with get_available_capital() mock
        self.current_equity       = self.initial_capital
        self.peak_equity          = self.initial_capital
        self.max_allowable_drawdown = 0.05  # 5% maximum drawdown from peak

        print("🔑 Inicializando entorno seguro TEE...")
        private_key = os.getenv("PRIVATE_KEY")
        if not private_key:
            raise EnvironmentError(
                "PRIVATE_KEY no está definida en el archivo .env del proyecto."
            )
        self.tee_auth = TEEAuthenticator(
            domain="localhost:8000",
            salt=os.getenv("AGENT_SALT", "default_salt"),
            use_tee=False,
            private_key=private_key
        )

        # ------------------------------------------------------------------
        # LLM CLIENT  (RedPill-compatible / OpenAI-compatible endpoint)
        # ------------------------------------------------------------------
        api_key = os.getenv("REDPILL_API_KEY") or os.getenv("OPENAI_API_KEY")
        base_url = os.getenv("OPENAI_BASE_URL", "https://api.red-pill.ai/v1")
        if not api_key:
            print("⚠️  REDPILL_API_KEY / OPENAI_API_KEY no definida. "
                  "El LLM usará el umbral por defecto en cada tick.")
        self.llm_client = openai.AsyncOpenAI(
            api_key=api_key or "no-key",
            base_url=base_url,
        )
        self.llm_model = os.getenv("LLM_MODEL", "gpt-4o")

    # ------------------------------------------------------------------
    # CIRCUIT BREAKER
    # ------------------------------------------------------------------
    CIRCUIT_BREAKER_THRESHOLD_PCT = 5.0  # Max allowed price swing between checks (%)

    def check_circuit_breaker(self, current_price, last_price):
        """Trip the circuit breaker if BTC spot swings more than 5% in one loop cycle."""
        if last_price is None:
            return  # No previous reference — skip on the very first tick

        swing_pct = abs((current_price - last_price) / last_price) * 100

        print(f"🔍 Comprobación de volatilidad: swing entre ticks = {swing_pct:.4f}%")

        if swing_pct > self.CIRCUIT_BREAKER_THRESHOLD_PCT:
            self.circuit_breaker_tripped = True
            print("=" * 60)
            print("🚨 CIRCUIT BREAKER TRIPPED: Trading Halted")
            print(f"   Causa: variación de precio de {swing_pct:.2f}% "
                  f"(umbral: {self.CIRCUIT_BREAKER_THRESHOLD_PCT}%)")
            print(f"   Precio anterior: ${last_price:,.2f}  →  Precio actual: ${current_price:,.2f}")
            print("   Reinicia manualmente self.circuit_breaker_tripped = False para reanudar.")
            print("=" * 60)

    def update_equity_and_drawdown(self, simulated_pnl: float) -> float:
        """Update portfolio equity with the latest simulated P&L, refresh the
        high-water mark, and compute the current drawdown from peak.

        Args:
            simulated_pnl: Profit or loss (in ETH) for the latest trade cycle.

        Returns:
            current_drawdown_pct: Drawdown from peak as a positive fraction
            (e.g. 0.03 = 3%). Trips the circuit breaker if ≥ max_allowable_drawdown.
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

        print(f"📉 Portfolio — Equity: {self.current_equity:.6f} ETH "
              f"| Peak: {self.peak_equity:.6f} ETH "
              f"| Drawdown: {current_drawdown_pct * 100:.3f}% "
              f"(límite: {self.max_allowable_drawdown * 100:.1f}%)")

        # 4. Trip circuit breaker permanently if drawdown exceeds limit
        if current_drawdown_pct >= self.max_allowable_drawdown:
            self.circuit_breaker_tripped = True
            print("#" * 60)
            print("🚨 CRITICAL — DRAWDOWN LIMIT BREACHED: Trading Halted Permanently")
            print(f"   Drawdown actual:  {current_drawdown_pct * 100:.3f}%")
            print(f"   Límite máximo:   {self.max_allowable_drawdown * 100:.1f}%")
            print(f"   Equity actual:    {self.current_equity:.6f} ETH")
            print(f"   Peak equity:      {self.peak_equity:.6f} ETH")
            print("   El agente NO operará más hasta reiniciarse manualmente.")
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
                  value = 525,  valueDecimals = 2   =>  represents 5.25 %

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
            "agentId":       1,            # matches TradeIntent.agentId
            "tradeId":       trade_id,
            "value":         abs_value_int,  # uint256 fixed-point integer
            "valueDecimals": VALUE_DECIMALS, # scale factor
            "isProfit":      is_profitable,  # sign flag (bool)
            # --- Metadata tags ---
            "tag1": "tradingYield",
            "tag2": "deltaNeural-cash-carry",
            "tag3": "BTC-USDC",
            # --- Portfolio audit fields ---
            "currentEquity": round(self.current_equity, 8),
            "peakEquity":    round(self.peak_equity, 8),
            "drawdownPct":   round(
                (self.peak_equity - self.current_equity) / self.peak_equity * 100, 4
            ) if self.peak_equity > 0 else 0.0,
            "timestamp": int(time.time()),
        }

        # --- Pretty-print simulation of the on-chain submission ---
        sep = "-" * 60
        print(sep)
        print("📜  ERC-8004 REPUTATION FEEDBACK — SIMULATED SUBMISSION")
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
        print("  ⛓️  (Simulacion completada. Conecta el Reputation Registry")
        print("       contract para enviar esto on-chain.)")
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

            print(f"💼 Balance on-chain: {balance_eth:.6f} ETH  "
                  f"(dirección: {wallet_address})")
            return float(balance_eth)

        except Exception as e:
            mock_balance = 10.0  # ETH — used for local / offline testing
            print(f"⚠️  No se pudo consultar el balance on-chain ({e}). "
                  f"Usando balance simulado: {mock_balance} ETH")
            return mock_balance

    # ------------------------------------------------------------------
    # AI MARKET CONTEXT ANALYZER
    # ------------------------------------------------------------------
    LLM_DEFAULT_THRESHOLD = 0.10  # % fallback if LLM is unavailable

    async def analyze_market_context_with_llm(
        self, spot_price: float, perp_price: float,
        funding_rate: float, recent_volatility: float
    ) -> float:
        """Ask the LLM to act as a quant risk manager and return the minimum
        spread (%) required to justify opening a cash-and-carry position given
        current market conditions.

        Returns:
            required_spread_threshold (float, range 1.5–5.0 expressed as %,
            e.g. 0.15 means 0.15%).
        """
        spread_pct = ((perp_price - spot_price) / spot_price) * 100
        funding_pct = funding_rate * 100

        prompt = f"""\
You are a quantitative risk manager evaluating a BTC delta-neutral
cash-and-carry trade opportunity. Analyze the following real-time
market metrics and determine the minimum required spread threshold
that justifies opening the position given current slippage and
volatility risk.

Market metrics:
- BTC Spot price:       ${spot_price:,.2f}
- BTC Perp price:       ${perp_price:,.2f}
- Current spread:       {spread_pct:.4f}%
- Funding rate (8h):    {funding_pct:.4f}%
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

        try:
            print("🧠 Consultando al LLM para obtener el umbral de spread dinámico...")
            response = await self.llm_client.chat.completions.create(
                model=self.llm_model,
                messages=[
                    {"role": "system",
                     "content": "You are a precise quantitative risk manager. "
                                "You only respond with valid JSON."},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=64,
            )
            raw = response.choices[0].message.content.strip()
            # Strip markdown fences if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            data = json.loads(raw)
            threshold = float(data["required_spread_threshold"])
            # Clamp to allowed range
            threshold = max(0.015, min(threshold, 0.20))
            print(f"🧠 LLM threshold recibido: {threshold:.4f}% "
                  f"(spread actual: {spread_pct:.4f}%)")
            return threshold

        except Exception as e:
            print(f"⚠️  LLM no disponible ({e}). "
                  f"Usando umbral por defecto: {self.LLM_DEFAULT_THRESHOLD}%")
            return self.LLM_DEFAULT_THRESHOLD

    def get_market_prices(self):
        # Conexión real a la API pública de Binance
        try:
            # Obtener precio Spot (Al contado)
            spot_url = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
            spot_price = float(requests.get(spot_url).json()["price"])

            # Obtener precio Perpetual (Futuros)
            perp_url = "https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT"
            perp_price = float(requests.get(perp_url).json()["price"])

            # Obtener la tasa de financiación actual (Funding Rate) del mercado perpetuo
            funding_url = "https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT"
            funding_data = requests.get(funding_url).json()
            last_funding_rate = float(funding_data["lastFundingRate"])

            return spot_price, perp_price, last_funding_rate
        except Exception as e:
            print(f"⚠️ Error de conexión: {e}. Usando datos de respaldo.")
            return 50000.00, 50030.00, 0.0001

    def analyze_spread(self, spot, perp, funding_rate, llm_threshold: float):
        """Evaluate market conditions and execute a trade if both the
        AI-determined spread threshold AND net yield criteria are met."""
        # --- Componentes del rendimiento esperado ---
        EXCHANGE_FEE_PCT = 0.10  # 0.05% por cada leg (entrada + salida) = 0.10% total

        # 1. Spread entre perpetuo y spot (prima del mercado)
        spread = perp - spot
        spread_pct = (spread / spot) * 100

        # 2. Tasa de financiación expresada en porcentaje
        funding_rate_pct = funding_rate * 100

        # 3. Rendimiento neto = spread + funding rate - comisiones estimadas
        net_yield_pct = spread_pct + funding_rate_pct - EXCHANGE_FEE_PCT

        print("-" * 60)
        print(f"📊 BTC Spot:              ${spot:,.2f}")
        print(f"📊 BTC Perp:              ${perp:,.2f}")
        print(f"📈 Spread (prima):        {spread_pct:.4f}%")
        print(f"💸 Funding Rate:          {funding_rate_pct:.4f}% (por 8h)")
        print(f"🏦 Comisiones est.:      -{EXCHANGE_FEE_PCT:.2f}% (2 legs x 0.05%)")
        print(f"✨ Rendimiento Neto:      {net_yield_pct:.4f}%")
        print(f"🧠 LLM Spread Threshold: {llm_threshold:.4f}% (mínimo requerido)")
        print("-" * 60)

        # Gate 1: spread must exceed the LLM-determined minimum threshold
        spread_ok = spread_pct >= llm_threshold
        # Gate 2: net yield (after funding + fees) must be strictly positive
        yield_ok  = net_yield_pct > 0.00

        print(f"   ✔ Spread ≥ LLM threshold? {'SÍ' if spread_ok else 'NO'} "
              f"({spread_pct:.4f}% vs {llm_threshold:.4f}%)")
        print(f"   ✔ Net yield > 0?          {'SÍ' if yield_ok  else 'NO'} "
              f"({net_yield_pct:.4f}%)")

        if spread_ok and yield_ok:
            print("🚀 ¡Oportunidad de Cash-and-Carry confirmada por el LLM!")

            # --- Dynamic position sizing (fractional risk) ---
            available_eth    = self.get_available_capital()
            trade_size_eth   = available_eth * self.RISK_FRACTION
            trade_amount_wei = int(Web3.to_wei(trade_size_eth, "ether"))

            print(f"📐 Capital disponible: {available_eth:.6f} ETH")
            print(f"📐 Tamaño de posición ({int(self.RISK_FRACTION*100)}%): "
                  f"{trade_size_eth:.6f} ETH  →  {trade_amount_wei} Wei (uint256)")

            self.create_trade_intent("LONG_SPOT_SHORT_PERP", "BTC/USDC", trade_amount_wei)
            self.is_running = False
        else:
            print("⏳ Condiciones no satisfechas. Esperando mejor oportunidad...")

    def create_trade_intent(self, action, market, amount):
        print(f"📝 Construyendo TradeIntent (EIP-712)...")
        
        domain_data = {
            "name": "HackathonRiskRouter",
            "version": "1",
            "chainId": 11155111, 
            "verifyingContract": "0x0000000000000000000000000000000000000000" # Se actualizará con el contrato real del hackathon
        }

        message_types = {
            "TradeIntent": [
                {"name": "agentId", "type": "uint256"},
                {"name": "action", "type": "string"},
                {"name": "market", "type": "string"},
                {"name": "amount", "type": "uint256"},
                {"name": "timestamp", "type": "uint256"}
            ]
        }

        message_data = {
            "agentId": 1, 
            "action": action,
            "market": market,
            "amount": amount,
            "timestamp": int(time.time())
        }

        signable_message = encode_typed_data(domain_data, message_types, message_data)
        
        signed_intent = w3.eth.account.sign_message(
            signable_message, 
            private_key=self.tee_auth.private_key
        )

        print("✅ ¡TradeIntent firmado!")
        print(f"✍️ Firma (Hex): {signed_intent.signature.hex()}")
        
        # Siguiente paso del hackathon: Enviar esto a la blockchain
        self.submit_to_risk_router(message_data, signed_intent.signature.hex())

    def submit_to_risk_router(self, intent_data, signature):
        print("-" * 50)
        print("🌐 INICIANDO CONEXIÓN ON-CHAIN AL RISK ROUTER...")

        # 1. Conectar al nodo RPC (Tu agente usará la red que definiste en el.env)
        rpc_url = os.getenv("RPC_URL", "https://sepolia.base.org")
        w3_client = Web3(Web3.HTTPProvider(rpc_url))

        if not w3_client.is_connected():
            print("❌ Error: No se pudo conectar a la red blockchain.")
            return

        print(f"✅ Conectado a la red L2. Bloque actual: {w3_client.eth.block_number}")

        # -------------------------------------------------------------------
        # ⚠️ IMPORTANTE PARA EL HACKATHON:
        # Aquí deberás poner la dirección real que LabLab proporcione para el Risk Router
        risk_router_address = w3_client.to_checksum_address("0x0000000000000000000000000000000000000000")
        
        # Este es un ABI (mapa del contrato) estándar simulado para el hackathon. 
        # Deberás actualizarlo con el ABI oficial si tiene más parámetros.
        risk_router_abi = [
            {
                "inputs": [
                    {
                        "components": [
                            {"name": "agentId", "type": "uint256"},
                            {"name": "action", "type": "string"},
                            {"name": "market", "type": "string"},
                            {"name": "amount", "type": "uint256"},
                            {"name": "timestamp", "type": "uint256"}
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
        # -------------------------------------------------------------------

        try:
            # 2. Instanciar el contrato del Risk Router
            router_contract = w3_client.eth.contract(address=risk_router_address, abi=risk_router_abi)

            # 3. Preparar los datos de envío (la wallet del TEE es quien paga el gas para enviar la orden)
            wallet_address = w3_client.to_checksum_address(self.tee_auth.address)
            nonce = w3_client.eth.get_transaction_count(wallet_address)

            print("⏳ Construyendo la transacción para la EVM...")
            
            # Formatear los datos del intent exactamente como espera el contrato (en forma de tupla)
            intent_tuple = (
                intent_data["agentId"],
                intent_data["action"],
                intent_data["market"],
                intent_data["amount"],
                intent_data["timestamp"]
            )

            # Construir la transacción llamando a la función executeTrade del contrato
            tx = router_contract.functions.executeTrade(
                intent_tuple,
                signature
            ).build_transaction({
                'from': wallet_address,
                'nonce': nonce,
                'gas': 500000, # Límite de gas estimado
                'gasPrice': w3_client.eth.gas_price
            })

            # 4. Firmar la transacción de envío a la red (usando la clave aislada)
            signed_tx = w3_client.eth.account.sign_transaction(tx, private_key=self.tee_auth.private_key)

            print("🚀 Transacción construida y firmada. Lista para broadcast.")
            
            # 5. Ejecución final (Comentado por seguridad hasta que pongas el contrato real)
            # tx_hash = w3_client.eth.send_raw_transaction(signed_tx.raw_transaction)
            # print(f"✅ ¡Transacción enviada al Risk Router! Hash: {w3_client.to_hex(tx_hash)}")
            
            print("⚠️ (Modo simulación completado. Añade la dirección del Risk Router para enviar dinero de prueba).")
            print("-" * 50)

        except Exception as e:
            print(f"❌ Error al enviar la transaccsuión: {e}")
            print("-" * 50)
    async def run_loop(self):
        print("🤖 Iniciando Agente Delta-Neutral AI (Cash-and-Carry) con datos en vivo...")
        while self.is_running:
            spot, perp, funding_rate = self.get_market_prices()

            # --- Safety check: evaluate volatility before any trade logic ---
            recent_volatility = (
                abs((spot - self.last_price) / self.last_price) * 100
                if self.last_price is not None else 0.0
            )
            self.check_circuit_breaker(spot, self.last_price)
            self.last_price = spot  # Always update reference price

            if self.circuit_breaker_tripped:
                print("🛑 CIRCUIT BREAKER activo — omitiendo evaluación de trades.")
                print("   Reinicia el agente o establece self.circuit_breaker_tripped = False para continuar.")
                self.is_running = False
                break

            # --- AI: determine dynamic spread threshold for this tick ---
            llm_threshold = await self.analyze_market_context_with_llm(
                spot, perp, funding_rate, recent_volatility
            )

            self.analyze_spread(spot, perp, funding_rate, llm_threshold)
            await asyncio.sleep(3)  # Non-blocking pause

if __name__ == "__main__":
    engine = DeltaNeutralEngine()
    asyncio.run(engine.run_loop())