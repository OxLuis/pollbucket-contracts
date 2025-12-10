// 💳 Rutas API para Transacciones
const express = require('express');
const router = express.Router();
const { prisma } = require('../utils/prisma');
const logger = require('../utils/logger');

// GET /api/transactions - Listar transacciones
router.get('/', async (req, res) => {
  try {
    const {
      type,
      poolId,
      from,
      status,
      sortBy = 'blockTimestamp',
      sortOrder = 'desc',
      page = 1,
      limit = 50
    } = req.query;

    const where = {};
    
    if (type) {
      where.type = type.toUpperCase();
    }
    
    if (poolId) {
      where.poolId = parseInt(poolId);
    }
    
    if (from) {
      where.from = from.toLowerCase();
    }
    
    if (status) {
      where.status = status.toUpperCase();
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const orderBy = { [sortBy]: sortOrder };

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          pool: {
            select: {
              question: true,
              status: true
            }
          }
        }
      }),
      prisma.transaction.count({ where })
    ]);

    res.json({
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error listando transacciones:', error);
    res.status(500).json({ error: 'Error obteniendo transacciones' });
  }
});

// GET /api/transactions/recent - Transacciones recientes
router.get('/recent', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const transactions = await prisma.transaction.findMany({
      orderBy: { blockTimestamp: 'desc' },
      take: parseInt(limit),
      include: {
        pool: {
          select: {
            poolId: true,
            question: true
          }
        }
      }
    });

    res.json({ data: transactions });

  } catch (error) {
    logger.error('Error obteniendo transacciones recientes:', error);
    res.status(500).json({ error: 'Error obteniendo transacciones' });
  }
});

// GET /api/transactions/:txHash - Obtener transacción por hash
router.get('/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;

    const transaction = await prisma.transaction.findUnique({
      where: { txHash },
      include: {
        pool: true
      }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    res.json({ data: transaction });

  } catch (error) {
    logger.error('Error obteniendo transacción:', error);
    res.status(500).json({ error: 'Error obteniendo transacción' });
  }
});

// GET /api/transactions/user/:address - Transacciones de un usuario
router.get('/user/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { page = 1, limit = 50, type } = req.query;

    const where = {
      from: address.toLowerCase()
    };
    
    if (type) {
      where.type = type.toUpperCase();
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { blockTimestamp: 'desc' },
        skip,
        take,
        include: {
          pool: {
            select: {
              poolId: true,
              question: true
            }
          }
        }
      }),
      prisma.transaction.count({ where })
    ]);

    res.json({
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Error obteniendo transacciones del usuario:', error);
    res.status(500).json({ error: 'Error obteniendo transacciones' });
  }
});

// GET /api/transactions/pool/:poolId - Transacciones de un pool
router.get('/pool/:poolId', async (req, res) => {
  try {
    const { poolId } = req.params;

    const transactions = await prisma.transaction.findMany({
      where: { poolId: parseInt(poolId) },
      orderBy: { blockTimestamp: 'desc' }
    });

    res.json({ data: transactions });

  } catch (error) {
    logger.error('Error obteniendo transacciones del pool:', error);
    res.status(500).json({ error: 'Error obteniendo transacciones' });
  }
});

module.exports = router;

