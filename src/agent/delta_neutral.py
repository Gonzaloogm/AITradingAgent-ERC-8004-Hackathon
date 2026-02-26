import time
import os
import sys
import requests
from dotenv import load_dotenv
from eth_account.messages import encode_typed_data
from web3.auto import w3
from web3 import Web3

# Explicitly load .env from the project root (two levels up from src/agent/)
_project_root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
load_dotenv(os.path.join(_project_root, '.env'))

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from tee_auth import TEEAuthenticator

class DeltaNeutralEngine:
    def __init__(self):
        self.is_running = True
        
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

    def get_market_prices(self):
        # Conexión real a la API pública de Binance
        try:
            # Obtener precio Spot (Al contado)
            spot_url = "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
            spot_price = float(requests.get(spot_url).json()["price"])

            # Obtener precio Perpetual (Futuros)
            perp_url = "https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT"
            perp_price = float(requests.get(perp_url).json()["price"])

            return spot_price, perp_price
        except Exception as e:
            print(f"⚠️ Error de conexión: {e}. Usando datos de respaldo.")
            return 50000.00, 50030.00

    def analyze_spread(self, spot, perp):
        # Calculamos la diferencia de precio real
        spread = perp - spot
        spread_pct = (spread / spot) * 100
        
        print(f"📊 BTC Spot: ${spot:.2f} | BTC Perp: ${perp:.2f} | Spread: {spread_pct:.4f}%")

        # Ajustamos el umbral para el mercado real (ej: buscamos un spread > $2)
        if spread > 2.00: 
            print("🚀 ¡Oportunidad de Arbitraje detectada en el mercado real!")
            self.create_trade_intent("LONG_SPOT_SHORT_PERP", "BTC/USDC", 1000000)
            self.is_running = False 
        else:
            print("⏳ Diferencial muy bajo. Esperando...")

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
        print("🤖 Iniciando Agente Delta-Neutral con datos en vivo...")
        while self.is_running:
            spot, perp = self.get_market_prices()
            self.analyze_spread(spot, perp)
            time.sleep(3) # Pausa de 3 segundos para no saturar la API

if __name__ == "__main__":
    engine = DeltaNeutralEngine()
    engine.run_loop()