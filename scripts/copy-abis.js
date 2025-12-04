// 📋 Script para copiar ABIs de artifacts a frontend-integration
const fs = require('fs');
const path = require('path');

const contracts = [
  'PollPool',
  'ReputationSystem',
  'JurySystem',
  'PlatformGovernance',
  'SimplePollPool' // Opcional
];

const sourceDir = path.join(__dirname, '../artifacts/contracts');
const targetDir = path.join(__dirname, '../frontend-integration/abis');

console.log('📋 Copiando ABIs de contratos...\n');

// Crear directorio si no existe
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
  console.log(`✅ Creado directorio: ${targetDir}\n`);
}

let successCount = 0;
let errorCount = 0;

contracts.forEach(contractName => {
  const sourceFile = path.join(sourceDir, `${contractName}.sol`, `${contractName}.json`);
  const targetFile = path.join(targetDir, `${contractName}.json`);
  
  try {
    if (fs.existsSync(sourceFile)) {
      const artifact = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
      
      // Guardar solo el ABI (más ligero para frontend)
      const abiOnly = {
        contractName: artifact.contractName,
        abi: artifact.abi
      };
      
      fs.writeFileSync(
        targetFile,
        JSON.stringify(abiOnly, null, 2)
      );
      
      console.log(`✅ ${contractName}: ${artifact.abi.length} funciones/eventos`);
      successCount++;
    } else {
      console.warn(`⚠️  No se encontró: ${sourceFile}`);
      errorCount++;
    }
  } catch (error) {
    console.error(`❌ Error procesando ${contractName}:`, error.message);
    errorCount++;
  }
});

console.log(`\n📊 Resumen:`);
console.log(`   ✅ Exitosos: ${successCount}`);
if (errorCount > 0) {
  console.log(`   ❌ Errores: ${errorCount}`);
}
console.log(`\n📁 ABIs copiados a: ${targetDir}`);



