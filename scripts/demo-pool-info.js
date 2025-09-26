const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Demo de información completa de pools...");
  
  // Cargar información de deployment
  const fs = require('fs');
  const deploymentPath = `deployments/${hre.network.name}-deployment.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ No se encontró archivo de deployment. Ejecuta deploy.js primero.");
    return;
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const [deployer, user1, user2] = await ethers.getSigners();
  
  console.log("📝 Usando cuentas:");
  console.log("   Deployer:", deployer.address);
  console.log("   User1:", user1.address);
  console.log("   User2:", user2.address);
  
  // Conectar a contratos
  const pollPool = await ethers.getContractAt("PollPool", deployment.contracts.pollPool);
  
  console.log("\n🏗️ Creando pools de demostración...");
  
  // Pool 1: Con límite de participantes y monto bajo
  const lowAmount = ethers.utils.parseEther("0.05");
  const pool1Tx = await pollPool.connect(deployer).createPool(
    "¿Cuál será el clima mañana?",
    ["Soleado", "Lluvioso", "Nublado"],
    Math.floor(Date.now() / 1000) + (2 * 24 * 60 * 60), // 2 días
    5, // Máximo 5 participantes
    lowAmount,
    { value: lowAmount }
  );
  await pool1Tx.wait();
  
  // Pool 2: Sin límite y monto alto
  const highAmount = ethers.utils.parseEther("0.1");
  const pool2Tx = await pollPool.connect(user1).createPool(
    "¿Quién ganará el mundial?",
    ["Argentina", "Brasil", "España", "Francia", "Otro"],
    Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 días
    0, // Sin límite
    highAmount,
    { value: highAmount }
  );
  await pool2Tx.wait();
  
  // Pool 3: Que expire pronto
  const mediumAmount = ethers.utils.parseEther("0.07");
  const pool3Tx = await pollPool.connect(user2).createPool(
    "¿Subirá Bitcoin hoy?",
    ["Sí", "No"],
    Math.floor(Date.now() / 1000) + (2 * 60 * 60), // 2 horas
    3, // Máximo 3 participantes
    mediumAmount,
    { value: mediumAmount }
  );
  await pool3Tx.wait();
  
  console.log("✅ Pools creados exitosamente");
  
  // Agregar algunos participantes
  console.log("\n👥 Agregando participantes...");
  
  // User1 participa en pool 1
  await pollPool.connect(user1).placeBet(1, 1, { value: lowAmount });
  
  // User2 participa en pool 1
  await pollPool.connect(user2).placeBet(1, 2, { value: lowAmount });
  
  // Deployer participa en pool 2
  await pollPool.connect(deployer).placeBet(2, 0, { value: highAmount });
  
  console.log("✅ Participantes agregados");
  
  console.log("\n📊 INFORMACIÓN COMPLETA DE POOLS:");
  console.log("=" * 60);
  
  // Obtener todos los pools
  const allPoolIds = await pollPool.getAllPoolIds();
  
  for (let i = 0; i < allPoolIds.length; i++) {
    const poolId = allPoolIds[i];
    console.log(`\n🏆 POOL #${poolId}:`);
    
    // Información básica
    const pool = await pollPool.getPool(poolId);
    console.log(`   Pregunta: "${pool.question}"`);
    console.log(`   Creador: ${pool.creator}`);
    console.log(`   Opciones: [${pool.options.join(', ')}]`);
    
    // Información completa
    const poolInfo = await pollPool.getPoolInfo(poolId);
    console.log(`   💰 Total AVAX: ${ethers.utils.formatEther(poolInfo.totalAvax)} AVAX`);
    console.log(`   👥 Participantes: ${poolInfo.currentParticipants}/${poolInfo.maxParticipants === 0 ? '∞' : poolInfo.maxParticipants}`);
    console.log(`   💵 Monto por voto: ${ethers.utils.formatEther(poolInfo.fixedBetAmount)} AVAX`);
    console.log(`   📅 Estado: ${getStatusName(poolInfo.status)}`);
    
    if (poolInfo.status === 0) { // Open
      console.log(`   ⏰ Tiempo restante: ${poolInfo.daysRemaining}d ${poolInfo.hoursRemaining}h ${poolInfo.minutesRemaining}m`);
    }
    
    // Verificar si se puede unir
    const [canJoin, reason] = await pollPool.canJoinPool(poolId);
    console.log(`   🚪 ¿Se puede unir?: ${canJoin ? '✅ Sí' : '❌ No'} - ${reason}`);
    
    // Estadísticas
    const stats = await pollPool.getPoolStats(poolId);
    console.log(`   📈 Ocupación: ${stats.participantPercentage}%`);
    console.log(`   🔒 ¿Lleno?: ${stats.isFull ? 'Sí' : 'No'}`);
    console.log(`   🟢 ¿Activo?: ${stats.isActive ? 'Sí' : 'No'}`);
    console.log(`   📊 Promedio por apuesta: ${ethers.utils.formatEther(stats.avgBetAmount)} AVAX`);
  }
  
  console.log("\n📋 RESUMEN GENERAL:");
  console.log("=" * 40);
  
  const totalPools = await pollPool.getTotalPoolsCount();
  const activePools = await pollPool.getActivePoolsCount();
  const openPools = await pollPool.getPoolsByStatus(0); // Open
  const closedPools = await pollPool.getPoolsByStatus(1); // Closed
  const minimumFixedBet = await pollPool.minimumFixedBetAmount();
  
  console.log(`📊 Total de pools: ${totalPools}`);
  console.log(`🟢 Pools activos: ${activePools}`);
  console.log(`🔓 Pools abiertos: ${openPools.length}`);
  console.log(`🔒 Pools cerrados: ${closedPools.length}`);
  console.log(`💰 Monto mínimo por voto: ${ethers.utils.formatEther(minimumFixedBet)} AVAX`);
  
  // Pools por creador
  console.log("\n👤 POOLS POR CREADOR:");
  const deployerPools = await pollPool.getPoolsByCreator(deployer.address);
  const user1Pools = await pollPool.getPoolsByCreator(user1.address);
  const user2Pools = await pollPool.getPoolsByCreator(user2.address);
  
  console.log(`   Deployer: ${deployerPools.length} pools`);
  console.log(`   User1: ${user1Pools.length} pools`);
  console.log(`   User2: ${user2Pools.length} pools`);
  
  console.log("\n🎉 Demo completado exitosamente!");
}

function getStatusName(status) {
  const statusNames = ["Abierto", "Cerrado", "Validado", "Cancelado"];
  return statusNames[status] || "Desconocido";
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error durante el demo:", error);
    process.exit(1);
  });