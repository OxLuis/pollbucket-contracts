const { ethers } = require("hardhat");

async function main() {
    console.log("🧪 Iniciando prueba completa del sistema PollBucket...");
    
    const [deployer, alice, bob, charlie, david] = await ethers.getSigners();
    
    console.log("👥 Cuentas disponibles:");
    console.log("   Deployer:", deployer.address);
    console.log("   Alice:", alice.address);
    console.log("   Bob:", bob.address);
    console.log("   Charlie:", charlie.address);
    console.log("   David:", david.address);
    
    // Cargar direcciones del deployment
    const fs = require('fs');
    const deploymentPath = `deployments/${hre.network.name}-deployment.json`;
    
    if (!fs.existsSync(deploymentPath)) {
        console.error("❌ No se encontró archivo de deployment.");
        console.log("   Ejecuta primero: npm run deploy:local");
        return;
    }
    
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    
    // Conectar a contratos
    const pollPool = await ethers.getContractAt("PollPool", deployment.contracts.pollPool);
    const reputationSystem = await ethers.getContractAt("ReputationSystem", deployment.contracts.reputationSystem);
    const jurySystem = await ethers.getContractAt("JurySystem", deployment.contracts.jurySystem);
    
    console.log("\n📋 Direcciones de contratos:");
    console.log("   PollPool:", pollPool.address);
    console.log("   ReputationSystem:", reputationSystem.address);
    console.log("   JurySystem:", jurySystem.address);
    
    // PASO 1: Registrar jurados
    console.log("\n" + "=".repeat(50));
    console.log("👨‍⚖️ PASO 1: Registrando jurados");
    console.log("=".repeat(50));
    
    const minStake = await reputationSystem.getMinStakeRequired();
    console.log("Stake mínimo requerido:", ethers.utils.formatEther(minStake), "AVAX");
    
    const jurors = [alice, bob, charlie, david];
    const stakeAmount = ethers.utils.parseEther("0.1");
    
    for (let i = 0; i < jurors.length; i++) {
        try {
            await reputationSystem.connect(jurors[i]).registerAsJuror({ value: stakeAmount });
            console.log(`   ✅ ${jurors[i].address.slice(0, 8)}... registrado como jurado`);
        } catch (error) {
            console.log(`   ⚠️ ${jurors[i].address.slice(0, 8)}... ya estaba registrado`);
        }
    }
    
    const totalJurors = await reputationSystem.getActiveJurorsCount();
    console.log(`\n📊 Total jurados activos: ${totalJurors}`);
    
    // PASO 2: Crear pool
    console.log("\n" + "=".repeat(50));
    console.log("🏗️ PASO 2: Creando pool de prueba");
    console.log("=".repeat(50));
    
    const fixedAmount = ethers.utils.parseEther("0.05");
    const question = "¿Subirá el precio de Bitcoin esta semana?";
    const options = ["Sí, subirá más de 5%", "Se mantendrá estable (±5%)", "No, bajará más de 5%"];
    const closeTime = Math.floor(Date.now() / 1000) + (2 * 60 * 60); // 2 horas
    const maxParticipants = 10;
    
    console.log("Pregunta:", question);
    console.log("Opciones:", options);
    console.log("Monto por voto:", ethers.utils.formatEther(fixedAmount), "AVAX");
    console.log("Máximo participantes:", maxParticipants);
    
    const createTx = await pollPool.connect(deployer).createPool(
        question,
        options,
        closeTime,
        maxParticipants,
        fixedAmount,
        { value: fixedAmount }
    );
    
    const receipt = await createTx.wait();
    const poolId = receipt.events.find(e => e.event === 'PoolCreated').args.poolId;
    console.log("\n✅ Pool creado con ID:", poolId.toString());
    
    // PASO 3: Usuarios apuestan
    console.log("\n" + "=".repeat(50));
    console.log("💰 PASO 3: Usuarios apostando");
    console.log("=".repeat(50));
    
    const bets = [
        { user: alice, option: 0, name: "Alice" },
        { user: bob, option: 1, name: "Bob" },
        { user: charlie, option: 0, name: "Charlie" },
        { user: david, option: 2, name: "David" }
    ];
    
    for (let bet of bets) {
        await pollPool.connect(bet.user).placeBet(poolId, bet.option, { value: fixedAmount });
        console.log(`   ✅ ${bet.name} apostó por "${options[bet.option]}"`);
    }
    
    // PASO 4: Mostrar estado del pool
    console.log("\n" + "=".repeat(50));
    console.log("📊 PASO 4: Estado actual del pool");
    console.log("=".repeat(50));
    
    const poolInfo = await pollPool.getPoolInfo(poolId);
    console.log("Total AVAX acumulado:", ethers.utils.formatEther(poolInfo.totalAvax), "AVAX");
    console.log("Participantes:", poolInfo.currentParticipants.toString(), "/", poolInfo.maxParticipants.toString());
    console.log("Tiempo restante:", poolInfo.hoursRemaining.toString(), "horas,", poolInfo.minutesRemaining.toString(), "minutos");
    console.log("Estado:", getStatusName(poolInfo.status));
    
    // Mostrar distribución de apuestas
    console.log("\n📈 Distribución de apuestas:");
    for (let i = 0; i < options.length; i++) {
        const optionTotal = await pollPool.optionTotals(poolId, i);
        const percentage = poolInfo.totalAvax > 0 ? 
            (optionTotal * 100n) / poolInfo.totalAvax : 0n;
        console.log(`   ${options[i]}: ${ethers.utils.formatEther(optionTotal)} AVAX (${percentage}%)`);
    }
    
    // PASO 5: Cerrar pool
    console.log("\n" + "=".repeat(50));
    console.log("🔒 PASO 5: Cerrando pool");
    console.log("=".repeat(50));
    
    console.log("Cerrando pool para activar validación...");
    await pollPool.connect(deployer).closePool(poolId);
    console.log("✅ Pool cerrado exitosamente");
    
    // PASO 6: Ver validación iniciada
    console.log("\n" + "=".repeat(50));
    console.log("⚖️ PASO 6: Sistema de validación");
    console.log("=".repeat(50));
    
    const validation = await jurySystem.getValidation(poolId);
    console.log("Jurados asignados:", validation.assignedJurors.length);
    console.log("Votos requeridos:", validation.requiredVotes.toString());
    console.log("Estado de validación:", getValidationStatusName(validation.status));
    console.log("Deadline:", new Date(validation.deadline * 1000).toLocaleString());
    
    console.log("\n👨‍⚖️ Jurados asignados:");
    for (let i = 0; i < validation.assignedJurors.length; i++) {
        const jurorAddress = validation.assignedJurors[i];
        const name = getJurorName(jurorAddress, [alice, bob, charlie, david]);
        console.log(`   ${i + 1}. ${name} (${jurorAddress.slice(0, 8)}...)`);
        
        // Verificar que no participó en el pool
        const participated = await pollPool.hasUserParticipated(poolId, jurorAddress);
        console.log(`      ¿Participó en el pool?: ${participated ? "❌ SÍ (CONFLICTO)" : "✅ NO"}`);
    }
    
    // PASO 7: Simular votación de jurados
    console.log("\n" + "=".repeat(50));
    console.log("🗳️ PASO 7: Simulando votación de jurados");
    console.log("=".repeat(50));
    
    console.log("Los jurados ahora pueden votar por la opción correcta.");
    console.log("Para simular votación, ejecuta:");
    console.log("");
    
    for (let i = 0; i < validation.assignedJurors.length; i++) {
        const jurorAddress = validation.assignedJurors[i];
        const name = getJurorName(jurorAddress, [alice, bob, charlie, david]);
        console.log(`   // ${name} vota por opción 0 (Bitcoin sube)`);
        console.log(`   await jurySystem.connect(${name.toLowerCase()}).castVote(${poolId}, 0);`);
    }
    
    console.log("");
    console.log("Una vez que todos voten, el sistema:");
    console.log("   1. Determinará la opción ganadora por mayoría");
    console.log("   2. Actualizará las reputaciones de los jurados");
    console.log("   3. Permitirá distribuir recompensas a los ganadores");
    
    // PASO 8: Estadísticas finales
    console.log("\n" + "=".repeat(50));
    console.log("📈 PASO 8: Estadísticas del sistema");
    console.log("=".repeat(50));
    
    const totalPools = await pollPool.getTotalPoolsCount();
    const activePools = await pollPool.getActivePoolsCount();
    const closedPools = await pollPool.getPoolsByStatus(1); // Closed
    
    console.log("Total pools creados:", totalPools.toString());
    console.log("Pools activos:", activePools.toString());
    console.log("Pools cerrados:", closedPools.length);
    console.log("Total jurados:", totalJurors.toString());
    
    console.log("\n🎉 ¡Prueba completa finalizada exitosamente!");
    console.log("\n📋 Próximos pasos:");
    console.log("   1. Los jurados asignados pueden votar usando jurySystem.castVote()");
    console.log("   2. Una vez validado, distribuir recompensas con pollPool.distributeRewards()");
    console.log("   3. Crear más pools para seguir probando");
    console.log("   4. Experimentar con diferentes configuraciones");
}

function getStatusName(status) {
    const statusNames = ["Abierto", "Cerrado", "Validado", "Cancelado"];
    return statusNames[status] || "Desconocido";
}

function getValidationStatusName(status) {
    const statusNames = ["Pendiente", "En Progreso", "Completado", "Disputado"];
    return statusNames[status] || "Desconocido";
}

function getJurorName(address, jurors) {
    const names = ["Alice", "Bob", "Charlie", "David"];
    for (let i = 0; i < jurors.length; i++) {
        if (jurors[i].address.toLowerCase() === address.toLowerCase()) {
            return names[i];
        }
    }
    return "Desconocido";
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error durante la prueba:", error);
        process.exit(1);
    });