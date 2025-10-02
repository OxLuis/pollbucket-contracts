const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying SimplePollPool (Solo para crear polls)...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying con la cuenta:", deployer.address);
  console.log("💰 Balance de la cuenta:", ethers.utils.formatEther(await deployer.getBalance()));

  // Deploy SimplePollPool
  console.log("\n📦 Deploying SimplePollPool...");
  const SimplePollPool = await ethers.getContractFactory("SimplePollPool");
  const simplePollPool = await SimplePollPool.deploy();
  await simplePollPool.deployed();
  
  console.log("✅ SimplePollPool deployed to:", simplePollPool.address);

  // Crear directorio de deployments si no existe
  const fs = require('fs');
  if (!fs.existsSync('deployments')) {
    fs.mkdirSync('deployments');
  }
  
  // Guardar información del deployment
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    contract: {
      name: "SimplePollPool",
      address: simplePollPool.address
    },
    gasUsed: simplePollPool.deployTransaction.gasLimit?.toString() || "N/A",
    transactionHash: simplePollPool.deployTransaction.hash
  };
  
  fs.writeFileSync(
    `deployments/${hre.network.name}-simple-deployment.json`, 
    JSON.stringify(deploymentInfo, null, 2)
  );
  
  console.log(`\n💾 Información de deployment guardada en deployments/${hre.network.name}-simple-deployment.json`);
  
  // Mostrar configuración inicial
  console.log("\n📊 Configuración inicial:");
  const minFixedBet = await simplePollPool.minimumFixedBetAmount();
  const platformFee = await simplePollPool.platformFee();
  const creatorCommission = await simplePollPool.creatorCommission();
  
  console.log("   Monto mínimo por voto:", ethers.utils.formatEther(minFixedBet), "AVAX");
  console.log("   Fee de plataforma:", (platformFee / 100).toString(), "%");
  console.log("   Comisión de creadores:", (creatorCommission / 100).toString(), "%");
  
  // Verificar contrato en testnet/mainnet
  if (hre.network.name !== "hardhat") {
    console.log("\n🔍 Esperando confirmaciones para verificación...");
    await simplePollPool.deployTransaction.wait(6);
    
    try {
      await hre.run("verify:verify", {
        address: simplePollPool.address,
        constructorArguments: [],
      });
      console.log("✅ SimplePollPool verificado en el explorer");
    } catch (error) {
      console.log("❌ Error verificando SimplePollPool:", error.message);
    }
  }
  
  console.log("\n🎊 ¡SimplePollPool está listo para usar!");
  console.log("\n📋 Próximos pasos:");
  console.log("   1. Crear pools usando simplePollPool.createPool()");
  console.log("   2. Los usuarios pueden apostar usando simplePollPool.placeBet()");
  console.log("   3. Cerrar pools usando simplePollPool.closePool()");
  console.log("   4. Resolver pools usando simplePollPool.resolvePool()");
  console.log("   5. Distribuir recompensas usando simplePollPool.distributeRewards()");
  
  console.log("\n⚠️ NOTA: Esta versión NO incluye sistema de jurados.");
  console.log("   El creador del pool debe resolver manualmente el resultado.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error durante el deployment:", error);
    process.exit(1);
  });