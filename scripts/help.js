console.log("🚀 POLLBUCKET - COMANDOS DISPONIBLES");
console.log("=".repeat(60));

console.log("\n📦 DEPLOYMENT MODULAR:");
console.log("   npm run deploy:modular:local     - Deploy en red local");
console.log("   npm run deploy:modular:fuji      - Deploy en Fuji testnet");
console.log("   npm run deploy:modular:avalanche - Deploy en Avalanche mainnet");

console.log("\n⚙️ CONFIGURACIÓN:");
console.log("   npm run setup:local              - Configurar plataforma (local)");
console.log("   npm run setup:fuji               - Configurar plataforma (Fuji)");
console.log("   npm run setup:avalanche          - Configurar plataforma (Avalanche)");

console.log("\n🧪 TESTING:");
console.log("   npm run test:flow:local          - Probar flujo completo (local)");
console.log("   npm run test:flow:fuji           - Probar flujo completo (Fuji)");
console.log("   npm run test:flow:avalanche      - Probar flujo completo (Avalanche)");

console.log("\n📚 HISTORIAL DE DEPLOYMENTS:");
console.log("   npm run deployment:latest <red>  - Ver último deployment");
console.log("   npm run deployment:history <red> - Ver historial completo");
console.log("   npm run deployment:compare <red> <id1> <id2> - Comparar deployments");
console.log("   npm run deployment:clean <red>   - Limpiar historial antiguo");

console.log("\n🚀 COMANDOS RÁPIDOS:");
console.log("   npm run full:deploy:local        - Deploy + Setup (local)");
console.log("   npm run full:deploy:fuji         - Deploy + Setup (Fuji)");
console.log("   npm run full:deploy:avalanche    - Deploy + Setup (Avalanche)");
console.log("   npm run quick:test:local         - Deploy + Setup + Test (local)");
console.log("   npm run quick:test:fuji          - Deploy + Setup + Test (Fuji)");

console.log("\n🔧 UTILIDADES:");
console.log("   npm run compile                  - Compilar contratos");
console.log("   npm run test                     - Ejecutar tests");
console.log("   npm run node                     - Iniciar nodo local");
console.log("   npm run verify <address> --network <red> - Verificar contrato");

console.log("\n💡 EJEMPLOS DE USO:");
console.log("   # Deployment completo en Fuji:");
console.log("   npm run full:deploy:fuji");
console.log("");
console.log("   # Ver último deployment:");
console.log("   npm run deployment:latest fuji");
console.log("");
console.log("   # Test rápido en local:");
console.log("   npm run quick:test:local");
console.log("");
console.log("   # Comparar dos deployments:");
console.log("   npm run deployment:compare fuji 2024-10-03T14-30-15 2024-10-03T16-45-22");

console.log("\n📋 FLUJO RECOMENDADO:");
console.log("   1. npm run compile");
console.log("   2. npm run quick:test:local      (para probar)");
console.log("   3. npm run full:deploy:fuji      (para testnet)");
console.log("   4. npm run test:flow:fuji        (verificar funcionamiento)");
console.log("   5. npm run deployment:latest fuji (ver resultado)");

console.log("\n" + "=".repeat(60));
console.log("🎯 Para más información, consulta MODULAR-DEPLOYMENT.md");