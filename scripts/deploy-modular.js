const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 Deployment Modular de PollBucket");
  console.log("=" * 50);
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying con la cuenta:", deployer.address);
  console.log("💰 Balance:", ethers.utils.formatEther(await deployer.getBalance()), "AVAX");

  const contracts = {};
  
  // PASO 1: Deploy ReputationSystem (independiente)
  console.log("\n📦 1. Deploying ReputationSystem...");
  const ReputationSystem = await ethers.getContractFactory("ReputationSystem");
  const reputationSystem = await ReputationSystem.deploy();
  await reputationSystem.deployed();
  contracts.reputationSystem = reputationSystem.address;
  console.log("✅ ReputationSystem:", reputationSystem.address);

  // PASO 2: Deploy JurySystem (necesita ReputationSystem, PollPool se configura después)
  console.log("\n📦 2. Deploying JurySystem...");
  const JurySystem = await ethers.getContractFactory("JurySystem");
  const jurySystem = await JurySystem.deploy(
    reputationSystem.address,  // ReputationSystem
    ethers.constants.AddressZero  // PollPool (se configura después)
  );
  await jurySystem.deployed();
  contracts.jurySystem = jurySystem.address;
  console.log("✅ JurySystem:", jurySystem.address);

  // PASO 3: Deploy PollPool (necesita ReputationSystem y JurySystem)
  console.log("\n📦 3. Deploying PollPool...");
  const PollPool = await ethers.getContractFactory("PollPool");
  const pollPool = await PollPool.deploy(
    reputationSystem.address,  // ReputationSystem
    jurySystem.address        // JurySystem
  );
  await pollPool.deployed();
  contracts.pollPool = pollPool.address;
  console.log("✅ PollPool:", pollPool.address);

  // PASO 4: Deploy PlatformGovernance (necesita todos los anteriores)
  console.log("\n📦 4. Deploying PlatformGovernance...");
  const PlatformGovernance = await ethers.getContractFactory("PlatformGovernance");
  const governance = await PlatformGovernance.deploy(
    pollPool.address,         // PollPool
    reputationSystem.address, // ReputationSystem
    jurySystem.address       // JurySystem
  );
  await governance.deployed();
  contracts.platformGovernance = governance.address;
  console.log("✅ PlatformGovernance:", governance.address);

  // PASO 5: Configurar referencias cruzadas
  console.log("\n🔗 5. Configurando referencias entre contratos...");
  
  // JurySystem necesita conocer PollPool
  await jurySystem.updatePollPool(pollPool.address);
  console.log("   ✅ JurySystem → PollPool configurado");
  
  // ReputationSystem autoriza a JurySystem
  await reputationSystem.addAuthorizedCaller(jurySystem.address);
  console.log("   ✅ ReputationSystem autoriza JurySystem");

  // PASO 6: Transferir ownership a PlatformGovernance (opcional)
  console.log("\n👑 6. Configurando ownership...");
  
  console.log("   ⚠️ Manteniendo ownership en deployer para flexibilidad");
  console.log("   💡 Puedes transferir después con transferOwnership()");
  
  // Opcional: Transferir a governance
  // await reputationSystem.transferOwnership(governance.address);
  // await jurySystem.transferOwnership(governance.address);
  // await pollPool.transferOwnership(governance.address);

  // PASO 7: Guardar información del deployment
  console.log("\n💾 7. Guardando información del deployment...");
  
  const fs = require('fs');
  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }
  
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
    contracts: contracts,
    gasUsed: {
      reputationSystem: reputationSystem.deployTransaction.gasLimit?.toString() || "N/A",
      jurySystem: jurySystem.deployTransaction.gasLimit?.toString() || "N/A",
      pollPool: pollPool.deployTransaction.gasLimit?.toString() || "N/A",
      platformGovernance: governance.deployTransaction.gasLimit?.toString() || "N/A"
    },
    transactionHashes: {
      reputationSystem: reputationSystem.deployTransaction.hash,
      jurySystem: jurySystem.deployTransaction.hash,
      pollPool: pollPool.deployTransaction.hash,
      platformGovernance: governance.deployTransaction.hash
    }
  };
  
  fs.writeFileSync(
    `deployments/${hre.network.name}-modular-deployment.json`, 
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log(`   ✅ Guardado en deployments/${hre.network.name}-modular-deployment.json`);

  // PASO 8: Mostrar resumen
  console.log("\n🎉 ¡Deployment modular completado!");
  console.log("📋 Direcciones de contratos:");
  console.log("   🏪 PollPool:", contracts.pollPool);
  console.log("   ⭐ ReputationSystem:", contracts.reputationSystem);
  console.log("   ⚖️ JurySystem:", contracts.jurySystem);
  console.log("   🏛️ PlatformGovernance:", contracts.platformGovernance);
  
  console.log("\n🔧 Próximos pasos:");
  console.log("   1. Ejecutar setup: npx hardhat run scripts/setup-platform.js --network", hre.network.name);
  console.log("   2. Para actualizar un contrato: npx hardhat run scripts/update-contract.js --network", hre.network.name);
  console.log("   3. Para verificar contratos: npx hardhat run scripts/verify-contracts.js --network", hre.network.name);
  
  return contracts;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error durante el deployment:", error);
    process.exit(1);
  });