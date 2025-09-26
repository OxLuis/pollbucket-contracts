const { ethers } = require("hardhat");

async function main() {
  console.log("⚙️ Configurando plataforma PollBucket...");
  
  // Cargar información de deployment
  const fs = require('fs');
  const deploymentPath = `deployments/${hre.network.name}-deployment.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ No se encontró archivo de deployment. Ejecuta deploy.js primero.");
    return;
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const [deployer] = await ethers.getSigners();
  
  console.log("📝 Configurando con la cuenta:", deployer.address);
  
  // Conectar a contratos
  const pollPool = await ethers.getContractAt("PollPool", deployment.contracts.pollPool);
  const reputationSystem = await ethers.getContractAt("ReputationSystem", deployment.contracts.reputationSystem);
  const jurySystem = await ethers.getContractAt("JurySystem", deployment.contracts.jurySystem);
  const governance = await ethers.getContractAt("PlatformGovernance", deployment.contracts.platformGovernance);
  
  console.log("\n🔧 Configuración inicial...");
  
  // Registrar deployer como primer jurado
  console.log("👨‍⚖️ Registrando deployer como jurado inicial...");
  const registerTx = await reputationSystem.registerAsJuror({ 
    value: ethers.utils.parseEther("0.1") 
  });
  await registerTx.wait();
  console.log("✅ Deployer registrado como jurado");
  
  // Crear pool de ejemplo
  console.log("\n📊 Creando pool de ejemplo...");
  const fixedBetAmount = ethers.utils.parseEther("0.05"); // 0.05 AVAX por voto
  const createPoolTx = await pollPool.createPool(
    "¿Cuál será el precio de AVAX al final del mes?",
    ["Menos de $20", "$20-$30", "$30-$40", "Más de $40"],
    Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 días
    10, // Máximo 10 participantes
    fixedBetAmount, // Monto fijo por voto
    { value: fixedBetAmount } // El creador paga el mismo monto
  );
  const receipt = await createPoolTx.wait();
  
  // Obtener ID del pool creado
  const poolCreatedEvent = receipt.events.find(e => e.event === 'PoolCreated');
  const poolId = poolCreatedEvent.args.poolId;
  
  console.log("✅ Pool de ejemplo creado con ID:", poolId.toString());
  
  // Verificar configuración
  console.log("\n🔍 Verificando configuración...");
  
  const jurorProfile = await reputationSystem.getJurorProfile(deployer.address);
  console.log("   Reputación del deployer:", jurorProfile.reputation.toString());
  console.log("   Stake del deployer:", ethers.utils.formatEther(jurorProfile.stakedAmount), "AVAX");
  
  // Obtener información completa del pool
  const poolInfo = await pollPool.getPoolInfo(poolId);
  console.log("   📊 Información del Pool:");
  console.log("      Total AVAX acumulado:", ethers.utils.formatEther(poolInfo.totalAvax), "AVAX");
  console.log("      Participantes:", poolInfo.currentParticipants.toString(), "/", 
              poolInfo.maxParticipants.toString() === "0" ? "∞" : poolInfo.maxParticipants.toString());
  console.log("      Tiempo restante:", poolInfo.daysRemaining.toString(), "días,", 
              poolInfo.hoursRemaining.toString(), "horas,", poolInfo.minutesRemaining.toString(), "minutos");
  console.log("      Monto fijo por voto:", ethers.utils.formatEther(poolInfo.fixedBetAmount), "AVAX");
  console.log("      Estado:", poolInfo.status === 0 ? "Abierto" : "Cerrado");
  
  // Verificar si se puede unir al pool
  const [canJoin, reason] = await pollPool.canJoinPool(poolId);
  console.log("      ¿Se puede unir?:", canJoin ? "Sí" : "No -", reason);
  
  // Obtener estadísticas del pool
  const poolStats = await pollPool.getPoolStats(poolId);
  console.log("      Ocupación:", poolStats.participantPercentage.toString() + "%");
  console.log("      ¿Está lleno?:", poolStats.isFull ? "Sí" : "No");
  console.log("      ¿Está activo?:", poolStats.isActive ? "Sí" : "No");
  
  const totalPools = await pollPool.getTotalPoolsCount();
  const activePools = await pollPool.getActivePoolsCount();
  console.log("   📈 Estadísticas generales:");
  console.log("      Total pools:", totalPools.toString(), "| Activos:", activePools.toString());
  
  const minimumFixedBet = await pollPool.minimumFixedBetAmount();
  console.log("      Monto mínimo por voto:", ethers.utils.formatEther(minimumFixedBet), "AVAX");
  
  const minStakeRequired = await reputationSystem.getMinStakeRequired();
  console.log("      Stake mínimo para jurados:", ethers.utils.formatEther(minStakeRequired), "AVAX");
  
  const activeJurors = await reputationSystem.getActiveJurorsCount();
  console.log("      Jurados activos:", activeJurors.toString());
  
  console.log("\n🎉 ¡Configuración completada!");
  console.log("🌐 La plataforma PollBucket está lista para usar");
  console.log("\n📋 Próximos pasos:");
  console.log("   1. Registrar más jurados usando reputationSystem.registerAsJuror()");
  console.log("   2. Crear más pools usando pollPool.createPool()");
  console.log("   3. Apostar en pools usando pollPool.placeBet()");
  console.log("   4. Cerrar pools y activar validaciones");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error durante la configuración:", error);
    process.exit(1);
  });