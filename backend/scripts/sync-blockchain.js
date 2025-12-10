#!/usr/bin/env node
// 🔄 Script CLI para sincronización blockchain manual
// Uso: node scripts/sync-blockchain.js [comando] [opciones]

require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const BlockchainSync = require('../src/services/blockchainSync');

const prisma = new PrismaClient();

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function showStatus() {
  log('\n📊 Estado de Sincronización', 'cyan');
  log('─'.repeat(50));
  
  const syncState = await prisma.syncState.findUnique({ where: { id: 1 } });
  const poolCount = await prisma.pool.count();
  const betCount = await prisma.bet.count();
  const txCount = await prisma.transaction.count();
  
  log(`\n📍 Último bloque sincronizado: ${syncState?.lastBlockNumber || 0}`);
  log(`⏰ Última sincronización: ${syncState?.lastSyncTime || 'Nunca'}`);
  log(`🔄 Sincronización activa: ${syncState?.isRunning ? 'Sí' : 'No'}`);
  
  log(`\n📋 Base de datos:`, 'blue');
  log(`   Pools: ${poolCount}`);
  log(`   Apuestas: ${betCount}`);
  log(`   Transacciones: ${txCount}`);
}

async function syncAll(fromBlock = null) {
  log('\n🔄 Iniciando sincronización completa...', 'cyan');
  
  const sync = new BlockchainSync();
  
  try {
    // Inicializar conexión
    await sync.start();
    
    // Si se especificó un bloque, forzar desde ahí
    if (fromBlock !== null) {
      log(`\n📍 Sincronizando desde bloque ${fromBlock}...`, 'yellow');
      const result = await sync.forceSync(parseInt(fromBlock));
      log(`\n✅ Sincronización completada:`, 'green');
      log(`   Eventos procesados: ${result.eventsProcessed}`);
      log(`   Pools creados: ${result.poolsCreated}`);
      log(`   Apuestas: ${result.betsPlaced}`);
    } else {
      log('\n✅ Sincronización histórica completada', 'green');
    }
    
    await sync.stop();
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function resyncAll() {
  log('\n⚠️  RE-SINCRONIZACIÓN COMPLETA', 'yellow');
  log('   Esto eliminará todos los datos y sincronizará desde cero.', 'yellow');
  log('   Presiona Ctrl+C en 5 segundos para cancelar...\n', 'yellow');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  log('🗑️  Eliminando datos existentes...', 'yellow');
  
  await prisma.$transaction([
    prisma.bet.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.pool.deleteMany(),
    prisma.syncState.update({
      where: { id: 1 },
      data: { lastBlockNumber: 0 }
    })
  ]);
  
  log('✅ Datos eliminados', 'green');
  
  const startBlock = parseInt(process.env.SYNC_START_BLOCK) || 0;
  await syncAll(startBlock);
}

async function syncMissing() {
  log('\n🔍 Buscando pools faltantes...', 'cyan');
  
  const sync = new BlockchainSync();
  
  try {
    // Conectar
    sync.provider = require('../src/utils/blockchain').getProvider();
    sync.pollPool = require('../src/utils/blockchain').getContract(
      'PollPool', 
      process.env.POLL_POOL_ADDRESS
    );
    
    // Obtener total de pools en contrato
    const nextPoolId = await sync.pollPool.nextPoolId();
    const totalInContract = Number(nextPoolId) - 1;
    
    // Obtener IDs en DB
    const dbPools = await prisma.pool.findMany({ select: { poolId: true } });
    const dbIds = new Set(dbPools.map(p => p.poolId));
    
    // Encontrar faltantes
    const missing = [];
    for (let i = 1; i <= totalInContract; i++) {
      if (!dbIds.has(i)) missing.push(i);
    }
    
    log(`\n📊 Total en contrato: ${totalInContract}`);
    log(`📊 Total en base de datos: ${dbPools.length}`);
    log(`📊 Faltantes: ${missing.length}`);
    
    if (missing.length === 0) {
      log('\n✅ No hay pools faltantes, todo sincronizado!', 'green');
      return;
    }
    
    log(`\n🔄 Sincronizando ${missing.length} pools faltantes...`, 'yellow');
    
    let synced = 0;
    let errors = 0;
    
    for (const poolId of missing) {
      try {
        process.stdout.write(`   Sincronizando pool ${poolId}...`);
        await sync.syncPool(poolId);
        console.log(' ✅');
        synced++;
      } catch (err) {
        console.log(` ❌ ${err.message}`);
        errors++;
      }
    }
    
    log(`\n📊 Resultados:`, 'blue');
    log(`   Sincronizados: ${synced}`, 'green');
    if (errors > 0) log(`   Errores: ${errors}`, 'red');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

async function syncPool(poolId) {
  log(`\n🔄 Sincronizando pool ${poolId}...`, 'cyan');
  
  const sync = new BlockchainSync();
  
  try {
    sync.provider = require('../src/utils/blockchain').getProvider();
    sync.pollPool = require('../src/utils/blockchain').getContract(
      'PollPool', 
      process.env.POLL_POOL_ADDRESS
    );
    
    await sync.syncPool(parseInt(poolId));
    log(`\n✅ Pool ${poolId} sincronizado correctamente`, 'green');
    
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    process.exit(1);
  }
}

function showHelp() {
  log('\n📚 PollBucket - Script de Sincronización Blockchain', 'cyan');
  log('─'.repeat(50));
  log('\nUso: node scripts/sync-blockchain.js [comando] [opciones]\n');
  
  log('Comandos:', 'blue');
  log('  status              Ver estado actual de sincronización');
  log('  sync                Sincronizar eventos históricos');
  log('  sync --from <N>     Sincronizar desde bloque N');
  log('  resync              Re-sincronizar todo (elimina datos)');
  log('  missing             Sincronizar solo pools faltantes');
  log('  pool <ID>           Sincronizar un pool específico');
  log('  help                Mostrar esta ayuda');
  
  log('\nEjemplos:', 'blue');
  log('  node scripts/sync-blockchain.js status');
  log('  node scripts/sync-blockchain.js sync --from 12345678');
  log('  node scripts/sync-blockchain.js missing');
  log('  node scripts/sync-blockchain.js pool 5');
  
  log('\nVariables de entorno requeridas:', 'yellow');
  log('  BLOCKCHAIN_NETWORK      Red (hardhat, fuji, avalanche)');
  log('  POLL_POOL_ADDRESS       Dirección del contrato PollPool');
  log('  SYNC_START_BLOCK        Bloque inicial para sincronización');
  log('  DATABASE_URL            URL de PostgreSQL');
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  // Verificar configuración
  if (!process.env.DATABASE_URL) {
    log('❌ Error: DATABASE_URL no configurado', 'red');
    process.exit(1);
  }
  
  try {
    await prisma.$connect();
    
    // Asegurar que existe el registro de syncState
    await prisma.syncState.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, lastBlockNumber: 0, isRunning: false }
    });
    
    switch (command) {
      case 'status':
        await showStatus();
        break;
        
      case 'sync':
        const fromIndex = args.indexOf('--from');
        const fromBlock = fromIndex !== -1 ? args[fromIndex + 1] : null;
        await syncAll(fromBlock);
        break;
        
      case 'resync':
        await resyncAll();
        break;
        
      case 'missing':
        await syncMissing();
        break;
        
      case 'pool':
        if (!args[1]) {
          log('❌ Error: Debes especificar el ID del pool', 'red');
          process.exit(1);
        }
        await syncPool(args[1]);
        break;
        
      case 'help':
      default:
        showHelp();
    }
    
  } catch (error) {
    log(`\n❌ Error fatal: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

