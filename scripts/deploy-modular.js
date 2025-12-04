const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 Deployment Modular de PollBucket");
  console.log("=".repeat(50));
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying con la cuenta:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "AVAX");

  const contracts = {};
  
  // PASO 1: Deploy ReputationSystem (independiente)
  console.log("\n📦 1. Deploying ReputationSystem...");
  const ReputationSystem = await ethers.getContractFactory("ReputationSystem");
  const reputationSystem = await ReputationSystem.deploy();
  await reputationSystem.waitForDeployment();
  contracts.reputationSystem = await reputationSystem.getAddress();
  console.log("✅ ReputationSystem:", contracts.reputationSystem);

  // PASO 2: Deploy JurySystem (necesita ReputationSystem, PollPool se configura después)
  console.log("\n📦 2. Deploying JurySystem...");
  const JurySystem = await ethers.getContractFactory("JurySystem");
  const jurySystem = await JurySystem.deploy(
    contracts.reputationSystem,  // ReputationSystem
    ethers.ZeroAddress  // PollPool (se configura después)
  );
  await jurySystem.waitForDeployment();
  contracts.jurySystem = await jurySystem.getAddress();
  console.log("✅ JurySystem:", contracts.jurySystem);

  // PASO 3: Deploy PollPool (necesita ReputationSystem y JurySystem)
  console.log("\n📦 3. Deploying PollPool...");
  const PollPool = await ethers.getContractFactory("PollPool");
  const pollPool = await PollPool.deploy(
    contracts.reputationSystem,  // ReputationSystem
    contracts.jurySystem        // JurySystem
  );
  await pollPool.waitForDeployment();
  contracts.pollPool = await pollPool.getAddress();
  console.log("✅ PollPool:", contracts.pollPool);

  // PASO 4: Deploy PlatformGovernance (necesita todos los anteriores)
  console.log("\n📦 4. Deploying PlatformGovernance...");
  const PlatformGovernance = await ethers.getContractFactory("PlatformGovernance");
  const governance = await PlatformGovernance.deploy(
    contracts.pollPool,         // PollPool
    contracts.reputationSystem, // ReputationSystem
    contracts.jurySystem       // JurySystem
  );
  await governance.waitForDeployment();
  contracts.platformGovernance = await governance.getAddress();
  console.log("✅ PlatformGovernance:", contracts.platformGovernance);

  // PASO 5: Configurar referencias cruzadas
  console.log("\n🔗 5. Configurando referencias entre contratos...");
  
  // JurySystem necesita conocer PollPool
  await jurySystem.updatePollPool(contracts.pollPool);
  console.log("   ✅ JurySystem → PollPool configurado");
  
  // ReputationSystem autoriza a JurySystem
  await reputationSystem.addAuthorizedCaller(contracts.jurySystem);
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
  const path = require('path');
  
  // Crear directorios si no existen
  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }
  if (!fs.existsSync('deployments/history')) {
    fs.mkdirSync('deployments/history');
  }
  
  const network = await ethers.provider.getNetwork();
  const timestamp = new Date();
  const deploymentId = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  // Obtener información de transacciones
  const reputationTx = reputationSystem.deploymentTransaction();
  const juryTx = jurySystem.deploymentTransaction();
  const pollTx = pollPool.deploymentTransaction();
  const governanceTx = governance.deploymentTransaction();
  
  // Información básica del deployment
  const deploymentInfo = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    deploymentTime: timestamp.toISOString(),
    blockNumber: Number(await ethers.provider.getBlockNumber()),
    contracts: contracts,
    transactionHashes: {
      reputationSystem: reputationTx?.hash || "N/A",
      jurySystem: juryTx?.hash || "N/A",
      pollPool: pollTx?.hash || "N/A",
      platformGovernance: governanceTx?.hash || "N/A"
    }
  };
  
  // Información detallada para el historial
  const historyInfo = {
    deploymentId: `${deploymentId}_${hre.network.name}`,
    timestamp: timestamp.toISOString(),
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployer: deployer.address,
    deploymentType: "full",
    contracts: {
      pollPool: {
        address: contracts.pollPool,
        txHash: pollTx?.hash || "N/A",
        blockNumber: "N/A" // Se obtendría del receipt
      },
      reputationSystem: {
        address: contracts.reputationSystem,
        txHash: reputationTx?.hash || "N/A",
        blockNumber: "N/A"
      },
      jurySystem: {
        address: contracts.jurySystem,
        txHash: juryTx?.hash || "N/A",
        blockNumber: "N/A"
      },
      platformGovernance: {
        address: contracts.platformGovernance,
        txHash: governanceTx?.hash || "N/A",
        blockNumber: "N/A"
      }
    },
    changes: [
      "Initial deployment of all contracts",
      "Configured cross-contract references",
      "Set up ReputationSystem authorization for JurySystem",
      "Maintained deployer ownership for flexibility"
    ],
    notes: `Full modular deployment to ${hre.network.name} network`
  };
  
  // Guardar archivo principal
  fs.writeFileSync(
    `deployments/${hre.network.name}-modular-deployment.json`, 
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  // Guardar archivo de historial con timestamp
  const historyFileName = `${deploymentId}_${hre.network.name}.json`;
  fs.writeFileSync(
    `deployments/history/${historyFileName}`, 
    JSON.stringify(historyInfo, null, 2)
  );
  
  console.log(`   ✅ Guardado en deployments/${hre.network.name}-modular-deployment.json`);
  console.log(`   ✅ Historial guardado en deployments/history/${historyFileName}`);

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