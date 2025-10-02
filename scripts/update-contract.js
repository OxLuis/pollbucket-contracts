const { ethers } = require("hardhat");

async function main() {
  console.log("🔄 Actualización de Contrato Individual");
  console.log("=" * 40);
  
  // Cargar deployment existente
  const fs = require('fs');
  const deploymentPath = `deployments/${hre.network.name}-modular-deployment.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ No se encontró deployment modular.");
    console.log("   Ejecuta primero: npx hardhat run scripts/deploy-modular.js --network", hre.network.name);
    return;
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  const [deployer] = await ethers.getSigners();
  
  console.log("📝 Deployer:", deployer.address);
  console.log("🌐 Red:", hre.network.name);
  console.log("📋 Contratos actuales:");
  console.log("   PollPool:", deployment.contracts.pollPool);
  console.log("   ReputationSystem:", deployment.contracts.reputationSystem);
  console.log("   JurySystem:", deployment.contracts.jurySystem);
  console.log("   PlatformGovernance:", deployment.contracts.platformGovernance);
  
  // Menú interactivo (simulado - en producción usarías argumentos de línea de comandos)
  console.log("\n🎯 ¿Qué contrato quieres actualizar?");
  console.log("   1. PollPool");
  console.log("   2. ReputationSystem");
  console.log("   3. JurySystem");
  console.log("   4. PlatformGovernance");
  
  // Para este ejemplo, actualizaremos PollPool
  const contractToUpdate = "PollPool"; // Cambiar según necesidad
  console.log(`\n🔄 Actualizando ${contractToUpdate}...`);
  
  let newAddress;
  
  switch (contractToUpdate) {
    case "PollPool":
      newAddress = await updatePollPool(deployment);
      break;
    case "ReputationSystem":
      newAddress = await updateReputationSystem(deployment);
      break;
    case "JurySystem":
      newAddress = await updateJurySystem(deployment);
      break;
    case "PlatformGovernance":
      newAddress = await updatePlatformGovernance(deployment);
      break;
    default:
      console.error("❌ Contrato no válido");
      return;
  }
  
  // Actualizar archivo de deployment
  deployment.contracts[contractToUpdate.toLowerCase()] = newAddress;
  deployment.lastUpdate = new Date().toISOString();
  deployment.updateHistory = deployment.updateHistory || [];
  deployment.updateHistory.push({
    contract: contractToUpdate,
    oldAddress: deployment.contracts[contractToUpdate.toLowerCase()],
    newAddress: newAddress,
    timestamp: new Date().toISOString(),
    deployer: deployer.address
  });
  
  fs.writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));
  
  console.log("\n✅ Actualización completada!");
  console.log("📝 Nueva dirección:", newAddress);
  console.log("💾 Deployment actualizado:", deploymentPath);
}

async function updatePollPool(deployment) {
  console.log("🏪 Deploying nuevo PollPool...");
  
  const PollPool = await ethers.getContractFactory("PollPool");
  const newPollPool = await PollPool.deploy(
    deployment.contracts.reputationSystem,
    deployment.contracts.jurySystem
  );
  await newPollPool.deployed();
  
  console.log("✅ Nuevo PollPool deployed:", newPollPool.address);
  
  // Actualizar referencias en otros contratos
  console.log("🔗 Actualizando referencias...");
  
  const jurySystem = await ethers.getContractAt("JurySystem", deployment.contracts.jurySystem);
  await jurySystem.updatePollPool(newPollPool.address);
  console.log("   ✅ JurySystem actualizado");
  
  const governance = await ethers.getContractAt("PlatformGovernance", deployment.contracts.platformGovernance);
  // Nota: PlatformGovernance necesitaría una función updatePollPool también
  console.log("   ⚠️ PlatformGovernance necesita actualización manual");
  
  return newPollPool.address;
}

async function updateReputationSystem(deployment) {
  console.log("⭐ Deploying nuevo ReputationSystem...");
  
  const ReputationSystem = await ethers.getContractFactory("ReputationSystem");
  const newReputationSystem = await ReputationSystem.deploy();
  await newReputationSystem.deployed();
  
  console.log("✅ Nuevo ReputationSystem deployed:", newReputationSystem.address);
  
  // Actualizar referencias en otros contratos
  console.log("🔗 Actualizando referencias...");
  
  const jurySystem = await ethers.getContractAt("JurySystem", deployment.contracts.jurySystem);
  await jurySystem.updateReputationSystem(newReputationSystem.address);
  console.log("   ✅ JurySystem actualizado");
  
  // Autorizar JurySystem en el nuevo ReputationSystem
  await newReputationSystem.addAuthorizedCaller(deployment.contracts.jurySystem);
  console.log("   ✅ JurySystem autorizado en nuevo ReputationSystem");
  
  return newReputationSystem.address;
}

async function updateJurySystem(deployment) {
  console.log("⚖️ Deploying nuevo JurySystem...");
  
  const JurySystem = await ethers.getContractFactory("JurySystem");
  const newJurySystem = await JurySystem.deploy(
    deployment.contracts.reputationSystem,
    deployment.contracts.pollPool
  );
  await newJurySystem.deployed();
  
  console.log("✅ Nuevo JurySystem deployed:", newJurySystem.address);
  
  // Actualizar referencias en otros contratos
  console.log("🔗 Actualizando referencias...");
  
  const reputationSystem = await ethers.getContractAt("ReputationSystem", deployment.contracts.reputationSystem);
  await reputationSystem.addAuthorizedCaller(newJurySystem.address);
  console.log("   ✅ Nuevo JurySystem autorizado en ReputationSystem");
  
  // Remover autorización del JurySystem anterior
  await reputationSystem.removeAuthorizedCaller(deployment.contracts.jurySystem);
  console.log("   ✅ JurySystem anterior desautorizado");
  
  return newJurySystem.address;
}

async function updatePlatformGovernance(deployment) {
  console.log("🏛️ Deploying nuevo PlatformGovernance...");
  
  const PlatformGovernance = await ethers.getContractFactory("PlatformGovernance");
  const newGovernance = await PlatformGovernance.deploy(
    deployment.contracts.pollPool,
    deployment.contracts.reputationSystem,
    deployment.contracts.jurySystem
  );
  await newGovernance.deployed();
  
  console.log("✅ Nuevo PlatformGovernance deployed:", newGovernance.address);
  console.log("⚠️ Recuerda transferir ownership si es necesario");
  
  return newGovernance.address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error durante la actualización:", error);
    process.exit(1);
  });