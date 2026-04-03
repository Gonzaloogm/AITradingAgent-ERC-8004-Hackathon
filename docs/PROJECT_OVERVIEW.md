# ERC-8004 TEE Trading Agent - Visión General del Proyecto

## Resumen Ejecutivo

Este proyecto implementa un **agente de trading algorítmico delta-neutral** con identidad on-chain verificable, ejecutándose en un Entorno de Ejecución Confiable (TEE) Intel TDX. El agente combina:

1. **Trading Delta-Neutral**: Estrategia de cash-and-carry en mercados de criptomonedas
2. **Identidad On-Chain**: Registro ERC-8004 en Ethereum Sepolia
3. **Attestación TEE**: Pruebas criptográficas de ejecución en hardware genuino
4. **IA Conversacional**: Interfaz de chat con Anthropic/RedPill para interacción natural
5. **Sistema de Reputación**: Feedback on-chain para confianza entre agentes

---

## Tabla de Contenidos

1. [Arquitectura del Sistema](#arquitectura-del-sistema)
2. [Componentes Principales](#componentes-principales)
3. [Flujo de Registro On-Chain](#flujo-de-registro-on-chain)
4. [Estrategia de Trading Delta-Neutral](#estrategia-de-trading-delta-neutral)
5. [Seguridad y TEE](#seguridad-y-tee)
6. [Stack Tecnológico](#stack-tecnológico)

---

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CAPA DE PRESENTACIÓN                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Funding    │  │  Dashboard  │  │  Developer  │  │ Trust Center│    │
│  │   Page      │  │   (Registro)│  │   (Chat)    │  │  (Verify)   │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CAPA DE SERVIDOR (FastAPI)                       │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    Local Agent Server                            │    │
│  │  - Gestión de sesiones de chat                                   │    │
│  │  - Endpoints ERC-8004 (/agent.json, /api/*)                      │    │
│  │  - Preparación de attestation TEE                                │    │
│  │  - Integración con DeltaNeutralEngine                            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CAPA DE AGENTE                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  BaseAgent  │  │ ChatAgent   │  │ ServerAgent │  │  Delta      │    │
│  │  (Abstract) │  │ (Anthropic) │  │ (AIO)       │  │  Neutral    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CAPA DE INFRAESTRUCTURA                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  TEE Auth   │  │  Registry   │  │  Subgraph   │  │  EIP-712    │    │
│  │  (dstack)   │  │  Client     │  │  Client     │  │  Signer     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CAPA EXTERNA                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Ethereum   │  │   The       │  │  RedPill    │  │  Kraken/    │    │
│  │  Sepolia    │  │   Graph     │  │  AI (LLM)   │  │  Binance    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes Principales

### 1. DeltaNeutralEngine (`src/agent/delta_neutral.py`)

Motor de trading que implementa la estrategia delta-neutral de cash-and-carry:

**Características principales:**
- **Análisis de Spread**: Calcula la diferencia entre precio spot y perpetuo
- **Funding Rate**: Considera las tasas de financiación de contratos perpetuos
- **Umbral Dinámico LLM**: Usa IA para determinar el spread mínimo aceptable
- **Circuit Breaker**: Detiene el trading en alta volatilidad (>5% entre ticks)
- **Control de Drawdown**: Límite del 5% desde el peak de equity
- **Position Sizing**: 10% del capital disponible por trade

**Flujo de decisión:**
```
1. Obtener precios (Kraken CLI → Binance API fallback)
2. Verificar circuit breaker (volatilidad inter-tick)
3. Consultar LLM para umbral de spread dinámico
4. Opcional: Comprar señales externas vía x402
5. Calcular spread neto (spread + funding - fees)
6. Ejecutar si: spread >= umbral Y net_yield > 0
7. Generar artifact de validación ERC-8004
8. Enviar reputación feedback on-chain
```

### 2. ChatAgent (`src/agent/chat_agent.py`)

Interfaz conversacional usando Anthropic SDK con backend RedPill:

**Herramientas disponibles:**
| Herramienta | Descripción |
|-------------|-------------|
| `get_wallet_info` | Obtener dirección, balance y chain |
| `sign_message` | Firmar mensaje con clave TEE |
| `verify_signature` | Verificar firma EIP-191 |
| `generate_attestation` | Generar prueba TEE Intel TDX |
| `get_agent_card` | Obtener metadatos ERC-8004 |
| `get_registration_status` | Estado de registro on-chain |
| `get_chain_config` | Configuración de blockchain |
| `get_reputation` | Consultar reputación de agente |
| `submit_feedback` | Enviar feedback on-chain |
| `run_python` | Ejecutar código Python sandboxed |
| `run_shell` | Ejecutar comandos shell |

### 3. TEEAuthenticator (`src/agent/tee_auth.py`)

Módulo de autenticación TEE usando dstack SDK:

**Funcionalidades:**
- **Derivación Determinística de Claves**: Path `wallet/erc8004-{salt}`
- **Attestación Remota**: `get_quote()` con datos de aplicación
- **Firma EIP-712**: Signatura de mensajes estructurados
- **Modo Desarrollo**: Fallback a private key sin TEE

**Proceso de derivación:**
```
1. Path: "wallet/erc8004-{AGENT_SALT}"
2. Purpose: AGENT_DOMAIN
3. tee_client.get_key(path, purpose) → key bytes
4. Convertir a formato eth_account
5. Derivar address: 0x{40 hex chars}
```

### 4. RegistryClient (`src/agent/registry.py`)

Cliente para interacción con contratos ERC-8004:

**Contratos soportados:**
- **IdentityRegistry**: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- **ReputationRegistry**: `0x8004B663056A597Dffe9eCcC1965A193B7388713`

**Operaciones:**
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

Cliente GraphQL para consultas rápidas a The Graph:

**Queries soportadas:**
- `get_agent_by_id(agent_id)`: Información de agente
- `get_agent_by_owner(owner_address)`: Buscar por propietario
- `get_agent_reputation(agent_id)`: Estadísticas y feedback reciente
- `list_agents(limit, offset)`: Listado paginado

**Caché:**
- TTL: 30 segundos por defecto
- Invalidate manual: `clear_cache()`

### 6. AIScriptGenerator (`src/agent/ai_generator.py`)

Generador de código con attestation TEE verificable:

**Características:**
- **Modelos soportados**: qwen-2.5-7b, deepseek-chat-v3, gpt-oss-120b
- **Attestación incluida**: Nonce fresco por request
- **Auto-retry**: Reintentos con contexto de error
- **Extracción JSON**: Parsing robusto de respuestas

**Flujo de generación:**
```
1. Generar nonce fresco (32 bytes hex)
2. Construir prompt con contexto
3. POST /v1/chat/completions (RedPill API)
   - Header: X-Attestation-Nonce: {nonce}
4. Extraer código de respuesta
5. GET /v1/attestation/report?nonce={nonce}
6. Unir: código + attestation + hashes
```

---

## Flujo de Registro On-Chain

### Paso 1: Derivación de Wallet
```
AGENT_SALT (env) → TEEAuthenticator._derive_tee_key()
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
  → agent.is_registered = True
```

### Paso 4: Preparar TEE Attestation
```
async prepare_tee_attestation():
  1. tee_auth.get_attestation() → quote + event_log
  2. POST trust-center/getOffchainProof
     - agentId, agentPubkey, tdxQuote
     - appId, dstackDomain
  3. Cache: codeMeasurement, codeConfigUri, proof
```

### Paso 5: Submit Reputation Inicial
```
POST /api/reputation/submit-initial
  → ReputationRegistry.giveFeedback()
  → value: 0 (punto de partida)
  → Crea entrada on-chain para el agente
```

---

## Estrategia de Trading Delta-Neutral

### Concepto

La estrategia **cash-and-carry** aprovecha el diferencial entre:
- **Mercado Spot**: Precio actual del activo
- **Mercado Perpetuo**: Precio del contrato futuro sin vencimiento

### Mecánica

```
Posición LONG Spot:  Compra 1 BTC en mercado spot
Posición SHORT Perp: Vende 1 BTC en contrato perpetuo

Resultado: Delta-neutral (sin exposición direccional al precio)

Profit = Spread (perp - spot) + Funding Rate - Fees
```

### Criterios de Entrada

| Condición | Valor | Descripción |
|-----------|-------|-------------|
| Spread mínimo | LLM dinámico (0.015-0.20%) | Determinado por IA según volatilidad |
| Net Yield | > 0% | Spread + Funding - 0.10% fees |
| Volatilidad inter-tick | < 5% | Circuit breaker |
| Drawdown actual | < 5% | Desde peak equity |

### Gestión de Riesgo

**Circuit Breaker:**
```python
swing_pct = abs((current_price - last_price) / last_price) * 100
if swing_pct > 5.0:
    circuit_breaker_tripped = True  # Detiene trading
```

**Drawdown Máximo:**
```python
current_drawdown = (peak_equity - current_equity) / peak_equity
if current_drawdown >= 0.05:
    circuit_breaker_tripped = True  # Halts permanently
```

**Position Sizing:**
```python
trade_size = available_capital * 0.10  # 10% riesgo
```

### Artifact de Validación ERC-8004

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

## Seguridad y TEE

### Intel TDX (Trust Domain Extensions)

**Qué protege:**
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

**Local (ligera):**
```python
python verify_ai_attestation.py attestation.json
```

Checks:
1. Estructura completa (type, measurements, signature, timestamp)
2. Nonce presente (64 hex chars)
3. Timestamp < 10 minutos
4. TEE type válido (intel_tdx, nvidia_h100_tee, etc.)

**Independiente (trustless):**
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

### Blockchain
| Componente | Red | Dirección |
|------------|-----|-----------|
| IdentityRegistry | ETH Sepolia | `0x8004A...BD9e` |
| ReputationRegistry | ETH Sepolia | `0x8004B...8713` |
| RPC URL | - | `https://1rpc.io/sepolia` |
| Subgraph | The Graph | ID: `6wQRC7g...KmZLT` |

### Infraestructura
| Componente | Propósito |
|------------|-----------|
| Docker | Contenerización |
| docker-compose | Orquestación local |
| Phala Cloud | Deployment TEE production |
| dstack | SDK de attestation |

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
├── contracts/
│   ├── IdentityRegistry.sol     # Contrato de identidad
│   ├── ReputationRegistry.sol   # Contrato de reputación
│   ├── DstackVerifier.sol       # Verificador TEE
│   └── TEERegistry.sol          # Registro TEE
├── static/
│   ├── funding.html             # Página de funding
│   ├── dashboard.html           # UI de registro
│   ├── developer.html           # Chat interface
│   ├── chat.js                  # Lógica del chat
│   └── trust-center.js          # Verificación TEE
├── docs/
│   ├── PROJECT_OVERVIEW.md      # Este documento
│   ├── TECHNICAL_DEEP_DIVE.md   # Deep dive técnico
│   ├── API_REFERENCE.md         # Referencia API completa
│   ├── ERC8004_STANDARD.md      # Estándar ERC-8004
│   └── TRADING_AGENT.md         # Docs trading agent
├── docker-compose.yml            # Production deployment
├── agent_config.json             # Metadata ERC-8004
├── requirements.txt              # Dependencias Python
└── verify_ai_attestation.py      # Herramienta verificación
```

---

## Próximos Pasos

Para continuar con la documentación detallada, consulta:

1. **[TECHNICAL_DEEP_DIVE.md](TECHNICAL_DEEP_DIVE.md)** - Análisis profundo de cada componente
2. **[API_REFERENCE.md](API_REFERENCE.md)** - Referencia completa de endpoints
3. **[ERC8004_STANDARD.md](ERC8004_STANDARD.md)** - Implementación del estándar
4. **[TRADING_AGENT.md](TRADING_AGENT.md)** - Documentación del agente de trading

---

*Documento generado como parte de la documentación técnica del proyecto ERC-8004 TEE Trading Agent.*
