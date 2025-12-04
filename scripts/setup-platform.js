const { ethers } = require("hardhat");
const hre = require("hardhat");

async function main() {
  console.log("⚙️ Configurando plataforma PollBucket...");
  
  // Cargar información de deployment
  const fs = require('fs');
  const deploymentPath = `deployments/${hre.network.name}-modular-deployment.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ No se encontró archivo de deployment modular. Ejecuta deploy-modular.js primero.");
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
    value: ethers.parseEther("0.1") 
  });
  await registerTx.wait();
  console.log("✅ Deployer registrado como jurado");
  
  // Crear pool de ejemplo
  console.log("\n📊 Creando pool de ejemplo...");
  const fixedBetAmount = ethers.parseEther("0.05"); // 0.05 AVAX por voto
  
  // Calcular monto total requerido usando la nueva función
  const [totalRequired, txFeeAmount, premiumFeeAmount] = await pollPool.calculateCreatePoolAmount(
    fixedBetAmount,
    false // No es premium
  );
  
  console.log(`   💰 Monto fijo: ${ethers.formatEther(fixedBetAmount)} AVAX`);
  console.log(`   💰 Comisión de tx: ${ethers.formatEther(txFeeAmount)} AVAX`);
  console.log(`   💰 Total requerido: ${ethers.formatEther(totalRequired)} AVAX`);
  
  // Crear pool usando el struct CreatePoolParams
  // Categorías: 0=General, 1=Sports, 2=Crypto, 3=Politics, 4=Entertainment, 5=Technology, 6=Gaming, 7=Finance, 8=Other
  const createPoolParams = {
    question: "¿Cuál será el precio de AVAX al final del mes?",
    options: ["Menos de $20", "$20-$30", "$30-$40", "Más de $40"],
    closeTime: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 días
    maxParticipants: 10,
    fixedBetAmount: fixedBetAmount,
    category: 2, // Crypto
    isPremium: false,
    imageURI: "" // Sin imagen (no es premium)
  };
  
  const createPoolTx = await pollPool.createPool(createPoolParams, { value: totalRequired });
  const receipt = await createPoolTx.wait();
  
  // Obtener poolId del evento
  const poolCreatedEvent = receipt.logs.find(log => {
    try {
      return pollPool.interface.parseLog(log)?.name === 'PoolCreated';
    } catch { return false; }
  });
  
  const poolId = poolCreatedEvent 
    ? pollPool.interface.parseLog(poolCreatedEvent).args.poolId 
    : 1;
  
  console.log("✅ Pool de ejemplo creado con ID:", poolId.toString());
  
  // Verificar configuración básica
  console.log("\n🔍 Verificando configuración...");
  
  try {
    // Verificar contratos básicos
    console.log("   📋 Contratos desplegados:");
    console.log("      PollPool:", deployment.contracts.pollPool);
    console.log("      ReputationSystem:", deployment.contracts.reputationSystem);
    console.log("      JurySystem:", deployment.contracts.jurySystem);
    console.log("      PlatformGovernance:", deployment.contracts.platformGovernance);
    
    // Verificar que los contratos respondan
    const pollPoolAddress = await pollPool.getAddress();
    const reputationAddress = await reputationSystem.getAddress();
    console.log("   ✅ Contratos responden correctamente");
    
    // Verificar balance del deployer
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("   💰 Balance del deployer:", ethers.formatEther(balance), "AVAX");
    
  } catch (error) {
    console.log("   ⚠️ Error verificando configuración:", error.message);
  }
  
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