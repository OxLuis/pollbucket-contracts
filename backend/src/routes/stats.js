// 📊 Rutas API para Estadísticas
const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const logger = require('../utils/logger');

// GET /api/stats/overview - Estadísticas generales
router.get('/overview', async (req, res) => {
  try {
    const [
      totalPools,
      activePools,
      totalBets,
      totalUsers,
      premiumPools,
      cancelledPools
    ] = await Promise.all([
      prisma.pool.count(),
      prisma.pool.count({
        where: {
          status: 'OPEN',
          closeTime: { gt: new Date() }
        }
      }),
      prisma.bet.count(),
      prisma.user.count(),
      prisma.pool.count({ where: { isPremium: true } }),
      prisma.pool.count({ where: { status: 'CANCELLED' } })
    ]);

    // Total stake (suma de todos los pools)
    const totalStakeResult = await prisma.pool.aggregate({
      _sum: { totalStake: true }
    });

    res.json({
      data: {
        totalPools,
        activePools,
        totalBets,
        totalUsers,
        premiumPools,
        cancelledPools,
        totalStake: totalStakeResult._sum.totalStake || '0'
      }
    });

  } catch (error) {
    logger.error('Error obteniendo estadísticas generales:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// GET /api/stats/pools - Estadísticas de pools
router.get('/pools', async (req, res) => {
  try {
    // Pools por estado
    const poolsByStatus = await prisma.pool.groupBy({
      by: ['status'],
      _count: { status: true }
    });

    // Pools por categoría
    const poolsByCategory = await prisma.pool.groupBy({
      by: ['category'],
      _count: { category: true }
    });

    // Pools creados por día (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const poolsPerDay = await prisma.$queryRaw`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM "Pool"
      WHERE created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    res.json({
      data: {
        byStatus: poolsByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {}),
        byCategory: poolsByCategory.reduce((acc, item) => {
          acc[item.category] = item._count.category;
          return acc;
        }, {}),
        perDay: poolsPerDay
      }
    });

  } catch (error) {
    logger.error('Error obteniendo estadísticas de pools:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// GET /api/stats/transactions - Estadísticas de transacciones
router.get('/transactions', async (req, res) => {
  try {
    // Transacciones por tipo
    const txByType = await prisma.transaction.groupBy({
      by: ['type'],
      _count: { type: true }
    });

    // Transacciones por día (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const txPerDay = await prisma.$queryRaw`
      SELECT 
        DATE(block_timestamp) as date,
        COUNT(*) as count
      FROM "Transaction"
      WHERE block_timestamp >= ${thirtyDaysAgo}
      GROUP BY DATE(block_timestamp)
      ORDER BY date DESC
    `;

    // Últimas transacciones
    const recentTx = await prisma.transaction.findMany({
      orderBy: { blockTimestamp: 'desc' },
      take: 10,
      include: {
        pool: {
          select: { question: true }
        }
      }
    });

    res.json({
      data: {
        byType: txByType.reduce((acc, item) => {
          acc[item.type] = item._count.type;
          return acc;
        }, {}),
        perDay: txPerDay,
        recent: recentTx
      }
    });

  } catch (error) {
    logger.error('Error obteniendo estadísticas de transacciones:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// GET /api/stats/categories - Estadísticas por categoría
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.pool.groupBy({
      by: ['category'],
      _count: { _all: true },
      _sum: { totalStake: true }
    });

    // Formatear respuesta con nombres de categorías
    const categoryNames = {
      GENERAL: 'General',
      SPORTS: 'Deportes',
      CRYPTO: 'Cripto',
      POLITICS: 'Política',
      ENTERTAINMENT: 'Entretenimiento',
      TECHNOLOGY: 'Tecnología',
      GAMING: 'Gaming',
      FINANCE: 'Finanzas',
      OTHER: 'Otros'
    };

    const formattedCategories = categories.map(cat => ({
      id: cat.category,
      name: categoryNames[cat.category] || cat.category,
      poolCount: cat._count._all,
      totalStake: cat._sum.totalStake || '0'
    }));

    res.json({ data: formattedCategories });

  } catch (error) {
    logger.error('Error obteniendo estadísticas de categorías:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

// GET /api/stats/sync - Estado de sincronización
router.get('/sync', async (req, res) => {
  try {
    const syncState = await prisma.syncState.findUnique({
      where: { id: 1 }
    });

    res.json({
      data: syncState || {
        lastBlockNumber: 0,
        lastSyncTime: null,
        isRunning: false
      }
    });

  } catch (error) {
    logger.error('Error obteniendo estado de sincronización:', error);
    res.status(500).json({ error: 'Error obteniendo estado de sincronización' });
  }
});

// GET /api/stats/top-pools - Pools más populares
router.get('/top-pools', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const pools = await prisma.pool.findMany({
      where: {
        status: 'OPEN',
        closeTime: { gt: new Date() }
      },
      orderBy: {
        currentParticipants: 'desc'
      },
      take: parseInt(limit),
      include: {
        _count: { select: { bets: true } }
      }
    });

    res.json({ data: pools });

  } catch (error) {
    logger.error('Error obteniendo top pools:', error);
    res.status(500).json({ error: 'Error obteniendo top pools' });
  }
});

module.exports = router;

