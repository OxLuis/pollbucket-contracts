const fs = require('fs');
const path = require('path');

async function main() {
  const command = process.argv[2];
  const network = process.argv[3];
  
  if (!command) {
    console.log("📚 Comandos disponibles:");
    console.log("   latest <network>     - Ver último deployment");
    console.log("   history <network>    - Ver historial completo");
    console.log("   compare <network> <id1> <id2> - Comparar deployments");
    console.log("   clean <network>      - Limpiar historial antiguo");
    return;
  }
  
  if (!network) {
    console.log("❌ Especifica la red: hardhat, fuji, avalanche");
    return;
  }
  
  const historyDir = 'deployments/history';
  
  if (!fs.existsSync(historyDir)) {
    console.log("❌ No existe directorio de historial");
    return;
  }
  
  switch (command) {
    case 'latest':
      await showLatest(network, historyDir);
      break;
    case 'history':
      await showHistory(network, historyDir);
      break;
    case 'compare':
      const id1 = process.argv[4];
      const id2 = process.argv[5];
      if (!id1 || !id2) {
        console.log("❌ Especifica dos IDs de deployment para comparar");
        return;
      }
      await compareDeployments(network, historyDir, id1, id2);
      break;
    case 'clean':
      await cleanOldDeployments(network, historyDir);
      break;
    default:
      console.log("❌ Comando no reconocido");
  }
}

async function showLatest(network, historyDir) {
  const files = fs.readdirSync(historyDir)
    .filter(f => f.endsWith(`_${network}.json`))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    console.log(`❌ No hay deployments para la red ${network}`);
    return;
  }
  
  const latestFile = files[0];
  const deployment = JSON.parse(fs.readFileSync(path.join(historyDir, latestFile), 'utf8'));
  
  console.log("🔍 ÚLTIMO DEPLOYMENT");
  console.log("=".repeat(50));
  console.log(`📅 Fecha: ${new Date(deployment.timestamp).toLocaleString()}`);
  console.log(`🌐 Red: ${deployment.network}`);
  console.log(`👤 Deployer: ${deployment.deployer}`);
  console.log(`📦 Tipo: ${deployment.deploymentType}`);
  console.log("");
  console.log("📋 CONTRATOS:");
  Object.entries(deployment.contracts).forEach(([name, info]) => {
    console.log(`   ${name}: ${info.address}`);
    if (info.txHash !== "N/A") {
      console.log(`     TX: ${info.txHash}`);
    }
  });
  console.log("");
  console.log("📝 CAMBIOS:");
  deployment.changes.forEach(change => {
    console.log(`   • ${change}`);
  });
  if (deployment.notes) {
    console.log(`\n💬 Notas: ${deployment.notes}`);
  }
}

async function showHistory(network, historyDir) {
  const files = fs.readdirSync(historyDir)
    .filter(f => f.endsWith(`_${network}.json`))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    console.log(`❌ No hay deployments para la red ${network}`);
    return;
  }
  
  console.log(`📚 HISTORIAL DE DEPLOYMENTS - ${network.toUpperCase()}`);
  console.log("=".repeat(60));
  
  files.forEach((file, index) => {
    const deployment = JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf8'));
    const date = new Date(deployment.timestamp);
    
    console.log(`${index + 1}. ${deployment.deploymentId}`);
    console.log(`   📅 ${date.toLocaleString()}`);
    console.log(`   📦 ${deployment.deploymentType}`);
    console.log(`   👤 ${deployment.deployer.slice(0, 10)}...`);
    console.log(`   📝 ${deployment.changes.length} cambios`);
    console.log("");
  });
  
  console.log(`📊 Total: ${files.length} deployments`);
}

async function compareDeployments(network, historyDir, id1, id2) {
  const file1 = `${id1}_${network}.json`;
  const file2 = `${id2}_${network}.json`;
  
  const path1 = path.join(historyDir, file1);
  const path2 = path.join(historyDir, file2);
  
  if (!fs.existsSync(path1) || !fs.existsSync(path2)) {
    console.log("❌ Uno o ambos deployments no existen");
    return;
  }
  
  const dep1 = JSON.parse(fs.readFileSync(path1, 'utf8'));
  const dep2 = JSON.parse(fs.readFileSync(path2, 'utf8'));
  
  console.log("🔍 COMPARACIÓN DE DEPLOYMENTS");
  console.log("=".repeat(50));
  console.log(`📅 ${id1}: ${new Date(dep1.timestamp).toLocaleString()}`);
  console.log(`📅 ${id2}: ${new Date(dep2.timestamp).toLocaleString()}`);
  console.log("");
  
  console.log("📋 DIFERENCIAS EN CONTRATOS:");
  const contracts1 = dep1.contracts;
  const contracts2 = dep2.contracts;
  
  Object.keys(contracts1).forEach(contractName => {
    const addr1 = contracts1[contractName].address;
    const addr2 = contracts2[contractName]?.address;
    
    if (addr1 !== addr2) {
      console.log(`   ${contractName}:`);
      console.log(`     ${id1}: ${addr1}`);
      console.log(`     ${id2}: ${addr2 || 'NO EXISTE'}`);
    }
  });
  
  console.log("\n📝 CAMBIOS:");
  console.log(`   ${id1}:`);
  dep1.changes.forEach(change => console.log(`     • ${change}`));
  console.log(`   ${id2}:`);
  dep2.changes.forEach(change => console.log(`     • ${change}`));
}

async function cleanOldDeployments(network, historyDir) {
  const files = fs.readdirSync(historyDir)
    .filter(f => f.endsWith(`_${network}.json`))
    .sort();
  
  if (files.length <= 5) {
    console.log("📚 Menos de 5 deployments, no se limpia nada");
    return;
  }
  
  const toDelete = files.slice(0, -5); // Mantener últimos 5
  
  console.log(`🧹 Limpiando ${toDelete.length} deployments antiguos...`);
  
  toDelete.forEach(file => {
    fs.unlinkSync(path.join(historyDir, file));
    console.log(`   ✅ Eliminado: ${file}`);
  });
  
  console.log(`📚 Mantenidos ${files.length - toDelete.length} deployments recientes`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });