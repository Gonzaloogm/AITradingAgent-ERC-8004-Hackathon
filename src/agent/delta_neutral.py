import time
import os
import sys
import requests
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

    def analyze_spread(self, spot, perp, funding_rate):
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
        print(f"📊 BTC Spot:          ${spot:,.2f}")
        print(f"📊 BTC Perp:          ${perp:,.2f}")
        print(f"📈 Spread (prima):    {spread_pct:.4f}%")
        print(f"💸 Funding Rate:      {funding_rate_pct:.4f}% (por 8h)")
        print(f"🏦 Comisiones est.:  -{EXCHANGE_FEE_PCT:.2f}% (2 legs x 0.05%)")
        print(f"✨ Rendimiento Neto:  {net_yield_pct:.4f}%")
        print("-" * 60)

        # El bot sólo opera si el rendimiento neto es estrictamente positivo
        if net_yield_pct > 0.00:
            print("🚀 ¡Oportunidad de Cash-and-Carry detectada! Rendimiento neto positivo.")

            # --- Dynamic position sizing (fractional risk) ---
            available_eth   = self.get_available_capital()
            trade_size_eth  = available_eth * self.RISK_FRACTION
            # Convert to Wei so the EIP-712 uint256 field receives a plain integer
            trade_amount_wei = int(Web3.to_wei(trade_size_eth, "ether"))

            print(f"📐 Capital disponible: {available_eth:.6f} ETH")
            print(f"📐 Tamaño de posición ({int(self.RISK_FRACTION*100)}%): "
                  f"{trade_size_eth:.6f} ETH  →  {trade_amount_wei} Wei (uint256)")

            self.create_trade_intent("LONG_SPOT_SHORT_PERP", "BTC/USDC", trade_amount_wei)
            self.is_running = False
        else:
            print("⏳ Rendimiento neto nulo o negativo. Esperando mejor oportunidad...")

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
    def run_loop(self):
        print("🤖 Iniciando Agente Delta-Neutral (Cash-and-Carry) con datos en vivo...")
        while self.is_running:
            spot, perp, funding_rate = self.get_market_prices()

            # --- Safety check: evaluate volatility before any trade logic ---
            self.check_circuit_breaker(spot, self.last_price)
            self.last_price = spot  # Always update reference price

            if self.circuit_breaker_tripped:
                print("🛑 CIRCUIT BREAKER activo — omitiendo evaluación de trades.")
                print("   Reinicia el agente o establece self.circuit_breaker_tripped = False para continuar.")
                self.is_running = False  # Stop the loop; requires manual intervention
                break

            self.analyze_spread(spot, perp, funding_rate)
            time.sleep(3) # Pausa de 3 segundos para no saturar la API

if __name__ == "__main__":
    engine = DeltaNeutralEngine()
    engine.run_loop()