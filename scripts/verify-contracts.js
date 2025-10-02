const { ethers } = require("hardhat");

async function main() {
  console.log("🔍 Verificación de Contratos en Explorer");
  console.log("=" * 40);
  
  // Cargar deployment
  const fs = require('fs');
  const deploymentPath = `deployments/${hre.network.name}-modular-deployment.json`;
  
  if (!fs.existsSync(deploymentPath)) {
    console.error("❌ No se encontró deployment modular.");
    return;
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  
  console.log("🌐 Red:", hre.network.name);
  console.log("📋 Verificando contratos...");
  
  const contracts = [
    { name: "ReputationSystem", address: deployment.contracts.reputationSystem, args: [] },
    { name: "JurySystem", address: deployment.contracts.jurySystem, args: [
      deployment.contracts.reputationSystem,
      deployment.contracts.pollPool
    ]},
    { name: "PollPool", address: deployment.contracts.pollPool, args: [
      deployment.contracts.reputationSystem,
      deployment.contracts.jurySystem
    ]},
    { name: "PlatformGovernance", address: deployment.contracts.platformGovernance, args: [
      deployment.contracts.pollPool,
      deployment.contracts.reputationSystem,
      deployment.contracts.jurySystem
    ]}
  ];
  
  for (const contract of contracts) {
    console.log(`\n🔍 Verificando ${contract.name}...`);
    console.log(`   Dirección: ${contract.address}`);
    
    try {
      await hre.run("verify:verify", {
        address: contract.address,
        constructorArguments: contract.args,
      });
      console.log(`   ✅ ${contract.name} verificado exitosamente`);
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log(`   ✅ ${contract.name} ya estaba verificado`);
      } else {
        console.log(`   ❌ Error verificando ${contract.name}:`, error.message);
      }
    }
  }
  
  console.log("\n🎉 Verificación completada!");
  
  if (hre.network.name === "fuji") {
    console.log("\n🔗 Ver contratos en Snowtrace:");
    for (const contract of contracts) {
      console.log(`   ${contract.name}: https://testnet.snowtrace.io/address/${contract.address}`);
    }
  } else if (hre.network.name === "avalanche") {
    console.log("\n🔗 Ver contratos en Snowtrace:");
    for (const contract of contracts) {
      console.log(`   ${contract.name}: https://snowtrace.io/address/${contract.address}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error durante la verificación:", error);
    process.exit(1);
  });