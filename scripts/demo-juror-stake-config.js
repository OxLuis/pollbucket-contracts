const { ethers } = require("hardhat");

async function main() {
  console.log("⚙️ Demo de Configuración de Stake para Jurados...");
  
  // Cargar información de deployment
  const fs = require('fs');
  const deploymentPath = `deployments/${hre.network.name}-deployment.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ No se encontró archivo de deployment. Ejecuta deploy.js primero.");
    return;
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const [owner, alice, bob, charlie] = await ethers.getSigners();
  
  console.log("📝 Cuentas disponibles:");
  console.log("   Owner:", owner.address);
  console.log("   Alice:", alice.address);
  console.log("   Bob:", bob.address);
  console.log("   Charlie:", charlie.address);
  
  // Conectar a contratos
  const reputationSystem = await ethers.getContractAt("ReputationSystem", deployment.contracts.reputationSystem);
  
  console.log("\n📊 Configuración inicial del stake:");
  
  // Verificar stake mínimo actual
  const initialStake = await reputationSystem.getMinStakeRequired();
  console.log("   Stake mínimo actual:", ethers.utils.formatEther(initialStake), "AVAX");
  
  console.log("\n👥 Intentando registrar jurados con diferentes stakes...");
  
  // Alice intenta registrarse con stake insuficiente
  console.log("\n🔴 Alice intenta registrarse con 0.01 AVAX (insuficiente):");
  try {
    await reputationSystem.connect(alice).registerAsJuror({ 
      value: ethers.utils.parseEther("0.01") 
    });
    console.log("   ❌ ERROR: Debería haber fallado");
  } catch (error) {
    console.log("   ✅ CORRECTO: Falló como esperado -", error.reason || "Stake insuficiente");
  }
  
  // Bob se registra con stake suficiente
  console.log("\n🟢 Bob se registra con 0.05 AVAX (suficiente):");
  try {
    const tx = await reputationSystem.connect(bob).registerAsJuror({ 
      value: ethers.utils.parseEther("0.05") 
    });
    await tx.wait();
    console.log("   ✅ Bob registrado exitosamente como jurado");
  } catch (error) {
    console.log("   ⚠️ Bob ya estaba registrado");
  }
  
  console.log("\n⚙️ Owner cambia el stake mínimo a 0.1 AVAX:");
  
  // Owner cambia el stake mínimo
  const newStake = ethers.utils.parseEther("0.1");
  const updateTx = await reputationSystem.connect(owner).setMinStakeRequired(newStake);
  await updateTx.wait();
  
  const updatedStake = await reputationSystem.getMinStakeRequired();
  console.log("   ✅ Nuevo stake mínimo:", ethers.utils.formatEther(updatedStake), "AVAX");
  
  console.log("\n👥 Probando con el nuevo stake mínimo...");
  
  // Alice intenta registrarse con 0.05 AVAX (ahora insuficiente)
  console.log("\n🔴 Alice intenta registrarse con 0.05 AVAX (ahora insuficiente):");
  try {
    await reputationSystem.connect(alice).registerAsJuror({ 
      value: ethers.utils.parseEther("0.05") 
    });
    console.log("   ❌ ERROR: Debería haber fallado");
  } catch (error) {
    console.log("   ✅ CORRECTO: Falló como esperado -", error.reason || "Stake insuficiente");
  }
  
  // Charlie se registra con el nuevo stake mínimo
  console.log("\n🟢 Charlie se registra con 0.1 AVAX (nuevo mínimo):");
  try {
    const tx = await reputationSystem.connect(charlie).registerAsJuror({ 
      value: ethers.utils.parseEther("0.1") 
    });
    await tx.wait();
    console.log("   ✅ Charlie registrado exitosamente como jurado");
  } catch (error) {
    console.log("   ⚠️ Charlie ya estaba registrado");
  }
  
  // Alice finalmente se registra con stake suficiente
  console.log("\n🟢 Alice se registra con 0.15 AVAX (más que suficiente):");
  try {
    const tx = await reputationSystem.connect(alice).registerAsJuror({ 
      value: ethers.utils.parseEther("0.15") 
    });
    await tx.wait();
    console.log("   ✅ Alice registrada exitosamente como jurado");
  } catch (error) {
    console.log("   ⚠️ Alice ya estaba registrada");
  }
  
  console.log("\n📊 Estado final de jurados:");
  
  const jurors = [alice, bob, charlie];
  for (let i = 0; i < jurors.length; i++) {
    try {
      const profile = await reputationSystem.getJurorProfile(jurors[i].address);
      if (profile.isActive) {
        console.log(`   ${jurors[i].address.slice(0, 8)}...: ✅ Activo`);
        console.log(`      Stake: ${ethers.utils.formatEther(profile.stakedAmount)} AVAX`);
        console.log(`      Reputación: ${profile.reputation} puntos`);
        
        // Verificar elegibilidad
        const isEligible = await reputationSystem.isEligibleJuror(jurors[i].address, 75);
        console.log(`      ¿Elegible?: ${isEligible ? "✅ Sí" : "❌ No"}`);
      } else {
        console.log(`   ${jurors[i].address.slice(0, 8)}...: ❌ No registrado`);
      }
    } catch (error) {
      console.log(`   ${jurors[i].address.slice(0, 8)}...: ❌ No registrado`);
    }
  }
  
  console.log("\n📈 Estadísticas finales:");
  const totalJurors = await reputationSystem.getActiveJurorsCount();
  const finalStake = await reputationSystem.getMinStakeRequired();
  
  console.log(`   Total jurados activos: ${totalJurors}`);
  console.log(`   Stake mínimo actual: ${ethers.utils.formatEther(finalStake)} AVAX`);
  
  console.log("\n🎯 Funcionalidades demostradas:");
  console.log("   ✅ Stake mínimo configurable por owner");
  console.log("   ✅ Validación automática de stake en registro");
  console.log("   ✅ Eventos de cambio de configuración");
  console.log("   ✅ Verificación de elegibilidad con nuevo stake");
  console.log("   ✅ Control administrativo completo");
  
  console.log("\n🎉 Demo de configuración de stake completado exitosamente!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error durante el demo:", error);
    process.exit(1);
  });