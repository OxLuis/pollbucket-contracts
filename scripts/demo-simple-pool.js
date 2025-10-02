const { ethers } = require("hardhat");

async function main() {
  console.log("🎯 Demo de SimplePollPool (Solo creación de polls)...");
  
  // Cargar información de deployment
  const fs = require('fs');
  const deploymentPath = `deployments/${hre.network.name}-simple-deployment.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ No se encontró archivo de deployment. Ejecuta deploy-simple.js primero.");
    return;
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const [deployer, alice, bob, charlie] = await ethers.getSigners();
  
  console.log("📝 Cuentas disponibles:");
  console.log("   Deployer:", deployer.address);
  console.log("   Alice:", alice.address);
  console.log("   Bob:", bob.address);
  console.log("   Charlie:", charlie.address);
  
  // Conectar al contrato
  const simplePollPool = await ethers.getContractAt("SimplePollPool", deployment.contract.address);
  
  console.log("\n🏗️ Creando pool de demostración...");
  
  // Crear pool con monto fijo
  const fixedAmount = ethers.utils.parseEther("0.05"); // 0.05 AVAX por voto
  const createTx = await simplePollPool.connect(deployer).createPool(
    "¿Cuál será el resultado del partido Argentina vs Brasil?",
    ["Gana Argentina", "Empate", "Gana Brasil"],
    Math.floor(Date.now() / 1000) + (2 * 60 * 60), // 2 horas
    5, // Máximo 5 participantes
    fixedAmount, // Monto fijo por voto
    { value: fixedAmount } // El creador paga el mismo monto
  );
  const receipt = await createTx.wait();
  
  const poolCreatedEvent = receipt.events.find(e => e.event === 'PoolCreated');
  const poolId = poolCreatedEvent.args.poolId;
  
  console.log("✅ Pool creado con ID:", poolId.toString());
  
  console.log("\n👥 Usuarios apostando en el pool...");
  
  // Alice apuesta por Argentina
  await simplePollPool.connect(alice).placeBet(poolId, 0, { value: fixedAmount });
  console.log("   ✅ Alice apostó por 'Gana Argentina'");
  
  // Bob apuesta por Empate
  await simplePollPool.connect(bob).placeBet(poolId, 1, { value: fixedAmount });
  console.log("   ✅ Bob apostó por 'Empate'");
  
  // Charlie apuesta por Brasil
  await simplePollPool.connect(charlie).placeBet(poolId, 2, { value: fixedAmount });
  console.log("   ✅ Charlie apostó por 'Gana Brasil'");
  
  console.log("\n📊 Información del pool:");
  
  // Obtener información completa del pool
  const poolInfo = await simplePollPool.getPoolInfo(poolId);
  console.log("   Total AVAX acumulado:", ethers.utils.formatEther(poolInfo.totalAvax), "AVAX");
  console.log("   Participantes:", poolInfo.currentParticipants.toString(), "/", 
              poolInfo.maxParticipants.toString());
  console.log("   Tiempo restante:", poolInfo.hoursRemaining.toString(), "horas,", 
              poolInfo.minutesRemaining.toString(), "minutos");
  console.log("   Monto fijo por voto:", ethers.utils.formatEther(poolInfo.fixedBetAmount), "AVAX");
  console.log("   Estado:", getStatusName(poolInfo.status));
  
  // Mostrar distribución de apuestas
  console.log("\n📈 Distribución de apuestas:");
  const pool = await simplePollPool.getPool(poolId);
  for (let i = 0; i < pool.options.length; i++) {
    const optionTotal = await simplePollPool.optionTotals(poolId, i);
    console.log(`   ${pool.options[i]}: ${ethers.utils.formatEther(optionTotal)} AVAX`);
  }
  
  console.log("\n🔒 Cerrando el pool...");
  
  // Cerrar el pool
  const closeTx = await simplePollPool.connect(deployer).closePool(poolId);
  await closeTx.wait();
  console.log("   ✅ Pool cerrado por el creador");
  
  console.log("\n⚖️ Resolviendo el pool (Argentina gana)...");
  
  // Resolver el pool - Argentina gana (opción 0)
  const resolveTx = await simplePollPool.connect(deployer).resolvePool(poolId, 0);
  await resolveTx.wait();
  console.log("   ✅ Pool resuelto: 'Gana Argentina' es la respuesta correcta");
  
  console.log("\n💰 Distribuyendo recompensas...");
  
  // Distribuir recompensas
  const distributeTx = await simplePollPool.distributeRewards(poolId);
  await distributeTx.wait();
  console.log("   ✅ Recompensas distribuidas");
  
  console.log("\n🏆 Resultados finales:");
  
  // Mostrar ganadores
  const bets = await simplePollPool.getPoolBets(poolId);
  const finalPool = await simplePollPool.getPool(poolId);
  
  console.log("   Opción ganadora:", finalPool.options[finalPool.winningOption]);
  console.log("   Ganadores:");
  
  for (let i = 0; i < bets.length; i++) {
    if (bets[i].option == finalPool.winningOption) {
      const bettor = bets[i].bettor;
      const name = bettor === deployer.address ? "Deployer" :
                   bettor === alice.address ? "Alice" :
                   bettor === bob.address ? "Bob" : "Charlie";
      console.log(`      ${name} (${bettor.slice(0, 8)}...) - Ganó con ${ethers.utils.formatEther(bets[i].amount)} AVAX apostado`);
    }
  }
  
  console.log("\n📊 Estadísticas del sistema:");
  const totalPools = await simplePollPool.getTotalPoolsCount();
  const resolvedPools = await simplePollPool.getPoolsByStatus(2); // Resolved
  
  console.log(`   Total pools creados: ${totalPools}`);
  console.log(`   Pools resueltos: ${resolvedPools.length}`);
  
  console.log("\n🎯 Funcionalidades demostradas:");
  console.log("   ✅ Creación de pools con monto fijo");
  console.log("   ✅ Apuestas de múltiples usuarios");
  console.log("   ✅ Límite de participantes");
  console.log("   ✅ Cierre manual por creador");
  console.log("   ✅ Resolución manual por creador");
  console.log("   ✅ Distribución automática de recompensas");
  console.log("   ✅ Comisiones para creador y plataforma");
  
  console.log("\n⚠️ IMPORTANTE:");
  console.log("   Esta versión NO incluye sistema de jurados");
  console.log("   El creador debe resolver manualmente el resultado");
  console.log("   Ideal para casos donde el resultado es objetivo/verificable");
  
  console.log("\n🎉 Demo completado exitosamente!");
}

function getStatusName(status) {
  const statusNames = ["Abierto", "Cerrado", "Resuelto", "Cancelado"];
  return statusNames[status] || "Desconocido";
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error durante el demo:", error);
    process.exit(1);
  });