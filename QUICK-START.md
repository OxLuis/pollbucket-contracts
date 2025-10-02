# ⚡ Quick Start - PollBucket

Guía rápida para deployar y probar PollBucket en 5 minutos.

## 🚀 **Setup Rápido**

```bash
# 1. Instalar dependencias
npm install

# 2. Compilar contratos
npm run compile

# 3. Deploy en red local
npm run deploy:local

# 4. Configuración inicial
npx hardhat run scripts/setup-platform.js --network hardhat

# 5. Prueba completa
npx hardhat run scripts/test-flow.js --network hardhat
```

## 📋 **Comandos Esenciales**

### **Deployment:**
```bash
npm run deploy:local          # Red local
npm run deploy:fuji           # Fuji testnet
npm run deploy:simple:local   # Solo SimplePollPool
```

### **Demos:**
```bash
npx hardhat run scripts/demo-pool-info.js --network hardhat
npx hardhat run scripts/demo-conflict-prevention.js --network hardhat
npx hardhat run scripts/demo-juror-stake-config.js --network hardhat
npx hardhat run scripts/test-flow.js --network hardhat
```

### **Utilidades:**
```bash
npm run compile              # Compilar contratos
npm run node                # Ejecutar nodo local
npx hardhat console --network hardhat  # Consola interactiva
```

## 🎯 **Flujo Básico de Uso**

### **1. Crear Pool:**
```javascript
const pollPool = await ethers.getContractAt("PollPool", address);
const fixedAmount = ethers.utils.parseEther("0.05");

await pollPool.createPool(
    "¿Pregunta?",
    ["Opción A", "Opción B"],
    futureTimestamp,
    maxParticipants,
    fixedAmount,
    { value: fixedAmount }
);
```

### **2. Apostar:**
```javascript
const requiredAmount = await pollPool.getPoolFixedBetAmount(poolId);
await pollPool.connect(user).placeBet(poolId, optionIndex, { value: requiredAmount });
```

### **3. Registrarse como Jurado:**
```javascript
const reputationSystem = await ethers.getContractAt("ReputationSystem", address);
const minStake = await reputationSystem.getMinStakeRequired();
await reputationSystem.registerAsJuror({ value: minStake });
```

### **4. Votar como Jurado:**
```javascript
const jurySystem = await ethers.getContractAt("JurySystem", address);
await jurySystem.castVote(poolId, correctOption);
```

## 📊 **Consultas Útiles**

### **Estado del Pool:**
```javascript
const poolInfo = await pollPool.getPoolInfo(poolId);
console.log("Total AVAX:", ethers.utils.formatEther(poolInfo.totalAvax));
console.log("Participantes:", poolInfo.currentParticipants.toString());
console.log("Tiempo restante:", poolInfo.hoursRemaining.toString(), "horas");
```

### **Perfil de Jurado:**
```javascript
const profile = await reputationSystem.getJurorProfile(address);
console.log("Reputación:", profile.reputation.toString());
console.log("Stake:", ethers.utils.formatEther(profile.stakedAmount));
console.log("Precisión:", (profile.correctVotes * 100 / profile.totalVotes).toString(), "%");
```

### **Estadísticas Generales:**
```javascript
const totalPools = await pollPool.getTotalPoolsCount();
const activePools = await pollPool.getActivePoolsCount();
const totalJurors = await reputationSystem.getActiveJurorsCount();
```

## 🔧 **Configuración de Owner**

```javascript
// Cambiar stake mínimo para jurados
await reputationSystem.setMinStakeRequired(ethers.utils.parseEther("0.1"));

// Cambiar monto mínimo por voto
await pollPool.setMinimumFixedBetAmount(ethers.utils.parseEther("0.02"));

// Cambiar comisiones
await pollPool.setCreatorCommission(300); // 3%
await pollPool.setPlatformFee(200);       // 2%
```

## 📁 **Archivos Importantes**

- `deployments/hardhat-deployment.json` - Direcciones de contratos
- `DEPLOYMENT-GUIDE.md` - Guía completa paso a paso
- `README.md` - Documentación completa
- `SIMPLE-README.md` - Guía del contrato simplificado

## 🆘 **Solución de Problemas**

### **Error: "No deployment found"**
```bash
# Ejecutar deployment primero
npm run deploy:local
```

### **Error: "Insufficient funds"**
```bash
# Verificar balance en Hardhat
npx hardhat console --network hardhat
> (await ethers.getSigners())[0].getBalance()
```

### **Error: "Already registered"**
```bash
# Normal si ya ejecutaste setup-platform.js
# Usa otras cuentas para registrar más jurados
```

## 🎉 **¡Listo!**

Con estos comandos tienes todo lo necesario para probar PollBucket. Para más detalles, consulta `DEPLOYMENT-GUIDE.md`.