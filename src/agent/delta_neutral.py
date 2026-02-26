import time
import os
from eth_account.messages import encode_typed_data

# Importamos el módulo seguro del TEE que viene en tu plantilla
from tee_auth import TEEAuthenticator

class DeltaNeutralEngine:
    def __init__(self):
        self.target_spread_percentage = 0.05 
        self.is_running = True
        
        # Inicializamos la conexión segura a la billetera de tu agente
        print("🔑 Conectando con la billetera del Agente...")
        # En modo local (use_tee=False) se requiere una clave privada.
        # Exporta: export AGENT_PRIVATE_KEY="0x<tu_clave_privada>"
        # (nunca comitas la clave real al repositorio)
        private_key = os.getenv("AGENT_PRIVATE_KEY")
        if not private_key:
            raise EnvironmentError(
                "AGENT_PRIVATE_KEY no está definida. "
                "Ejecuta: export AGENT_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff8"
            )

        self.tee_auth = TEEAuthenticator(
            domain="localhost:8000",
            salt=os.getenv("AGENT_SALT", "default_salt"),
            use_tee=False,  # False para local, True cuando despliegues en Phala Cloud
            private_key=private_key
        )

    def get_market_prices(self):
        # Simulación de precios para la prueba
        return 50000.00, 50030.00 

    def analyze_spread(self, spot, perp):
        spread = perp - spot
        if spread > 15.00: 
            print("\n🚀 ¡Oportunidad de Arbitraje detectada!")
            self.create_trade_intent("LONG_SPOT", "SHORT_PERP")
            self.is_running = False # Detenemos el bucle tras la primera firma para que lo veas claro
        else:
            print("⏳ Diferencial muy bajo. Esperando...")

    def create_trade_intent(self, leg1, leg2):
        print(f"📝 Construyendo TradeIntent (EIP-712) para el Risk Router...")
        
        # 1. Definir el dominio del contrato (Risk Router del Hackathon)
        domain_data = {
            "name": "HackathonRiskRouter",
            "version": "1",
            "chainId": 11155111, # Sepolia Chain ID (EIP-155 obligatorio para el hackathon)
            "verifyingContract": "0x0000000000000000000000000000000000000000" # Aquí irá la dirección oficial del router
        }

        # 2. Definir los tipos de datos exactos del TradeIntent
        message_types = {
            "TradeIntent": [
                {"name": "agentId", "type": "uint256"},
                {"name": "action", "type": "string"},
                {"name": "market", "type": "string"},
                {"name": "amount", "type": "uint256"},
                {"name": "timestamp", "type": "uint256"}
            ]
        }

        # 3. Construir el mensaje con los datos de tu trade
        message_data = {
            "agentId": 1, 
            "action": f"{leg1}_{leg2}",
            "market": "WBTC/USDC",
            "amount": 1000000000, # Cantidad simulada
            "timestamp": int(time.time())
        }

        # 4. Empaquetar los datos tipados
        signable_message = encode_typed_data(domain_data, message_types, message_data)
        
        # 5. Firmar criptográficamente usando la clave privada / TEE
        # TEEAuthenticator expone 'account' (eth_account.Account), no web3
        from eth_account import Account
        signed_intent = Account.sign_message(
            signable_message,
            private_key=self.tee_auth.private_key
        )

        print(f"✅ ¡TradeIntent Firmado con éxito!")
        print(f"Firma criptográfica resultante: {signed_intent.signature.hex()}")
        print("Esta es la firma que el Risk Router verificará on-chain.")

    def run_loop(self):
        print("Iniciando motor Neutral a Delta...")
        while self.is_running:
            spot, perp = self.get_market_prices()
            self.analyze_spread(spot, perp)
            time.sleep(2) 

if __name__ == "__main__":
    engine = DeltaNeutralEngine()
    engine.run_loop()