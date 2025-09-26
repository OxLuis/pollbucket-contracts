const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Iniciando deployment de PollBucket...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying con la cuenta:", deployer.address);
  console.log("💰 Balance de la cuenta:", ethers.utils.formatEther(await deployer.getBalance()));

  // Deploy Factory
  console.log("\n📦 Deploying PollBucketFactory...");
  const PollBucketFactory = await ethers.getContractFactory("PollBucketFactory");
  const factory = await PollBucketFactory.deploy();
  await factory.deployed();
  
  console.log("✅ PollBucketFactory deployed to:", factory.address);

  // Deploy toda la plataforma usando el factory
  console.log("\n🏗️ Deploying plataforma completa...");
  const deployTx = await factory.deployPlatform();
  const receipt = await deployTx.wait();
  
  // Obtener las direcciones de los contratos deployados
  const deployedContracts = await factory.getDeployedContracts();
  
  console.log("\n🎉 ¡Deployment completado exitosamente!");
  console.log("📋 Direcciones de contratos:");
  console.log("   🏪 PollPool:", deployedContracts.pollPool);
  console.log("   ⭐ ReputationSystem:", deployedContracts.reputationSystem);
  console.log("   ⚖️ JurySystem:", deployedContracts.jurySystem);
  console.log("   🏛️ PlatformGovernance:", deployedContracts.platformGovernance);
  console.log("   🏭 Factory:", factory.address);
  
  // Guardar direcciones en archivo JSON
  const fs = require('fs');
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    contracts: {
      factory: factory.address,
      pollPool: deployedContracts.pollPool,
      reputationSystem: deployedContracts.reputationSystem,
      jurySystem: deployedContracts.jurySystem,
      platformGovernance: deployedContracts.platformGovernance
    },
    gasUsed: receipt.gasUsed.toString(),
    transactionHash: receipt.transactionHash
  };
  
  fs.writeFileSync(
    `deployments/${hre.network.name}-deployment.json`, 
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log(`\n💾 Información de deployment guardada en deployments/${hre.network.name}-deployment.json`);
  
  // Verificar contratos en testnet/mainnet
  if (hre.network.name !== "hardhat") {
    console.log("\n🔍 Esperando confirmaciones para verificación...");
    await factory.deployTransaction.wait(6);
    
    try {
      await hre.run("verify:verify", {
        address: factory.address,
        constructorArguments: [],
      });
      console.log("✅ Factory verificado en el explorer");
    } catch (error) {
      console.log("❌ Error verificando Factory:", error.message);
    }
  }
  
  console.log("\n🎊 ¡PollBucket está listo para usar!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error durante el deployment:", error);
    process.exit(1);
  });