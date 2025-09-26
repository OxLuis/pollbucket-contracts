# PollBucket - Plataforma Descentralizada de Predicción y Trivia

PollBucket es una plataforma descentralizada construida en Avalanche donde los usuarios pueden crear preguntas, apostar por las respuestas correctas, y validar resultados a través de un sistema de jurados. La plataforma utiliza AVAX como moneda base e implementa un sistema de reputación para mantener la integridad de las validaciones.

## 🏗️ Arquitectura de Contratos

La plataforma está compuesta por 5 contratos principales que trabajan en conjunto:

### 1. **PollPool.sol** - Contrato Principal de Pools
**Propósito**: Maneja la creación de pools de preguntas, apuestas y distribución de recompensas.

#### Funciones Principales:
- `createPool()` - Crear un nuevo pool con monto fijo por voto y límite de participantes
- `placeBet()` - Apostar el monto exacto requerido en una opción específica
- `closePool()` - Cerrar pool y activar sistema de jurados
- `validatePool()` - Validar resultado (solo llamado por JurySystem)
- `distributeRewards()` - Distribuir recompensas a ganadores
- `setCreatorCommission()` - Establecer comisión para creadores (solo owner)

#### Funciones de Consulta y Búsqueda:
- `hasUserParticipated()` - Verificar si un usuario ya participó en un pool
- `getPoolParticipantCount()` - Obtener conteo actual y máximo de participantes
- `getPoolFixedBetAmount()` - Obtener monto fijo requerido para votar en un pool
- `getAllPoolIds()` - Obtener todos los IDs de pools existentes
- `getPoolsByStatus()` - Obtener pools filtrados por estado (Open, Closed, Validated, Cancelled)
- `getPoolsByCreator()` - Obtener todos los pools creados por una dirección específica
- `getTotalPoolsCount()` - Obtener número total de pools creados
- `getActivePoolsCount()` - Obtener número de pools activos (abiertos)
- `getPoolsByIdRange()` - Obtener pools en un rango específico de IDs
- `getRecentPools()` - Obtener los N pools más recientes

#### Funciones de Información Completa:
- `getPoolInfo()` - **Información completa**: AVAX total, participantes, tiempo restante (días/horas/minutos), estado
- `getPoolTimeRemaining()` - Tiempo restante en segundos y si ya expiró
- `canJoinPool()` - Verificar si se puede unir al pool y razón si no se puede
- `getPoolStats()` - Estadísticas resumidas: ocupación %, si está lleno, si está activo, promedio por apuesta

#### Funciones Administrativas:
- `setMinimumFixedBetAmount()` - Establecer monto mínimo para votos (solo owner)

#### Características:
- **Monto fijo por voto**: El creador establece exactamente cuánto debe pagar cada participante
- **Control de participantes**: Límite máximo configurable por pool
- **Sistema de identificación**: Múltiples formas de buscar y filtrar pools
- Comisión fija para todos los creadores (configurable solo por owner)
- Fee de plataforma automático
- Protección contra reentrancy
- Tracking completo de apuestas y participantes por usuario
- **Prevención de pools llenos**: Verificación automática de límites
- **Equidad en apuestas**: Todos los participantes pagan exactamente lo mismo

### 2. **ReputationSystem.sol** - Sistema de Reputación
**Propósito**: Gestiona la reputación de jurados y su elegibilidad para validaciones.

#### Funciones Principales:
- `registerAsJuror()` - Registrarse como jurado con stake inicial
- `increaseStake()` - Aumentar stake existente
- `updateReputation()` - Actualizar reputación post-votación
- `slashJuror()` - Penalizar comportamiento malicioso
- `getEligibleJurors()` - Obtener jurados elegibles para validación
- `withdrawStake()` - Retirar stake (solo si inactivo)

#### Funciones Administrativas:
- `setMinStakeRequired()` - Configurar stake mínimo para jurados (solo owner)
- `getMinStakeRequired()` - Consultar stake mínimo actual

#### Sistema de Reputación:
- **Reputación inicial**: 100 puntos
- **Rango**: 0-1000 puntos
- **Mínimo para participar**: 50 puntos
- **Ganancia por voto correcto**: +10 puntos
- **Pérdida por voto incorrecto**: -15 puntos
- **Suspensión automática**: < 50 puntos

### 3. **JurySystem.sol** - Sistema de Validación
**Propósito**: Maneja el proceso de validación de pools a través de jurados.

#### Funciones Principales:
- `initiateValidation()` - Iniciar proceso de validación (con filtrado de conflictos)
- `castVote()` - Votar en una validación activa
- `distributeJurorRewards()` - Distribuir recompensas a jurados
- `resolveTie()` - Resolver empates con jurados adicionales (sin conflictos)
- `forceCompleteValidation()` - Forzar completar si tiempo vencido

#### Funciones de Integridad:
- `hasConflictOfInterest()` - Verificar si un jurado tiene conflicto con un pool
- `getConflictStats()` - Obtener estadísticas de conflictos para un pool

#### Proceso de Validación:
1. **Filtrado de conflictos** - Excluye participantes del pool como jurados
2. **Asignación aleatoria** de 3-7 jurados según complejidad (sin conflictos)
3. **Período de votación** de 24 horas
4. **Mayoría simple** determina ganador
5. **Resolución de empates** con jurados adicionales (también sin conflictos)
6. **Actualización automática** de reputaciones

### 4. **PlatformGovernance.sol** - Administración
**Propósito**: Administración centralizada y configuración de parámetros de la plataforma.

#### Funciones Principales:
- `updateMinimumStake()` - Actualizar stake mínimo
- `updatePlatformFee()` - Modificar fee de plataforma
- `suspendPool()` - Suspender pools específicos
- `toggleEmergencyMode()` - Activar modo de emergencia
- `addAdministrator()` - Agregar administradores
- `updateMetrics()` - Actualizar métricas de plataforma

#### Capacidades de Administración:
- **Configuración dinámica** de parámetros
- **Modo de emergencia** para pausar operaciones
- **Sistema de administradores** múltiples
- **Métricas y monitoreo** de salud del sistema
- **Suspensión selectiva** de pools problemáticos

### 5. **PollBucketFactory.sol** - Factory de Deployment
**Propósito**: Deployar y configurar todos los contratos de la plataforma de manera coordinada.

#### Funciones Principales:
- `deployPlatform()` - Deploy completo de todos los contratos
- `getDeployedContracts()` - Obtener direcciones de contratos

#### Proceso de Deployment:
1. Deploy ReputationSystem
2. Deploy JurySystem (temporal)
3. Deploy PollPool
4. Actualizar referencias cruzadas
5. Deploy PlatformGovernance
6. Configurar permisos y ownership

## 🔗 Interfaces

### IReputationSystem.sol
Define la interfaz para interactuar con el sistema de reputación.

### IJurySystem.sol
Define la interfaz para el sistema de jurados y validaciones.

### IPollPool.sol
Define la interfaz para el contrato principal de pools.

## 🚀 Deployment y Configuración

### Requisitos Previos
```bash
npm install
```

### Variables de Entorno
Crear archivo `.env`:
```env
PRIVATE_KEY=tu_private_key
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
SNOWTRACE_API_KEY=tu_snowtrace_api_key
```

### Comandos de Deployment

#### Red Local (Hardhat)
```bash
npm run deploy:local
```

#### Testnet Fuji
```bash
npm run deploy:fuji
```

#### Mainnet Avalanche
```bash
npm run deploy:avalanche
```

### Configuración Post-Deployment
```bash
npx hardhat run scripts/setup-platform.js --network [red]
```

## 📊 Flujo de Operación

### 1. Creación de Pool
1. Usuario paga stake mínimo (0.1 AVAX)
2. Define pregunta, opciones y tiempo de cierre
3. Sistema aplica comisión configurada por el owner
4. Sistema crea pool y registra apuesta inicial

### 2. Fase de Apuestas
1. Usuarios apuestan AVAX en opciones disponibles
2. Sistema verifica límite de participantes (si aplica)
3. Sistema registra todas las apuestas y participantes únicos
4. Pool se cierra automáticamente al vencer tiempo o llenarse

### 3. Validación por Jurados
1. Sistema asigna 3-7 jurados aleatoriamente
2. Jurados votan por la opción correcta (24h)
3. Mayoría simple determina ganador
4. Reputaciones se actualizan automáticamente

### 4. Distribución de Recompensas
1. Ganadores reciben proporción del pozo
2. Creador recibe su comisión configurada
3. Plataforma recibe fee (3% por defecto)
4. Jurados correctos reciben recompensa

## 🔒 Seguridad

### Medidas Implementadas
- **ReentrancyGuard**: Protección contra ataques de reentrancy
- **Access Control**: Roles y permisos granulares
- **Pausable**: Capacidad de pausar en emergencias
- **Slashing**: Penalización por comportamiento malicioso
- **Timeouts**: Límites de tiempo para todas las operaciones
- **🛡️ Prevención de Conflictos**: Jurados nunca son participantes del mismo pool

### Validaciones
- Verificación de fondos suficientes
- Validación de parámetros de entrada
- Checks de estado de contratos
- Verificación de elegibilidad de jurados
- **Control de límites de participantes**: Prevención de pools sobrecargados
- **Validación de participantes únicos**: Tracking de usuarios por pool
- **Límites mínimos**: Al menos 2 participantes si hay límite establecido

## 📈 Métricas y Monitoreo

### Métricas Disponibles
- Total de pools creados
- Pools activos
- Volumen total de apuestas
- Número de jurados activos
- Revenue de la plataforma
- Accuracy de jurados individuales

### Eventos Emitidos
- `PoolCreated` - Nuevo pool creado
- `BetPlaced` - Nueva apuesta realizada
- `ValidationCompleted` - Validación completada
- `ReputationUpdated` - Reputación actualizada
- `RewardsDistributed` - Recompensas distribuidas

## 🛠️ Comandos Útiles

```bash
# Compilar contratos
npm run compile

# Ejecutar tests
npm run test

# Ejecutar nodo local
npm run node

# Configurar plataforma después del deployment
npx hardhat run scripts/setup-platform.js --network [red]

# Demo completo de información de pools
npx hardhat run scripts/demo-pool-info.js --network [red]

# Demo de prevención de conflictos de interés
npx hardhat run scripts/demo-conflict-prevention.js --network [red]

# Demo de configuración de stake para jurados
npx hardhat run scripts/demo-juror-stake-config.js --network [red]

# Verificar contratos
npm run verify -- --network fuji [direccion_contrato]
```

## 📝 Parámetros actualizados de `createPool`:

### **Parámetros requeridos:**
1. **`_question`** (string memory) - Texto de la pregunta
2. **`_options`** (string[] memory) - Array de opciones de respuesta (mínimo 2)
3. **`_closeTime`** (uint256) - Timestamp de cierre del pool (debe ser futuro)
4. **`_maxParticipants`** (uint256) - Máximo número de participantes (0 = sin límite, mínimo 2 si hay límite)
5. **`_fixedBetAmount`** (uint256) - Monto fijo que TODOS deben pagar para votar

### **Parámetro implícito:**
6. **`msg.value`** (payable) - Debe ser exactamente igual a `_fixedBetAmount`

### **Comisión del creador:**
- Ya no es un parámetro de `createPool`
- Se establece globalmente por el owner del contrato usando `setCreatorCommission()`
- Todos los pools usan la misma comisión configurada
- Por defecto: 5% (500 basis points)
- Máximo permitido: 10% (1000 basis points)

### **Ejemplo de uso actualizado:**

```solidity
// Crear pool con monto fijo de 0.05 AVAX por voto y máximo 50 participantes
uint256 fixedAmount = ethers.utils.parseEther("0.05");
pollPool.createPool(
    "¿Cuál será el precio de AVAX al final del mes?",
    ["Menos de $20", "$20-$30", "$30-$40", "Más de $40"],
    1703980800, // Timestamp futuro
    50, // Máximo 50 participantes
    fixedAmount, // Todos deben pagar exactamente 0.05 AVAX
    { value: fixedAmount } // El creador también paga 0.05 AVAX
);

// Crear pool sin límite de participantes con monto fijo de 0.02 AVAX
uint256 smallAmount = ethers.utils.parseEther("0.02");
pollPool.createPool(
    "¿Quién ganará el próximo partido?",
    ["Equipo A", "Equipo B", "Empate"],
    1703980800,
    0, // Sin límite de participantes
    smallAmount, // Todos pagan 0.02 AVAX
    { value: smallAmount }
);

// Apostar en un pool existente (debe pagar el monto exacto)
uint256 poolFixedAmount = pollPool.getPoolFixedBetAmount(poolId);
pollPool.placeBet(poolId, 1, { value: poolFixedAmount });

// Solo el owner puede cambiar la comisión para todos los pools futuros
pollPool.setCreatorCommission(300); // Cambiar a 3%
```

Los **basis points** funcionan así:
- 100 = 1%
- 500 = 5% 
- 1000 = 10% (máximo permitido)

## 🔍 Identificación y Búsqueda de Pools

### **Formas de identificar pools:**

#### 1. **Por ID único:**
```solidity
// Cada pool tiene un ID único autoincremental
uint256 poolId = 1; // Primer pool creado
Pool memory pool = pollPool.getPool(poolId);
```

#### 2. **Por estado:**
```solidity
// Obtener todos los pools abiertos
uint256[] memory openPools = pollPool.getPoolsByStatus(PoolStatus.Open);

// Obtener pools cerrados
uint256[] memory closedPools = pollPool.getPoolsByStatus(PoolStatus.Closed);

// Obtener pools validados
uint256[] memory validatedPools = pollPool.getPoolsByStatus(PoolStatus.Validated);
```

#### 3. **Por creador:**
```solidity
// Obtener todos los pools creados por una dirección
uint256[] memory myPools = pollPool.getPoolsByCreator(msg.sender);
uint256[] memory userPools = pollPool.getPoolsByCreator(userAddress);
```

#### 4. **Por rango de IDs:**
```solidity
// Obtener pools del ID 1 al 10
uint256[] memory poolRange = pollPool.getPoolsByIdRange(1, 10);

// Obtener pools del ID 50 al 100
uint256[] memory recentRange = pollPool.getPoolsByIdRange(50, 100);
```

#### 5. **Pools más recientes:**
```solidity
// Obtener los últimos 5 pools creados
uint256[] memory recent = pollPool.getRecentPools(5);

// Obtener los últimos 20 pools
uint256[] memory moreRecent = pollPool.getRecentPools(20);
```

#### 6. **Estadísticas generales:**
```solidity
// Total de pools en la plataforma
uint256 total = pollPool.getTotalPoolsCount();

// Pools actualmente abiertos
uint256 active = pollPool.getActivePoolsCount();

// Todos los IDs existentes
uint256[] memory allIds = pollPool.getAllPoolIds();
```

### **Ejemplo de búsqueda completa:**
```solidity
// Buscar pools activos de un creador específico
uint256[] memory creatorPools = pollPool.getPoolsByCreator(creatorAddress);
uint256[] memory activePools = pollPool.getPoolsByStatus(PoolStatus.Open);

// Filtrar pools activos del creador (lógica en frontend)
// O usar eventos para indexación más eficiente
```

## 📊 Información Completa de Pools

### **Obtener información detallada:**

```solidity
// Información completa de un pool
(
    uint256 totalAvax,
    uint256 currentParticipants,
    uint256 maxParticipants,
    uint256 daysRemaining,
    uint256 hoursRemaining,
    uint256 minutesRemaining,
    PoolStatus status,
    uint256 fixedBetAmount
) = pollPool.getPoolInfo(poolId);

console.log("Total AVAX:", ethers.utils.formatEther(totalAvax));
console.log("Participantes:", currentParticipants, "/", maxParticipants);
console.log("Tiempo restante:", daysRemaining, "días", hoursRemaining, "horas");
console.log("Monto por voto:", ethers.utils.formatEther(fixedBetAmount), "AVAX");
```

### **Verificar disponibilidad:**

```solidity
// Verificar si se puede unir a un pool
(bool canJoin, string memory reason) = pollPool.canJoinPool(poolId);

if (canJoin) {
    uint256 requiredAmount = pollPool.getPoolFixedBetAmount(poolId);
    pollPool.placeBet(poolId, optionIndex, { value: requiredAmount });
} else {
    console.log("No se puede unir:", reason);
}
```

### **Estadísticas del pool:**

```solidity
// Obtener estadísticas resumidas
(
    uint256 totalAvax,
    uint256 participantCount,
    uint256 participantPercentage,
    bool isActive,
    bool isFull,
    uint256 avgBetAmount
) = pollPool.getPoolStats(poolId);

console.log("Ocupación:", participantPercentage, "%");
console.log("¿Está lleno?:", isFull);
console.log("¿Está activo?:", isActive);
```

### **Control de monto mínimo (solo owner):**

```solidity
// Cambiar monto mínimo para nuevos pools
pollPool.setMinimumFixedBetAmount(ethers.utils.parseEther("0.1")); // 0.1 AVAX mínimo

// Verificar monto mínimo actual
uint256 minimum = pollPool.minimumFixedBetAmount();
console.log("Monto mínimo:", ethers.utils.formatEther(minimum), "AVAX");
```

## 🛡️ Prevención de Conflictos de Interés

### **Problema Resuelto:**
El sistema ahora **garantiza** que los jurados asignados para validar un pool **nunca** sean participantes del mismo pool, eliminando conflictos de interés.

### **Cómo Funciona:**

#### **1. Filtrado Automático:**
```solidity
// Antes de asignar jurados, se filtran los participantes
address[] memory nonConflictedJurors = _filterNonParticipants(poolId, eligibleJurors);

// Solo se asignan jurados que NO participaron en el pool
```

#### **2. Verificación de Conflictos:**
```solidity
// Verificar si un jurado tiene conflicto con un pool
(bool hasConflict, string memory reason) = jurySystem.hasConflictOfInterest(poolId, jurorAddress);

if (hasConflict) {
    console.log("Conflicto:", reason); // "Jurado participo en el pool"
}
```

#### **3. Estadísticas de Conflictos:**
```solidity
// Obtener estadísticas de disponibilidad
(uint256 totalEligible, uint256 conflicted, uint256 available) = 
    jurySystem.getConflictStats(poolId);

console.log(`${available} jurados disponibles de ${totalEligible} elegibles`);
console.log(`${conflicted} jurados excluidos por conflicto`);
```

### **Flujo de Integridad:**

```
🎯 Pool creado → Usuarios apuestan → Pool se cierra
                     ↓
🔍 Sistema busca jurados elegibles (reputación + stake)
                     ↓
🛡️ FILTRO: Excluye participantes del pool
                     ↓
🎲 Selección aleatoria de jurados SIN conflicto
                     ↓
⚖️ Validación imparcial garantizada
```

### **Beneficios:**

- ✅ **Integridad total** - Jurados no tienen interés económico en el resultado
- ✅ **Transparencia** - Eventos de tracking para jurados excluidos
- ✅ **Escalabilidad** - Sistema funciona con cualquier número de participantes
- ✅ **Robustez** - Maneja casos donde muchos jurados tienen conflictos
- ✅ **Verificabilidad** - Funciones públicas para auditar conflictos

### **Ejemplo Práctico:**

```
🏆 Pool: "¿Ganará Argentina el mundial?"

👥 PARTICIPANTES (apostaron dinero):
- Alice: 0.05 AVAX en "Sí"
- Bob: 0.05 AVAX en "No"

⚖️ JURADOS ASIGNADOS (determinan respuesta):
- Charlie ✅ (no participó)
- David ✅ (no participó)  
- Eve ✅ (no participó)

❌ EXCLUIDOS POR CONFLICTO:
- Alice (participó en el pool)
- Bob (participó en el pool)

✅ RESULTADO: Validación 100% imparcial
```

## ⚙️ Configuración del Stake para Jurados

### **Control Administrativo:**
El owner del contrato puede ajustar el stake mínimo requerido para ser jurado:

```solidity
// Solo el owner puede cambiar el stake mínimo
reputationSystem.setMinStakeRequired(ethers.utils.parseEther("0.1")); // 0.1 AVAX

// Consultar stake mínimo actual
uint256 currentStake = reputationSystem.getMinStakeRequired();
console.log("Stake mínimo:", ethers.utils.formatEther(currentStake), "AVAX");
```

### **Impacto de los Cambios:**
- ✅ **Nuevos registros**: Deben cumplir el nuevo mínimo
- ✅ **Jurados existentes**: Mantienen su elegibilidad si ya cumplen
- ✅ **Validación automática**: Sistema verifica stake en tiempo real
- ✅ **Eventos de cambio**: Tracking completo de modificaciones

### **Ejemplo de Configuración:**

```javascript
// Configuración inicial: 0.05 AVAX
await reputationSystem.setMinStakeRequired(ethers.utils.parseEther("0.05"));

// Aumentar requisitos: 0.1 AVAX  
await reputationSystem.setMinStakeRequired(ethers.utils.parseEther("0.1"));

// Para situaciones especiales: 0.2 AVAX
await reputationSystem.setMinStakeRequired(ethers.utils.parseEther("0.2"));
```

### **Beneficios del Control Administrativo:**
- 🎯 **Flexibilidad**: Ajustar según condiciones del mercado
- 🛡️ **Seguridad**: Aumentar stake en caso de ataques
- 📈 **Escalabilidad**: Reducir barreras cuando sea necesario
- ⚖️ **Balance**: Mantener equilibrio entre accesibilidad y seguridad

## 📝 Configuración por Defecto

- **Stake mínimo**: 0.1 AVAX
- **Monto mínimo por voto**: 0.05 AVAX (configurable solo por owner)
- **Stake mínimo para jurados**: 0.05 AVAX (configurable solo por owner)
- **Fee de plataforma**: 3%
- **Comisión de creadores**: 5% (configurable solo por owner, máximo 10%)
- **Reputación mínima jurado**: 75 puntos
- **Período de validación**: 24 horas
- **Recompensa por jurado**: 0.01 AVAX
- **Jurados por validación**: 3-7 (según complejidad)

## 🤝 Contribución

La plataforma está diseñada para ser extensible y mejorable. Las áreas de mejora incluyen:

- Implementación de oráculos externos
- Sistema de badges y gamificación
- Integración con subgrafos para indexación
- Optimizaciones de gas
- Funcionalidades de gobernanza descentralizada

---

**Nota**: Esta es la implementación inicial de PollBucket. Se recomienda realizar auditorías de seguridad antes del deployment en mainnet.