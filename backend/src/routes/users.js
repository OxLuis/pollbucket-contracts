// 👤 Rutas API para Usuarios
const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const logger = require('../utils/logger');

// GET /api/users/:address - Obtener perfil de usuario
router.get('/:address', async (req, res) => {
  try {
    const { address } = req.params;

    let user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() }
    });

    if (!user) {
      // Crear usuario si no existe
      user = await prisma.user.create({
        data: {
          address: address.toLowerCase()
        }
      });
    }

    // Obtener estadísticas adicionales
    const [poolsCreated, betsCount, uniquePools] = await Promise.all([
      prisma.pool.count({
        where: { creator: address.toLowerCase() }
      }),
      prisma.bet.count({
        where: { bettor: address.toLowerCase() }
      }),
      prisma.bet.findMany({
        where: { bettor: address.toLowerCase() },
        distinct: ['poolId'],
        select: { poolId: true }
      })
    ]);

    res.json({
      data: {
        ...user,
        stats: {
          poolsCreated,
          totalBets: betsCount,
          uniquePoolsParticipated: uniquePools.length
        }
      }
    });

  } catch (error) {
    logger.error('Error obteniendo usuario:', error);
    res.status(500).json({ error: 'Error obteniendo usuario' });
  }
});

// GET /api/users/:address/pools - Pools del usuario
router.get('/:address/pools', async (req, res) => {
  try {
    const { address } = req.params;
    const { type = 'created' } = req.query; // created, participated, won

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
      const userBets = await prisma.bet.findMany({
        where: { bettor: address.toLowerCase() },
        distinct: ['poolId'],
        select: { poolId: true }
      });
      
      pools = await prisma.pool.findMany({
        where: { poolId: { in: userBets.map(b => b.poolId) } },
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { bets: true } }
        }
      });
    } else if (type === 'won') {
      // Pools donde el usuario ganó
      const userBets = await prisma.bet.findMany({
        where: { bettor: address.toLowerCase() },
        select: { poolId: true, option: true }
      });
      
      const poolsWithWinningBets = await prisma.pool.findMany({
        where: {
          poolId: { in: userBets.map(b => b.poolId) },
          status: 'VALIDATED',
          rewardsDistributed: true
        },
        include: {
          _count: { select: { bets: true } }
        }
      });
      
      // Filtrar pools donde la apuesta del usuario coincide con winningOption
      pools = poolsWithWinningBets.filter(pool => {
        const userBet = userBets.find(b => b.poolId === pool.poolId);
        return userBet && userBet.option === pool.winningOption;
      });
    }

    res.json({ data: pools });

  } catch (error) {
    logger.error('Error obteniendo pools del usuario:', error);
    res.status(500).json({ error: 'Error obteniendo pools' });
  }
});

// GET /api/users/:address/bets - Apuestas del usuario
router.get('/:address/bets', async (req, res) => {
  try {
    const { address } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [bets, total] = await Promise.all([
      prisma.bet.findMany({
        where: { bettor: address.toLowerCase() },
        orderBy: { timestamp: 'desc' },
        skip,
        take,
        include: {
          pool: {
            select: {
              poolId: true,
              question: true,
              options: true,
              status: true,
              winningOption: true
            }
          }
        }
      }),
      prisma.bet.count({
        where: { bettor: address.toLowerCase() }
      })
    ]);

    // Agregar info de si ganó o no
    const betsWithResult = bets.map(bet => ({
      ...bet,
      won: bet.pool.status === 'VALIDATED' && bet.option === bet.pool.winningOption
    }));

    res.json({
      data: betsWithResult,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error obteniendo apuestas del usuario:', error);
    res.status(500).json({ error: 'Error obteniendo apuestas' });
  }
});

// GET /api/users/leaderboard - Top usuarios
router.get('/leaderboard/top', async (req, res) => {
  try {
    const { limit = 10, sortBy = 'totalWins' } = req.query;

    const users = await prisma.user.findMany({
      orderBy: { [sortBy]: 'desc' },
      take: parseInt(limit),
      where: {
        totalBets: { gt: 0 }
      }
    });

    res.json({ data: users });

  } catch (error) {
    logger.error('Error obteniendo leaderboard:', error);
    res.status(500).json({ error: 'Error obteniendo leaderboard' });
  }
});

module.exports = router;

