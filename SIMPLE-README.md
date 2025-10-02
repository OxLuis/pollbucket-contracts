# SimplePollPool - Contrato Simplificado para Polls

SimplePollPool es una versión simplificada del sistema PollBucket que permite crear y manejar pools de preguntas **sin necesidad del sistema de jurados**. Ideal para casos donde el resultado es objetivo y verificable.

## 🎯 **Características Principales**

- ✅ **Creación de pools** con monto fijo por voto
- ✅ **Apuestas múltiples** de usuarios
- ✅ **Límite de participantes** configurable
- ✅ **Resolución manual** por el creador del pool
- ✅ **Distribución automática** de recompensas
- ✅ **Comisiones configurables** para creador y plataforma
- ✅ **Sin dependencias** de otros contratos

## 🚀 **Deployment Rápido**

### **Comandos Disponibles:**

```bash
# Compilar contrato
npm run compile

# Deploy en red local
npm run deploy:simple:local

# Deploy en Fuji testnet
npm run deploy:simple:fuji

# Deploy en Avalanche mainnet
npm run deploy:simple:avalanche

# Demo completo
npx hardhat run scripts/demo-simple-pool.js --network hardhat
```

### **Deployment Manual:**

```bash
# 1. Compilar
npx hardhat compile

# 2. Deploy
npx hardhat run scripts/deploy-simple.js --network [red]

# 3. Demo
npx hardhat run scripts/demo-simple-pool.js --network [red]
```

## 📋 **Funciones Principales**

### **Para Creadores de Pools:**

```solidity
// Crear pool
function createPool(
    string memory _question,      // Pregunta del pool
    string[] memory _options,     // Opciones de respuesta (mínimo 2)
    uint256 _closeTime,          // Timestamp de cierre
    uint256 _maxParticipants,    // Máximo participantes (0 = sin límite)
    uint256 _fixedBetAmount      // Monto fijo por voto
) external payable;

// Cerrar pool
function closePool(uint256 _poolId) external;

// Resolver pool (establecer ganador)
function resolvePool(uint256 _poolId, uint256 _winningOption) external;

// Distribuir recompensas
function distributeRewards(uint256 _poolId) external;
```

### **Para Participantes:**

```solidity
// Apostar en pool
function placeBet(uint256 _poolId, uint256 _option) external payable;

// Ver información del pool
function getPoolInfo(uint256 _poolId) external view returns (...);

// Ver si ya participé
function hasUserParticipated(uint256 _poolId, address _user) external view returns (bool);
```

### **Para Administradores (Owner):**

```solidity
// Configurar monto mínimo por voto
function setMinimumFixedBetAmount(uint256 _amount) external onlyOwner;

// Configurar fee de plataforma
function setPlatformFee(uint256 _fee) external onlyOwner;

// Configurar comisión de creadores
function setCreatorCommission(uint256 _commission) external onlyOwner;
```

## 🔄 **Flujo de Operación**

```
1. 🏗️ CREACIÓN:
   Creador → Define pregunta y opciones → Paga monto fijo → Pool creado

2. 🎯 APUESTAS:
   Usuarios → Pagan monto exacto → Eligen opción → Se registran

3. 🔒 CIERRE:
   Creador o tiempo → Pool se cierra → No más apuestas

4. ⚖️ RESOLUCIÓN:
   Creador → Establece opción ganadora → Pool resuelto

5. 💰 DISTRIBUCIÓN:
   Cualquiera → Ejecuta distribución → Ganadores reciben recompensas
```

## 💰 **Distribución de Recompensas**

```
Total del Pool (100%)
├── Ganadores (87%) - Proporcional a sus apuestas
├── Creador (5%) - Comisión configurable
└── Plataforma (3%) - Fee configurable
```

## 📊 **Ejemplo de Uso**

```javascript
const { ethers } = require("hardhat");

// Conectar al contrato
const simplePollPool = await ethers.getContractAt("SimplePollPool", contractAddress);

// 1. Crear pool
const fixedAmount = ethers.utils.parseEther("0.05"); // 0.05 AVAX por voto
await simplePollPool.createPool(
    "¿Quién ganará el mundial?",
    ["Argentina", "Brasil", "Francia", "Otro"],
    Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 días
    100, // Máximo 100 participantes
    fixedAmount,
    { value: fixedAmount }
);

// 2. Apostar (como usuario)
await simplePollPool.connect(user).placeBet(poolId, 0, { value: fixedAmount });

// 3. Cerrar pool
await simplePollPool.closePool(poolId);

// 4. Resolver pool (Argentina gana)
await simplePollPool.resolvePool(poolId, 0);

// 5. Distribuir recompensas
await simplePollPool.distributeRewards(poolId);
```

## ⚙️ **Configuración por Defecto**

- **Monto mínimo por voto**: 0.05 AVAX
- **Fee de plataforma**: 3%
- **Comisión de creadores**: 5%
- **Estados**: Open → Closed → Resolved
- **Límite de participantes**: Configurable por pool

## 🔍 **Funciones de Consulta**

```javascript
// Información completa del pool
const info = await simplePollPool.getPoolInfo(poolId);
console.log("Total AVAX:", ethers.utils.formatEther(info.totalAvax));
console.log("Participantes:", info.currentParticipants, "/", info.maxParticipants);
console.log("Tiempo restante:", info.hoursRemaining, "horas");

// Estadísticas generales
const totalPools = await simplePollPool.getTotalPoolsCount();
const activePools = await simplePollPool.getActivePoolsCount();

// Pools por estado
const openPools = await simplePollPool.getPoolsByStatus(0); // Open
const resolvedPools = await simplePollPool.getPoolsByStatus(2); // Resolved

// Pools por creador
const myPools = await simplePollPool.getPoolsByCreator(creatorAddress);
```

## ⚠️ **Limitaciones**

- **Sin sistema de jurados**: El creador debe resolver manualmente
- **Confianza requerida**: Los participantes confían en que el creador resolverá correctamente
- **No hay validación externa**: No hay mecanismo para disputar resultados
- **Ideal para**: Resultados objetivos y verificables públicamente

## 🎯 **Casos de Uso Ideales**

- ✅ **Eventos deportivos**: Resultados verificables públicamente
- ✅ **Precios de activos**: Datos de oráculos o exchanges
- ✅ **Eventos programados**: Con fecha/hora específica
- ✅ **Resultados binarios**: Sí/No, Arriba/Abajo
- ✅ **Comunidades confiables**: Donde se confía en el creador

## 🚫 **No Recomendado Para**

- ❌ **Preguntas subjetivas**: Sin respuesta objetiva
- ❌ **Eventos inciertos**: Sin forma clara de verificar
- ❌ **Comunidades grandes**: Donde no se conoce al creador
- ❌ **Altas cantidades**: Donde se requiere máxima seguridad

## 🛠️ **Ventajas vs Sistema Completo**

| Aspecto | SimplePollPool | Sistema Completo |
|---------|----------------|------------------|
| **Deployment** | 1 contrato | 5 contratos |
| **Gas Cost** | Bajo | Alto |
| **Complejidad** | Simple | Complejo |
| **Confianza** | Requiere confianza | Descentralizado |
| **Velocidad** | Inmediato | 24h validación |
| **Seguridad** | Básica | Máxima |

## 🎉 **¡Listo para Usar!**

SimplePollPool es perfecto para comenzar rápidamente con pools de predicción donde el resultado es objetivo y verificable. Para casos que requieren máxima descentralización y seguridad, considera usar el sistema completo con jurados.

---

**Nota**: Este contrato es ideal para MVPs, prototipos, o casos donde la confianza en el creador no es un problema.