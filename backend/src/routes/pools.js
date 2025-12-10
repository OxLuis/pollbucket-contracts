// 📊 Rutas API para Pools
const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const logger = require('../utils/logger');

// GET /api/pools - Listar pools con filtros y paginación
router.get('/', async (req, res) => {
  try {
    const {
      status,
      category,
      isPremium,
      creator,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // Construir filtros
    const where = {};
    
    if (status) {
      where.status = status.toUpperCase();
    }
    
    if (category) {
      where.category = category.toUpperCase();
    }
    
    if (isPremium !== undefined) {
      where.isPremium = isPremium === 'true';
    }
    
    if (creator) {
      where.creator = creator.toLowerCase();
    }
    
    if (search) {
      where.question = {
        contains: search,
        mode: 'insensitive'
      };
    }

    // Paginación
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Ordenamiento
    const orderBy = { [sortBy]: sortOrder };

    // Ejecutar consulta
    const [pools, total] = await Promise.all([
      prisma.pool.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          _count: {
            select: { bets: true }
          }
        }
      }),
      prisma.pool.count({ where })
    ]);

    res.json({
      data: pools,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error listando pools:', error);
    res.status(500).json({ error: 'Error obteniendo pools' });
  }
});

// GET /api/pools/active - Pools activos (abiertos y no expirados)
router.get('/active', async (req, res) => {
  try {
    const now = new Date();
    
    const pools = await prisma.pool.findMany({
      where: {
        status: 'OPEN',
        closeTime: {
          gt: now
        }
      },
      orderBy: { closeTime: 'asc' },
      include: {
        _count: {
          select: { bets: true }
        }
      }
    });

    res.json({ data: pools });

  } catch (error) {
    logger.error('Error obteniendo pools activos:', error);
    res.status(500).json({ error: 'Error obteniendo pools activos' });
  }
});

// GET /api/pools/premium - Solo pools premium
router.get('/premium', async (req, res) => {
  try {
    const pools = await prisma.pool.findMany({
      where: {
        isPremium: true,
        status: 'OPEN'
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { bets: true }
        }
      }
    });

    res.json({ data: pools });

  } catch (error) {
    logger.error('Error obteniendo pools premium:', error);
    res.status(500).json({ error: 'Error obteniendo pools premium' });
  }
});

// GET /api/pools/category/:category - Pools por categoría
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { status } = req.query;
    
    const where = {
      category: category.toUpperCase()
    };
    
    if (status) {
      where.status = status.toUpperCase();
    }

    const pools = await prisma.pool.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { bets: true }
        }
      }
    });

    res.json({ data: pools });

  } catch (error) {
    logger.error('Error obteniendo pools por categoría:', error);
    res.status(500).json({ error: 'Error obteniendo pools' });
  }
});

// GET /api/pools/:id - Obtener pool por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const pool = await prisma.pool.findUnique({
      where: { poolId: parseInt(id) },
      include: {
        bets: {
          orderBy: { timestamp: 'desc' }
        },
        transactions: {
          orderBy: { blockTimestamp: 'desc' },
          take: 20
        },
        _count: {
          select: { bets: true }
        }
      }
    });

    if (!pool) {
      return res.status(404).json({ error: 'Pool no encontrado' });
    }

    // Calcular estadísticas por opción
    const optionStats = {};
    pool.options.forEach((option, index) => {
      const optionBets = pool.bets.filter(b => b.option === index);
      optionStats[index] = {
        option: option,
        totalBets: optionBets.length,
        totalAmount: optionBets.reduce((sum, b) => sum + BigInt(b.amount), BigInt(0)).toString()
      };
    });

    res.json({
      data: {
        ...pool,
        optionStats
      }
    });

  } catch (error) {
    logger.error('Error obteniendo pool:', error);
    res.status(500).json({ error: 'Error obteniendo pool' });
  }
});

// GET /api/pools/:id/bets - Obtener apuestas de un pool
router.get('/:id/bets', async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [bets, total] = await Promise.all([
      prisma.bet.findMany({
        where: { poolId: parseInt(id) },
        orderBy: { timestamp: 'desc' },
        skip,
        take
      }),
      prisma.bet.count({ where: { poolId: parseInt(id) } })
    ]);

    res.json({
      data: bets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error obteniendo apuestas:', error);
    res.status(500).json({ error: 'Error obteniendo apuestas' });
  }
});

// GET /api/pools/user/:address - Pools de un usuario
router.get('/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { type = 'all' } = req.query; // all, created, participated

    let pools;

    if (type === 'created') {
      pools = await prisma.pool.findMany({
        where: { creator: address.toLowerCase() },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { bets: true } }
        }
      });
    } else if (type === 'participated') {
      // Pools donde el usuario ha apostado
      const userBets = await prisma.bet.findMany({
        where: { bettor: address.toLowerCase() },
        distinct: ['poolId'],
        select: { poolId: true }
      });
      
      const poolIds = userBets.map(b => b.poolId);
      
      pools = await prisma.pool.findMany({
        where: { poolId: { in: poolIds } },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { bets: true } }
        }
      });
    } else {
      // Todos (creados + participados)
      const userBets = await prisma.bet.findMany({
        where: { bettor: address.toLowerCase() },
        distinct: ['poolId'],
        select: { poolId: true }
      });
      
      const poolIds = userBets.map(b => b.poolId);
      
      pools = await prisma.pool.findMany({
        where: {
          OR: [
            { creator: address.toLowerCase() },
            { poolId: { in: poolIds } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { bets: true } }
        }
      });
    }

    res.json({ data: pools });

  } catch (error) {
    logger.error('Error obteniendo pools del usuario:', error);
    res.status(500).json({ error: 'Error obteniendo pools' });
  }
});

module.exports = router;

