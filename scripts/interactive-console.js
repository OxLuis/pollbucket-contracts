const { ethers } = require("hardhat");

async function main() {
    console.log("🎮 Consola Interactiva PollBucket");
    console.log("=".repeat(40));
    
    // Cargar deployment
    const fs = require('fs');
    const deploymentPath = `deployments/${hre.network.name}-deployment.json`;
    
    if (!fs.existsSync(deploymentPath)) {
        console.error("❌ No se encontró deployment. Ejecuta: npm run deploy:local");
        return;
    }
    
    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const [deployer, alice, bob, charlie, david] = await ethers.getSigners();
    
    // Conectar contratos
    const pollPool = await ethers.getContractAt("PollPool", deployment.contracts.pollPool);
    const reputationSystem = await ethers.getContractAt("ReputationSystem", deployment.contracts.reputationSystem);
    const jurySystem = await ethers.getContractAt("JurySystem", deployment.contracts.jurySystem);
    
    console.log("📋 Contratos cargados:");
    console.log("   PollPool:", pollPool.address);
    console.log("   ReputationSystem:", reputationSystem.address);
    console.log("   JurySystem:", jurySystem.address);
    
    console.log("\n👥 Cuentas disponibles:");
    console.log("   deployer:", deployer.address);
    console.log("   alice:", alice.address);
    console.log("   bob:", bob.address);
    console.log("   charlie:", charlie.address);
    console.log("   david:", david.address);
    
    // Hacer contratos y cuentas globales para la consola
    global.pollPool = pollPool;
    global.reputationSystem = reputationSystem;
    global.jurySystem = jurySystem;
    global.deployer = deployer;
    global.alice = alice;
    global.bob = bob;
    global.charlie = charlie;
    global.david = david;
    global.ethers = ethers;
    
    // Funciones helper
    global.createPool = async (question, options, hours = 24, maxParticipants = 0, amount = "0.05") => {
        const fixedAmount = ethers.utils.parseEther(amount);
        const closeTime = Math.floor(Date.now() / 1000) + (hours * 60 * 60);
        
        const tx = await pollPool.createPool(
            question,
            options,
            closeTime,
            maxParticipants,
            fixedAmount,
            { value: fixedAmount }
        );
        
        const receipt = await tx.wait();
        const poolId = receipt.events.find(e => e.event === 'PoolCreated').args.poolId;
        console.log("✅ Pool creado con ID:", poolId.toString());
        return poolId;
    };
    
    global.bet = async (user, poolId, option) => {
        const requiredAmount = await pollPool.getPoolFixedBetAmount(poolId);
        await pollPool.connect(user).placeBet(poolId, option, { value: requiredAmount });
        console.log("✅ Apuesta realizada");
    };
    
    global.registerJuror = async (user, amount = "0.1") => {
        const stakeAmount = ethers.utils.parseEther(amount);
        await reputationSystem.connect(user).registerAsJuror({ value: stakeAmount });
        console.log("✅ Jurado registrado");
    };
    
    global.showPool = async (poolId) => {
        const pool = await pollPool.getPool(poolId);
        const poolInfo = await pollPool.getPoolInfo(poolId);
        
        console.log("\n📊 Pool #" + poolId);
        console.log("   Pregunta:", pool.question);
        console.log("   Opciones:", pool.options);
        console.log("   Total AVAX:", ethers.utils.formatEther(poolInfo.totalAvax));
        console.log("   Participantes:", poolInfo.currentParticipants.toString() + "/" + poolInfo.maxParticipants.toString());
        console.log("   Estado:", ["Abierto", "Cerrado", "Validado", "Cancelado"][poolInfo.status]);
        console.log("   Tiempo restante:", poolInfo.hoursRemaining.toString() + "h " + poolInfo.minutesRemaining.toString() + "m");
    };
    
    global.showJuror = async (user) => {
        const profile = await reputationSystem.getJurorProfile(user.address);
        const assignments = await jurySystem.getJurorAssignments(user.address);
        
        console.log("\n👨‍⚖️ Jurado:", user.address);
        console.log("   Reputación:", profile.reputation.toString());
        console.log("   Stake:", ethers.utils.formatEther(profile.stakedAmount), "AVAX");
        console.log("   Activo:", profile.isActive);
        console.log("   Total votos:", profile.totalVotes.toString());
        console.log("   Votos correctos:", profile.correctVotes.toString());
        console.log("   Pools asignados:", assignments.map(id => id.toString()));
        
        if (profile.totalVotes > 0) {
            const accuracy = (profile.correctVotes * 100) / profile.totalVotes;
            console.log("   Precisión:", accuracy.toString() + "%");
        }
    };
    
    global.showStats = async () => {
        const totalPools = await pollPool.getTotalPoolsCount();
        const activePools = await pollPool.getActivePoolsCount();
        const totalJurors = await reputationSystem.getActiveJurorsCount();
        const minStake = await reputationSystem.getMinStakeRequired();
        
        console.log("\n📈 Estadísticas del Sistema:");
        console.log("   Total pools:", totalPools.toString());
        console.log("   Pools activos:", activePools.toString());
        console.log("   Total jurados:", totalJurors.toString());
        console.log("   Stake mínimo:", ethers.utils.formatEther(minStake), "AVAX");
    };
    
    global.vote = async (juror, poolId, option) => {
        await jurySystem.connect(juror).castVote(poolId, option);
        console.log("✅ Voto registrado");
    };
    
    global.closePool = async (poolId) => {
        await pollPool.closePool(poolId);
        console.log("✅ Pool cerrado");
    };
    
    global.showValidation = async (poolId) => {
        const validation = await jurySystem.getValidation(poolId);
        
        console.log("\n⚖️ Validación Pool #" + poolId);
        console.log("   Jurados asignados:", validation.assignedJurors.length);
        console.log("   Votos requeridos:", validation.requiredVotes.toString());
        console.log("   Votos actuales:", validation.totalVotes.toString());
        console.log("   Estado:", ["Pendiente", "En Progreso", "Completado", "Disputado"][validation.status]);
        console.log("   Deadline:", new Date(validation.deadline * 1000).toLocaleString());
        
        if (validation.status >= 2) { // Completed
            console.log("   Opción ganadora:", validation.winningOption.toString());
        }
    };
    
    console.log("\n🎮 Funciones disponibles:");
    console.log("   createPool(question, options, hours, maxParticipants, amount)");
    console.log("   bet(user, poolId, option)");
    console.log("   registerJuror(user, amount)");
    console.log("   showPool(poolId)");
    console.log("   showJuror(user)");
    console.log("   showStats()");
    console.log("   vote(juror, poolId, option)");
    console.log("   closePool(poolId)");
    console.log("   showValidation(poolId)");
    
    console.log("\n💡 Ejemplos:");
    console.log('   await createPool("¿Pregunta?", ["A", "B"], 24, 10, "0.05")');
    console.log('   await bet(alice, 1, 0)');
    console.log('   await registerJuror(alice, "0.1")');
    console.log('   await showPool(1)');
    console.log('   await showStats()');
    
    console.log("\n🚀 ¡Consola lista! Usa las funciones para interactuar con el sistema.");
    console.log("   Tip: Todas las variables están disponibles globalmente");
    
    // Mantener la consola abierta
    await new Promise(() => {});
}

main().catch(console.error);