# 🚀 Guía de Deployment y Uso - PollBucket

Esta guía te llevará paso a paso desde el deployment hasta el uso completo del sistema PollBucket.

## 📋 **Prerequisitos**

```bash
# 1. Instalar dependencias
npm install

# 2. Crear archivo .env (copia de .env.example)
cp .env.example .env

# 3. Configurar .env con tus datos
PRIVATE_KEY=tu_private_key_aqui
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
SNOWTRACE_API_KEY=tu_api_key_aqui
```

## 🏗️ **Paso 1: Deployment**

### **Opción A: Sistema Completo (Recomendado)**

```bash
# Compilar contratos
npm run compile

# Deploy en red local para pruebas
npm run deploy:local

# O deploy en Fuji testnet
npm run deploy:fuji
```

### **Opción B: Solo SimplePollPool**

```bash
# Deploy solo el contrato simple
npm run deploy:simple:local

# O en Fuji testnet
npm run deploy:simple:fuji
```

## 📄 **Paso 2: Verificar Deployment**

Después del deployment, verás algo así:

```
✅ PollPool deployed to: 0x1234...
✅ ReputationSystem deployed to: 0x5678...
✅ JurySystem deployed to: 0x9abc...
✅ PlatformGovernance deployed to: 0xdef0...
✅ Factory deployed to: 0x1111...

💾 Información guardada en deployments/hardhat-deployment.json
```

## 🔧 **Paso 3: Configuración Inicial**

```bash
# Ejecutar configuración automática
npx hardhat run scripts/setup-platform.js --network hardhat

# Esto registrará el deployer como primer jurado y creará un pool de ejemplo
```

## 📚 **Paso 4: Documentación de Contratos**

### **🏪 PollPool - Contrato Principal**

#### **Crear Pool:**
```javascript
const pollPool = await ethers.getContractAt("PollPool", poolPoolAddress);

// Crear pool con monto fijo de 0.05 AVAX por voto
const fixedAmount = ethers.utils.parseEther("0.05");
await pollPool.createPool(
    "¿Cuál será el precio de AVAX mañana?",           // Pregunta
    ["Menos de $20", "$20-$30", "$30-$40", "Más de $40"], // Opciones
    Math.floor(Date.now() / 1000) + (24 * 60 * 60),  // Cierra en 24 horas
    50,                                                // Máximo 50 participantes
    fixedAmount,                                       // Monto fijo por voto
    { value: fixedAmount }                            // Pago del creador
);
```

#### **Apostar en Pool:**
```javascript
// Obtener monto requerido
const poolId = 1;
const requiredAmount = await pollPool.getPoolFixedBetAmount(poolId);

// Apostar en opción 2
await pollPool.connect(user).placeBet(
    poolId,           // ID del pool
    2,               // Opción elegida (0, 1, 2, 3...)
    { value: requiredAmount }
);
```

#### **Consultar Pool:**
```javascript
// Información básica
const pool = await pollPool.getPool(poolId);
console.log("Pregunta:", pool.question);
console.log("Opciones:", pool.options);
console.log("Total AVAX:", ethers.utils.formatEther(pool.totalStake));

// Información completa
const [totalAvax, current, max, days, hours, minutes, status, fixedAmount] = 
    await pollPool.getPoolInfo(poolId);

console.log("Total AVAX:", ethers.utils.formatEther(totalAvax));
console.log("Participantes:", current.toString(), "/", max.toString());
console.log("Tiempo restante:", days.toString(), "días", hours.toString(), "horas");
console.log("Estado:", status); // 0=Open, 1=Closed, 2=Validated, 3=Cancelled
```

#### **Cerrar Pool:**
```javascript
// Solo el creador o cuando expire el tiempo
await pollPool.closePool(poolId);
```

### **⭐ ReputationSystem - Sistema de Jurados**

#### **Registrarse como Jurado:**
```javascript
const reputationSystem = await ethers.getContractAt("ReputationSystem", reputationAddress);

// Registrarse con stake mínimo
const minStake = await reputationSystem.getMinStakeRequired();
await reputationSystem.registerAsJuror({ value: minStake });
```

#### **Consultar Perfil de Jurado:**
```javascript
const profile = await reputationSystem.getJurorProfile(jurorAddress);
console.log("Reputación:", profile.reputation.toString());
console.log("Stake:", ethers.utils.formatEther(profile.stakedAmount));
console.log("Activo:", profile.isActive);
console.log("Total votos:", profile.totalVotes.toString());
console.log("Votos correctos:", profile.correctVotes.toString());

// Calcular precisión
const accuracy = profile.totalVotes > 0 ? 
    (profile.correctVotes * 100) / profile.totalVotes : 0;
console.log("Precisión:", accuracy.toString(), "%");
```

#### **Aumentar Stake:**
```javascript
const additionalStake = ethers.utils.parseEther("0.1");
await reputationSystem.increaseStake({ value: additionalStake });
```

### **⚖️ JurySystem - Sistema de Validación**

#### **Consultar Asignaciones:**
```javascript
const jurySystem = await ethers.getContractAt("JurySystem", juryAddress);

// Ver pools asignados a un jurado
const assignments = await jurySystem.getJurorAssignments(jurorAddress);
console.log("Pools asignados:", assignments);

// Ver si estoy asignado a un pool específico
const isAssigned = await jurySystem.isJurorAssigned(poolId, jurorAddress);
console.log("¿Asignado al pool?", isAssigned);
```

#### **Votar en Validación:**
```javascript
// Solo si estás asignado como jurado
await jurySystem.connect(juror).castVote(
    poolId,    // ID del pool
    1          // Opción que consideras correcta
);
```

#### **Consultar Validación:**
```javascript
const [poolId, assignedJurors, optionVotes, totalVotes, requiredVotes, status, deadline, winningOption] = 
    await jurySystem.getValidation(poolId);

console.log("Jurados asignados:", assignedJurors);
console.log("Votos por opción:", optionVotes);
console.log("Total votos:", totalVotes.toString());
console.log("Votos requeridos:", requiredVotes.toString());
console.log("Estado:", status); // 0=Pending, 1=InProgress, 2=Completed, 3=Disputed
console.log("Deadline:", new Date(deadline * 1000));
```

## 🎮 **Paso 5: Flujo Completo de Prueba**

### **Script de Prueba Manual:**

```javascript
// test-flow.js
const { ethers } = require("hardhat");

async function main() {
    const [deployer, alice, bob, charlie] = await ethers.getSigners();
    
    // Cargar direcciones del deployment
    const deployment = require('./deployments/hardhat-deployment.json');
    
    const pollPool = await ethers.getContractAt("PollPool", deployment.contracts.pollPool);
    const reputationSystem = await ethers.getContractAt("ReputationSystem", deployment.contracts.reputationSystem);
    const jurySystem = await ethers.getContractAt("JurySystem", deployment.contracts.jurySystem);
    
    console.log("🧪 Iniciando prueba completa...");
    
    // 1. Registrar jurados
    console.log("\n👨‍⚖️ Registrando jurados...");
    const stakeAmount = ethers.utils.parseEther("0.1");
    
    await reputationSystem.connect(alice).registerAsJuror({ value: stakeAmount });
    await reputationSystem.connect(bob).registerAsJuror({ value: stakeAmount });
    await reputationSystem.connect(charlie).registerAsJuror({ value: stakeAmount });
    
    console.log("✅ Jurados registrados");
    
    // 2. Crear pool
    console.log("\n🏗️ Creando pool...");
    const fixedAmount = ethers.utils.parseEther("0.05");
    const createTx = await pollPool.connect(deployer).createPool(
        "¿Subirá el precio de Bitcoin esta semana?",
        ["Sí, subirá", "No, bajará"],
        Math.floor(Date.now() / 1000) + (60 * 60), // 1 hora
        10,
        fixedAmount,
        { value: fixedAmount }
    );
    
    const receipt = await createTx.wait();
    const poolId = receipt.events.find(e => e.event === 'PoolCreated').args.poolId;
    console.log("✅ Pool creado con ID:", poolId.toString());
    
    // 3. Usuarios apuestan
    console.log("\n💰 Usuarios apostando...");
    await pollPool.connect(alice).placeBet(poolId, 0, { value: fixedAmount });
    await pollPool.connect(bob).placeBet(poolId, 1, { value: fixedAmount });
    await pollPool.connect(charlie).placeBet(poolId, 0, { value: fixedAmount });
    
    console.log("✅ Apuestas realizadas");
    
    // 4. Mostrar estado del pool
    const poolInfo = await pollPool.getPoolInfo(poolId);
    console.log("\n📊 Estado del pool:");
    console.log("   Total AVAX:", ethers.utils.formatEther(poolInfo.totalAvax));
    console.log("   Participantes:", poolInfo.currentParticipants.toString());
    console.log("   Tiempo restante:", poolInfo.hoursRemaining.toString(), "horas");
    
    // 5. Cerrar pool (simular que pasó el tiempo)
    console.log("\n🔒 Cerrando pool...");
    await pollPool.connect(deployer).closePool(poolId);
    console.log("✅ Pool cerrado, validación iniciada");
    
    // 6. Ver jurados asignados
    const validation = await jurySystem.getValidation(poolId);
    console.log("\n⚖️ Jurados asignados:", validation.assignedJurors);
    
    console.log("\n🎉 Prueba completada. Ahora los jurados pueden votar.");
}

main().catch(console.error);
```

### **Ejecutar Prueba:**
```bash
npx hardhat run test-flow.js --network hardhat
```

## 📊 **Paso 6: Monitoreo y Consultas**

### **Estadísticas Generales:**
```javascript
// Pools
const totalPools = await pollPool.getTotalPoolsCount();
const activePools = await pollPool.getActivePoolsCount();
const openPools = await pollPool.getPoolsByStatus(0);

// Jurados
const totalJurors = await reputationSystem.getActiveJurorsCount();
const minStake = await reputationSystem.getMinStakeRequired();

console.log("Total pools:", totalPools.toString());
console.log("Pools activos:", activePools.toString());
console.log("Total jurados:", totalJurors.toString());
console.log("Stake mínimo:", ethers.utils.formatEther(minStake), "AVAX");
```

### **Consultas por Usuario:**
```javascript
// Pools de un usuario
const userPools = await pollPool.getUserPools(userAddress);

// Asignaciones de jurado
const jurorAssignments = await jurySystem.getJurorAssignments(jurorAddress);

// Perfil de jurado
const profile = await reputationSystem.getJurorProfile(jurorAddress);
```

## 🛠️ **Paso 7: Configuración Administrativa**

### **Como Owner del Sistema:**
```javascript
// Cambiar stake mínimo para jurados
await reputationSystem.setMinStakeRequired(ethers.utils.parseEther("0.2"));

// Cambiar monto mínimo por voto
await pollPool.setMinimumFixedBetAmount(ethers.utils.parseEther("0.1"));

// Cambiar comisión de creadores
await pollPool.setCreatorCommission(300); // 3%

// Cambiar fee de plataforma
await pollPool.setPlatformFee(200); // 2%
```

## 🎯 **Próximos Pasos**

1. **Probar el flujo completo** con el script de prueba
2. **Crear múltiples pools** con diferentes configuraciones
3. **Registrar más jurados** para probar el sistema de validación
4. **Experimentar con diferentes montos** y límites de participantes
5. **Monitorear eventos** para ver el comportamiento del sistema

## 📝 **Archivos Importantes**

- `deployments/[network]-deployment.json` - Direcciones de contratos
- `scripts/setup-platform.js` - Configuración inicial
- `scripts/demo-*.js` - Scripts de demostración
- `README.md` - Documentación completa del sistema

¡Ahora tienes todo listo para deployar y probar el sistema paso a paso!