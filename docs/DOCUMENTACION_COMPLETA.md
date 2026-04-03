# ERC-8004 TEE Trading Agent - Documentación Completa

## Resumen Ejecutivo

Agente de trading algorítmico **delta-neutral** con identidad on-chain verificable (ERC-8004), ejecutándose en un Entorno de Ejecución Confiable (TEE) Intel TDX. Combina trading algorítmico, IA conversacional y attestación criptográfica en una arquitectura modular.

---

## Tabla de Contenidos

1. [Arquitectura](#arquitectura)
2. [Componentes Principales](#componentes-principales)
3. [Configuración y Despliegue](#configuración-y-despliegue)
4. [API Endpoints](#api-endpoints)
5. [Estrategia de Trading](#estrategia-de-trading)
6. [Seguridad TEE](#seguridad-tee)
7. [Contratos Desplegados](#contratos-desplegados)

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA DE PRESENTACIÓN                          │
│  Funding Page │ Dashboard │ Chat Interface │ Trust Center       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA DE SERVIDOR (FastAPI)                    │
│  - Gestión de sesiones │ Endpoints ERC-8004 │ TEE Attestation   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CAPA DE AGENTES                             │
│  BaseAgent │ ChatAgent │ ServerAgent │ DeltaNeutralEngine       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA DE INFRAESTRUCTURA                       │
│  TEE Auth │ Registry Client │ Subgraph │ EIP-712 Signer        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CAPA EXTERNA                               │
│  Ethereum Sepolia │ The Graph │ RedPill AI │ Kraken/Binance     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Componentes Principales

### 1. DeltaNeutralEngine (`src/agent/delta_neutral.py`)

Motor de trading que implementa estrategia **cash-and-carry** delta-neutral:

**Características:**
- **Análisis de Spread**: Calcula diferencial entre spot y perpetuo
- **Umbral LLM Dinámico**: IA determina spread mínimo aceptable (0.015-0.20%)
- **Circuit Breaker**: Detiene trading en volatilidad >5% inter-tick
- **Drawdown Control**: Límite 5% desde peak de equity
- **Position Sizing**: 10% del capital por trade

**Flujo de Decisión:**
```
1. Obtener precios (Kraken CLI → Binance API fallback)
2. Verificar circuit breaker (volatilidad)
3. Consultar LLM para umbral dinámico
4. Opcional: Comprar señales externas vía x402
5. Calcular spread neto (spread + funding - fees)
6. Ejecutar si: spread >= umbral Y net_yield > 0
7. Generar artifact ERC-8004
8. Enviar feedback reputación on-chain
```

**Mecanismo de Seguridad:**
```python
# Circuit Breaker por volatilidad
if swing_pct > 5.0:
    circuit_breaker_tripped = True

# Drawdown máximo
if current_drawdown >= 0.05:
    circuit_breaker_tripped = True  # Halts permanently
```

### 2. ChatAgent (`src/agent/chat_agent.py`)

Interfaz conversacional usando Anthropic SDK con backend RedPill:

**Herramientas Disponibles:**

| Herramienta | Descripción |
|-------------|-------------|
| `get_wallet_info` | Dirección, balance y chain |
| `sign_message` | Firmar mensaje con clave TEE |
| `verify_signature` | Verificar firma EIP-191 |
| `generate_attestation` | Generar prueba TEE Intel TDX |
| `get_agent_card` | Metadatos ERC-8004 |
| `get_registration_status` | Estado de registro on-chain |
| `get_chain_config` | Configuración blockchain |
| `get_reputation` | Consultar reputación |
| `submit_feedback` | Enviar feedback on-chain |
| `run_python` | Ejecutar Python sandboxed |
| `run_shell` | Ejecutar comandos shell |

### 3. TEEAuthenticator (`src/agent/tee_auth.py`)

Módulo de autenticación TEE usando dstack SDK:

**Funcionalidades:**
- **Derivación Determinística de Claves**: Path `wallet/erc8004-{salt}`
- **Attestación Remota**: `get_quote()` con datos de aplicación
- **Firma EIP-712**: Signatura de mensajes estructurados
- **Modo Desarrollo**: Fallback a private key sin TEE

**Proceso de Derivación:**
```
1. Path: "wallet/erc8004-{AGENT_SALT}"
2. Purpose: AGENT_DOMAIN
3. tee_client.get_key(path, purpose) → key bytes
4. Convertir a formato eth_account
5. Derivar address: 0x{40 hex chars}
```

### 4. RegistryClient (`src/agent/registry.py`)

Cliente para interacción con contratos ERC-8004:

**Contratos Soportados:**
- **IdentityRegistry**: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- **ReputationRegistry**: `0x8004B663056A597Dffe9eCcC1965A193B7388713`

**Operaciones Principales:**
```python
# Registro
await registry.register_agent(domain, agent_address, agent_card)

# Consulta
await registry.check_agent_registration(agent_address)
await registry.get_agent_info(agent_id)
await registry.get_reputation(agent_id)

# Reputación
await registry.give_feedback(agent_id, value, value_decimals, tag1, tag2, ...)
```

### 5. SubgraphClient (`src/agent/subgraph_client.py`)

Cliente GraphQL para consultas a The Graph:

**Queries Soportadas:**
- `get_agent_by_id(agent_id)`: Información de agente
- `get_agent_by_owner(owner_address)`: Buscar por propietario
- `get_agent_reputation(agent_id)`: Estadísticas y feedback reciente
- `list_agents(limit, offset)`: Listado paginado

**Caché:** TTL 30 segundos por defecto

### 6. ServerAgent (`deployment/local_agent_server.py`)

Servidor FastAPI principal con endpoints ERC-8004:

**Características:**
- Servidor HTTP con FastAPI/Uvicorn
- Endpoints estándar ERC-8004 (`/agent.json`, `/.well-known/agent-card.json`)
- Gestión de sesiones de chat
- Preparación de attestation TEE
- Integración con DeltaNeutralEngine

---

## Configuración y Despliegue

### Variables de Entorno

```bash
# Requeridas
AGENT_SALT=unique-secret-salt
REDPILL_API_KEY=sk-your-key
SUBGRAPH_API_KEY=your-graph-key

# Blockchain
CHAIN_NAME=eth-sepolia
RPC_URL=https://1rpc.io/sepolia
IDENTITY_REGISTRY_ADDRESS=0x8004A818BFB912233c491871b3d84c89A494BD9e
REPUTATION_REGISTRY_ADDRESS=0x8004B663056A597Dffe9eCcC1965A193B7388713

# IA Model
ANTHROPIC_MODEL=openai/gpt-oss-120b
FREE_LLM_API_KEY=your-llm-key
LLM_BASE_URL=https://api.aimlapi.com/v1
LLM_MODEL=meta-llama/llama-3-8b-instruct

# Trading
TRADING_SYMBOL_API=BTCUSDT
TRADING_SYMBOL_MARKET=BTC/USDC
```

### Desarrollo Local

```bash
# Clonar y configurar
git clone https://github.com/YOUR_USERNAME/AITradingAgent-ERC-8004-Hackathon.git
cd AITradingAgent-ERC-8004-Hackathon
cp .env.example .env

# Instalar dependencias
pip3 install -e .

# Ejecutar servidor
python3 deployment/local_agent_server.py
```

Acceder a: `http://localhost:8000`

### Producción (Phala Cloud)

```bash
# Commit producción
git add . && git commit -m "Production ready"
git push origin main

# Deploy a Phala
npx phala deploy -n my-tee-agent -c docker-compose.yml -e .env
```

---

## API Endpoints

### ERC-8004 Estándar

| Endpoint | Descripción |
|----------|-------------|
| `GET /agent.json` | Registration-v1 format |
| `GET /.well-known/agent-card.json` | A2A agent card |
| `GET /.well-known/agent-registration.json` | Domain verification |

### Dashboard y Registro

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/dashboard` | GET | UI de registro |
| `/developer` | GET | Chat interface |
| `/api/status` | GET | Estado del agente |
| `/api/register` | POST | Registrar on-chain |
| `/api/metadata/update` | POST | Actualizar metadatos |

### Chat Interface

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/chat` | POST | Enviar mensaje al AI |
| `/api/quick-action` | POST | Ejecutar herramienta directamente |
| `/api/session/new` | POST | Crear nueva sesión |
| `/api/session/{id}/history` | GET | Obtener historial |

### Reputación

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/reputation` | GET | Obtener reputación |
| `/api/reputation/submit-initial` | POST | Inicializar reputación |

### TEE Attestation

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/tee/prepare` | POST | Preparar attestation |
| `/api/tee/status` | GET | Estado de preparación TEE |

---

## Estrategia de Trading

### Concepto Delta-Neutral

Estrategia **cash-and-carry** que aprovecha el diferencial entre:
- **Mercado Spot**: Precio actual del activo
- **Mercado Perpetuo**: Precio del contrato futuro sin vencimiento

### Mecánica

```
Posición LONG Spot:  Compra 1 BTC en mercado spot
Posición SHORT Perp: Vende 1 BTC en contrato perpetuo

Resultado: Delta-neutral (sin exposición direccional)

Profit = Spread (perp - spot) + Funding Rate - Fees
```

### Criterios de Entrada

| Condición | Valor | Descripción |
|-----------|-------|-------------|
| Spread mínimo | LLM dinámico (0.015-0.20%) | Determinado por IA |
| Net Yield | > 0% | Spread + Funding - 0.10% fees |
| Volatilidad inter-tick | < 5% | Circuit breaker |
| Drawdown actual | < 5% | Desde peak equity |

### Artifact ERC-8004 por Trade

Cada trade genera un artifact JSON:
```json
{
  "timestamp": 1234567890,
  "protocol": "ERC-8004",
  "registry": "ValidationRegistry",
  "execution": {
    "trade_intent": { ... },
    "signature": "0x..."
  }
}
```

Hash keccak-256 del artifact simula upload a IPFS.

---

## Seguridad TEE

### Intel TDX (Trust Domain Extensions)

**Protecciones:**
- Código en ejecución aislado del hypervisor
- Memoria encriptada con claves del CPU
- Attestación remota verificable criptográficamente

**Componentes:**

| Componente | Función |
|------------|---------|
| TD (Trust Domain) | VM confidencial aislada |
| TDX Module | Firmware Intel que gestiona TDs |
| Quote | Atestación firmada por CPU |
| Event Log | Traza de medición de código |

### dstack SDK

Plataforma de orquestación TEE:

```python
# Inicialización
tee_client = DstackClient()  # /var/run/dstack.sock

# Derivación de clave
key = tee_client.get_key(path, purpose)

# Attestación
quote = tee_client.get_quote(application_data)
```

### Verificación de Attestation

**Verificación Local (ligera):**
```bash
python verify_ai_attestation.py attestation.json
```

Checks:
1. Estructura completa (type, measurements, signature, timestamp)
2. Nonce presente (64 hex chars)
3. Timestamp < 10 minutos
4. TEE type válido

**Verificación Independiente (trustless):**
```python
# 1. Fetch fresh attestation de RedPill
attestation = requests.get(
    "https://api.redpill.ai/v1/attestation/report",
    params={"model": model, "nonce": nonce}
)

# 2. Verify code hash
assert sha256(code) == attestation["inference"]["response_hash"]

# 3. Verify nonce
assert attestation["verification"]["nonce"] == nonce
```

---

## Contratos Desplegados (ETH Sepolia)

| Contrato | Dirección |
|----------|-----------|
| IdentityRegistry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| ReputationRegistry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |
| RPC URL | `https://1rpc.io/sepolia` |
| Subgraph | The Graph ID: `6wQRC7g...KmZLT` |

---

## Estructura del Proyecto

```
AITradingAgent-ERC-8004-Hackathon/
├── src/
│   ├── agent/
│   │   ├── base.py              # Clase abstracta BaseAgent
│   │   ├── chat_agent.py        # Chat con Anthropic
│   │   ├── delta_neutral.py     # Motor de trading
│   │   ├── registry.py          # Cliente ERC-8004
│   │   ├── tee_auth.py          # Autenticación TEE
│   │   ├── eip712.py            # Firmas typed data
│   │   ├── subgraph_client.py   # GraphQL client
│   │   ├── ai_generator.py      # Generación código IA
│   │   ├── code_executor.py     # Sandbox execution
│   │   ├── session_store.py     # Gestión sesiones chat
│   │   ├── agent_card.py        # Builder ERC-8004 cards
│   │   └── chain_config.py      # Configuración multi-chain
│   ├── templates/
│   │   └── server_agent.py      # ServerAgent implementation
│   └── utils/
├── deployment/
│   └── local_agent_server.py    # FastAPI server principal
├── static/
│   ├── funding.html             # Página de funding
│   ├── dashboard.html           # UI de registro
│   ├── developer.html           # Chat interface
│   ├── chat.js                  # Lógica del chat
│   └── trust-center.js          # Verificación TEE
├── docs/
│   └── DOCUMENTACION_COMPLETA.md # Esta documentación
├── docker-compose.yml            # Production deployment
├── agent_config.json             # Metadata ERC-8004
├── requirements.txt              # Dependencias Python
└── verify_ai_attestation.py      # Herramienta verificación
```

---

## Stack Tecnológico

### Backend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Python | 3.13+ | Lenguaje principal |
| FastAPI | 0.104+ | Servidor HTTP |
| Uvicorn | 0.24+ | ASGI server |
| Web3.py | 6.0+ | Interacción blockchain |
| eth-account | 0.8+ | Firmas EIP-712 |

### IA / ML

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Anthropic SDK | 0.40+ | Chat interface |
| OpenAI SDK | 1.0+ | LLM para trading |
| RedPill AI | - | Inferencia TEE |

### Infraestructura

| Componente | Propósito |
|------------|-----------|
| Docker | Contenerización |
| docker-compose | Orquestación local |
| Phala Cloud | Deployment TEE production |
| dstack | SDK de attestation |

---

## Flujo de Registro On-Chain

### Paso 1: Derivación de Wallet
```
AGENT_SALT → TEEAuthenticator._derive_tee_key()
           → dstack.get_key("wallet/erc8004-{salt}", domain)
           → private_key → address (0x...)
```

### Paso 2: Funding
```
Usuario envía ETH Sepolia → address derivada
                         → balance >= 0.001 ETH (mínimo gas)
```

### Paso 3: Registro Identity
```
POST /api/register
  → RegistryClient.register_agent()
  → IdentityRegistry.register(tokenURI)
  → Transfer event → agent_id (tokenId)
```

### Paso 4: Preparar TEE Attestation
```
async prepare_tee_attestation():
  1. tee_auth.get_attestation() → quote + event_log
  2. POST trust-center/getOffchainProof
  3. Cache: codeMeasurement, codeConfigUri, proof
```

### Paso 5: Submit Reputación Inicial
```
POST /api/reputation/submit-initial
  → ReputationRegistry.giveFeedback()
  → value: 0 (punto de partida)
```

---

*Documentación técnica del proyecto ERC-8004 TEE Trading Agent.*
