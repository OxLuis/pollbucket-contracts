// 🔄 Rutas API para Sincronización Blockchain
const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const logger = require('../utils/logger');

// Variable global para acceder al servicio de sync
let blockchainSync = null;

// Middleware para inyectar el servicio de sync
router.use((req, res, next) => {
  if (!blockchainSync) {
    blockchainSync = req.app.get('blockchainSync');
  }
  next();
});

// GET /api/sync/status - Estado de sincronización
router.get('/status', async (req, res) => {
  try {
    const syncState = await prisma.syncState.findUnique({
      where: { id: 1 }
    });

    // Contar registros en DB
    const [poolCount, betCount, txCount] = await Promise.all([
      prisma.pool.count(),
      prisma.bet.count(),
      prisma.transaction.count()
    ]);

    res.json({
      data: {
        syncState: syncState || { lastBlockNumber: 0, lastSyncTime: null, isRunning: false },
        database: {
          pools: poolCount,
          bets: betCount,
          transactions: txCount
        }
      }
    });

  } catch (error) {
    logger.error('Error obteniendo estado de sync:', error);
    res.status(500).json({ error: 'Error obteniendo estado' });
  }
});

// POST /api/sync/force - Forzar sincronización desde un bloque
router.post('/force', async (req, res) => {
  try {
    const { fromBlock = 0, adminKey } = req.body;

    // Verificar clave de admin (simple, mejorar en producción)
    if (process.env.ADMIN_KEY && adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!blockchainSync) {
      return res.status(503).json({ error: 'Servicio de sincronización no disponible' });
    }

    logger.info(`🔄 Sincronización forzada solicitada desde bloque ${fromBlock}`);

    // Ejecutar en background para no bloquear la respuesta
    blockchainSync.forceSync(parseInt(fromBlock))
      .then(result => {
        logger.info('✅ Sincronización forzada completada:', result);
      })
      .catch(err => {
        logger.error('❌ Error en sincronización forzada:', err);
      });

    res.json({
      success: true,
      message: `Sincronización iniciada desde bloque ${fromBlock}`,
      note: 'La sincronización se ejecuta en segundo plano'
    });

  } catch (error) {
    logger.error('Error iniciando sincronización forzada:', error);
    res.status(500).json({ error: 'Error iniciando sincronización' });
  }
});

// POST /api/sync/pool/:poolId - Sincronizar un pool específico
router.post('/pool/:poolId', async (req, res) => {
  try {
    const { poolId } = req.params;
    const { adminKey } = req.body;

    if (process.env.ADMIN_KEY && adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!blockchainSync) {
      return res.status(503).json({ error: 'Servicio de sincronización no disponible' });
    }

    await blockchainSync.syncPool(parseInt(poolId));

    res.json({
      success: true,
      message: `Pool ${poolId} sincronizado correctamente`
    });

  } catch (error) {
    logger.error('Error sincronizando pool:', error);
    res.status(500).json({ error: 'Error sincronizando pool' });
  }
});

// POST /api/sync/resync-all - Re-sincronizar todo desde el bloque de deployment
router.post('/resync-all', async (req, res) => {
  try {
    const { adminKey } = req.body;

    if (process.env.ADMIN_KEY && adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!blockchainSync) {
      return res.status(503).json({ error: 'Servicio de sincronización no disponible' });
    }

    // Limpiar base de datos
    logger.warn('⚠️ Re-sincronización completa solicitada - limpiando datos...');
    
    await prisma.$transaction([
      prisma.bet.deleteMany(),
      prisma.transaction.deleteMany(),
      prisma.pool.deleteMany(),
      prisma.syncState.update({
        where: { id: 1 },
        data: { lastBlockNumber: 0 }
      })
    ]);

    logger.info('🗑️ Datos eliminados, iniciando re-sincronización...');

    // Iniciar sincronización desde el bloque configurado
    const startBlock = parseInt(process.env.SYNC_START_BLOCK) || 0;
    
    blockchainSync.forceSync(startBlock)
      .then(result => {
        logger.info('✅ Re-sincronización completa:', result);
      })
      .catch(err => {
        logger.error('❌ Error en re-sincronización:', err);
      });

    res.json({
      success: true,
      message: `Re-sincronización iniciada desde bloque ${startBlock}`,
      warning: 'Todos los datos anteriores han sido eliminados'
    });

  } catch (error) {
    logger.error('Error en re-sincronización:', error);
    res.status(500).json({ error: 'Error en re-sincronización' });
  }
});

// GET /api/sync/missing - Verificar pools faltantes
router.get('/missing', async (req, res) => {
  try {
    if (!blockchainSync) {
      return res.status(503).json({ error: 'Servicio de sincronización no disponible' });
    }

    // Obtener el último poolId del contrato
    const nextPoolId = await blockchainSync.pollPool.nextPoolId();
    const totalPoolsInContract = Number(nextPoolId) - 1;

    // Contar pools en DB
    const poolsInDb = await prisma.pool.count();

    // Obtener IDs de pools en DB
    const dbPoolIds = await prisma.pool.findMany({
      select: { poolId: true },
      orderBy: { poolId: 'asc' }
    });
    const dbIds = new Set(dbPoolIds.map(p => p.poolId));

    // Encontrar IDs faltantes
    const missingIds = [];
    for (let i = 1; i <= totalPoolsInContract; i++) {
      if (!dbIds.has(i)) {
        missingIds.push(i);
      }
    }

    res.json({
      data: {
        totalInContract: totalPoolsInContract,
        totalInDatabase: poolsInDb,
        missingCount: missingIds.length,
        missingIds: missingIds.slice(0, 100), // Máximo 100 IDs
        isSynced: missingIds.length === 0
      }
    });

  } catch (error) {
    logger.error('Error verificando pools faltantes:', error);
    res.status(500).json({ error: 'Error verificando pools' });
  }
});

// POST /api/sync/missing - Sincronizar pools faltantes
router.post('/missing', async (req, res) => {
  try {
    const { adminKey } = req.body;

    if (process.env.ADMIN_KEY && adminKey !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    if (!blockchainSync) {
      return res.status(503).json({ error: 'Servicio de sincronización no disponible' });
    }

    // Obtener pools faltantes
    const nextPoolId = await blockchainSync.pollPool.nextPoolId();
    const totalPoolsInContract = Number(nextPoolId) - 1;

    const dbPoolIds = await prisma.pool.findMany({
      select: { poolId: true }
    });
    const dbIds = new Set(dbPoolIds.map(p => p.poolId));

    const missingIds = [];
    for (let i = 1; i <= totalPoolsInContract; i++) {
      if (!dbIds.has(i)) {
        missingIds.push(i);
      }
    }

    if (missingIds.length === 0) {
      return res.json({ success: true, message: 'No hay pools faltantes' });
    }

    // Sincronizar cada pool faltante
    logger.info(`🔄 Sincronizando ${missingIds.length} pools faltantes...`);
    
    let synced = 0;
    let errors = 0;

    for (const poolId of missingIds) {
      try {
        await blockchainSync.syncPool(poolId);
        synced++;
      } catch (err) {
        logger.error(`Error sincronizando pool ${poolId}:`, err.message);
        errors++;
      }
    }

    res.json({
      success: true,
      message: `Sincronización de pools faltantes completada`,
      results: {
        total: missingIds.length,
        synced,
        errors
      }
    });

  } catch (error) {
    logger.error('Error sincronizando pools faltantes:', error);
    res.status(500).json({ error: 'Error sincronizando pools faltantes' });
  }
});

module.exports = router;

