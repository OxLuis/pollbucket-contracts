const { ethers } = require("hardhat");

async function main() {
  console.log("🛡️ Demo de Prevención de Conflictos de Interés...");
  
  // Cargar información de deployment
  const fs = require('fs');
  const deploymentPath = `deployments/${hre.network.name}-deployment.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ No se encontró archivo de deployment. Ejecuta deploy.js primero.");
    return;
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const [deployer, alice, bob, charlie, david, eve] = await ethers.getSigners();
  
  console.log("📝 Cuentas disponibles:");
  console.log("   Deployer:", deployer.address);
  console.log("   Alice:", alice.address);
  console.log("   Bob:", bob.address);
  console.log("   Charlie:", charlie.address);
  console.log("   David:", david.address);
  console.log("   Eve:", eve.address);
  
  // Conectar a contratos
  const pollPool = await ethers.getContractAt("PollPool", deployment.contracts.pollPool);
  const reputationSystem = await ethers.getContractAt("ReputationSystem", deployment.contracts.reputationSystem);
  const jurySystem = await ethers.getContractAt("JurySystem", deployment.contracts.jurySystem);
  
  console.log("\n👨‍⚖️ Registrando jurados...");
  
  // Registrar múltiples jurados
  const jurors = [alice, bob, charlie, david, eve];
  const stakeAmount = ethers.utils.parseEther("0.1");
  
  for (let i = 0; i < jurors.length; i++) {
    try {
      const tx = await reputationSystem.connect(jurors[i]).registerAsJuror({ value: stakeAmount });
      await tx.wait();
      console.log(`   ✅ ${jurors[i].address.slice(0, 8)}... registrado como jurado`);
    } catch (error) {
      console.log(`   ⚠️ ${jurors[i].address.slice(0, 8)}... ya registrado`);
    }
  }
  
  console.log("\n🏗️ Creando pool de demostración...");
  
  // Crear pool con monto fijo
  const fixedAmount = ethers.utils.parseEther("0.05");
  const createTx = await pollPool.connect(deployer).createPool(
    "¿Cuál será el resultado del partido?",
    ["Equipo A gana", "Empate", "Equipo B gana"],
    Math.floor(Date.now() / 1000) + (1 * 60 * 60), // 1 hora
    10, // Máximo 10 participantes
    fixedAmount,
    { value: fixedAmount }
  );
  const receipt = await createTx.wait();
  
  const poolCreatedEvent = receipt.events.find(e => e.event === 'PoolCreated');
  const poolId = poolCreatedEvent.args.poolId;
  
  console.log("✅ Pool creado con ID:", poolId.toString());
  
  console.log("\n👥 Agregando participantes al pool...");
  
  // Alice y Bob participan en el pool (tendrán conflicto de interés)
  await pollPool.connect(alice).placeBet(poolId, 0, { value: fixedAmount });
  console.log("   ✅ Alice participó en el pool (opción 0)");
  
  await pollPool.connect(bob).placeBet(poolId, 1, { value: fixedAmount });
  console.log("   ✅ Bob participó en el pool (opción 1)");
  
  // Charlie, David y Eve NO participan (serán elegibles como jurados)
  console.log("   ℹ️ Charlie, David y Eve NO participaron (elegibles como jurados)");
  
  console.log("\n🔍 Verificando conflictos de interés ANTES de cerrar el pool...");
  
  for (let i = 0; i < jurors.length; i++) {
    const [hasConflict, reason] = await jurySystem.hasConflictOfInterest(poolId, jurors[i].address);
    const status = hasConflict ? "❌ CONFLICTO" : "✅ SIN CONFLICTO";
    console.log(`   ${jurors[i].address.slice(0, 8)}...: ${status} - ${reason}`);
  }
  
  // Obtener estadísticas de conflictos
  const [totalEligible, conflicted, available] = await jurySystem.getConflictStats(poolId);
  console.log("\n📊 Estadísticas de conflictos:");
  console.log(`   Total elegibles por reputación: ${totalEligible}`);
  console.log(`   Con conflicto de interés: ${conflicted}`);
  console.log(`   Disponibles sin conflicto: ${available}`);
  
  console.log("\n🔒 Cerrando pool para activar validación...");
  
  // Cerrar el pool
  const closeTx = await pollPool.connect(deployer).closePool(poolId);
  await closeTx.wait();
  
  console.log("✅ Pool cerrado, validación iniciada");
  
  // Obtener información de la validación
  const validation = await jurySystem.getValidation(poolId);
  console.log("\n⚖️ Jurados asignados para validación:");
  
  for (let i = 0; i < validation.assignedJurors.length; i++) {
    const jurorAddress = validation.assignedJurors[i];
    const participated = await pollPool.hasUserParticipated(poolId, jurorAddress);
    const status = participated ? "❌ PARTICIPÓ" : "✅ NO PARTICIPÓ";
    console.log(`   Jurado ${i + 1}: ${jurorAddress.slice(0, 8)}... - ${status}`);
  }
  
  console.log("\n🎯 Verificación de integridad:");
  
  let allJurorsClean = true;
  for (let i = 0; i < validation.assignedJurors.length; i++) {
    const jurorAddress = validation.assignedJurors[i];
    const participated = await pollPool.hasUserParticipated(poolId, jurorAddress);
    if (participated) {
      allJurorsClean = false;
      console.log(`   ❌ ERROR: Jurado ${jurorAddress} participó en el pool`);
    }
  }
  
  if (allJurorsClean) {
    console.log("   ✅ ÉXITO: Ningún jurado asignado participó en el pool");
    console.log("   ✅ Sistema de prevención de conflictos funcionando correctamente");
  }
  
  console.log("\n📋 Resumen del sistema:");
  console.log("   🛡️ Prevención automática de conflictos de interés");
  console.log("   🔍 Filtrado de participantes antes de asignación");
  console.log("   📊 Estadísticas de conflictos disponibles");
  console.log("   📝 Eventos de tracking para jurados excluidos");
  console.log("   ⚖️ Integridad garantizada en el proceso de validación");
  
  console.log("\n🎉 Demo de prevención de conflictos completado exitosamente!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error durante el demo:", error);
    process.exit(1);
  });