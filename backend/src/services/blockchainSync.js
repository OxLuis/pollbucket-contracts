// ⛓️ Servicio de sincronización blockchain
// Escucha eventos del contrato y guarda en base de datos

const { ethers } = require('ethers');
const { prisma } = require('../utils/prisma');
const { getProvider, getContract, mapCategory, mapPoolStatus } = require('../utils/blockchain');
const logger = require('../utils/logger');

class BlockchainSync {
  constructor() {
    this.provider = null;
    this.pollPool = null;
    this.reputationSystem = null;
    this.isRunning = false;
    this.syncInterval = null;
  }

  async start() {
    if (this.isRunning) {
      logger.warn('⚠️ Sincronización ya está corriendo');
      return;
    }

    try {
      logger.info('🔄 Iniciando sincronización blockchain...');
      
      this.provider = getProvider();
      
      // Obtener direcciones de contratos
      const pollPoolAddress = process.env.POLL_POOL_ADDRESS;
      const reputationAddress = process.env.REPUTATION_SYSTEM_ADDRESS;
      
      if (!pollPoolAddress) {
        throw new Error('POLL_POOL_ADDRESS no configurado');
      }

      // Conectar a contratos
      this.pollPool = getContract('PollPool', pollPoolAddress);
      
      if (reputationAddress) {
        this.reputationSystem = getContract('ReputationSystem', reputationAddress);
      }

      // Marcar como corriendo
      this.isRunning = true;
      await prisma.syncState.upsert({
        where: { id: 1 },
        update: { isRunning: true },
        create: { id: 1, isRunning: true }
      });

      // Sincronizar eventos históricos primero
      await this.syncHistoricalEvents();

      // Escuchar eventos en tiempo real
      this.setupEventListeners();

      // Sincronización periódica (cada 30 segundos)
      this.syncInterval = setInterval(() => this.periodicSync(), 30000);

      logger.info('✅ Sincronización blockchain iniciada');

    } catch (error) {
      logger.error('❌ Error iniciando sincronización:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Remover listeners
    if (this.pollPool) {
      this.pollPool.removeAllListeners();
    }
    
    this.isRunning = false;
    await prisma.syncState.update({
      where: { id: 1 },
      data: { isRunning: false }
    });
    
    logger.info('🛑 Sincronización blockchain detenida');
  }

  // Sincronizar eventos históricos
  // forceFromBlock: si se proporciona, ignora el estado guardado y sincroniza desde ese bloque
  async syncHistoricalEvents(forceFromBlock = null) {
    try {
      const syncState = await prisma.syncState.findUnique({ where: { id: 1 } });
      
      // Determinar bloque inicial
      let startBlock;
      if (forceFromBlock !== null) {
        startBlock = forceFromBlock;
        logger.info(`🔄 Sincronización FORZADA desde bloque ${startBlock}`);
      } else {
        startBlock = syncState?.lastBlockNumber || parseInt(process.env.SYNC_START_BLOCK) || 0;
      }
      
      const currentBlock = await this.provider.getBlockNumber();
      const totalBlocks = currentBlock - startBlock;

      logger.info(`📜 Sincronizando eventos históricos:`);
      logger.info(`   📍 Desde bloque: ${startBlock}`);
      logger.info(`   📍 Hasta bloque: ${currentBlock}`);
      logger.info(`   📊 Total bloques: ${totalBlocks}`);

      if (totalBlocks <= 0) {
        logger.info('✅ Base de datos ya está sincronizada');
        return { synced: true, fromBlock: startBlock, toBlock: currentBlock, eventsProcessed: 0 };
      }

      // Sincronizar en lotes para evitar timeout
      const BATCH_SIZE = 2000; // Aumentado para mejor rendimiento
      let totalEventsProcessed = 0;
      let poolsCreated = 0;
      let betsPlaced = 0;
      
      for (let fromBlock = startBlock; fromBlock <= currentBlock; fromBlock += BATCH_SIZE) {
        const toBlock = Math.min(fromBlock + BATCH_SIZE - 1, currentBlock);
        const progress = Math.round(((fromBlock - startBlock) / totalBlocks) * 100);
        
        logger.info(`   🔄 [${progress}%] Procesando bloques ${fromBlock} - ${toBlock}...`);
        
        // Obtener todos los eventos en paralelo para mejor rendimiento
        const [
          poolCreatedEvents,
          betPlacedEvents,
          poolClosedEvents,
          poolValidatedEvents,
          poolCancelledEvents,
          rewardsDistributedEvents
        ] = await Promise.all([
          this.pollPool.queryFilter(this.pollPool.filters.PoolCreated(), fromBlock, toBlock),
          this.pollPool.queryFilter(this.pollPool.filters.BetPlaced(), fromBlock, toBlock),
          this.pollPool.queryFilter(this.pollPool.filters.PoolClosed(), fromBlock, toBlock),
          this.pollPool.queryFilter(this.pollPool.filters.PoolValidated(), fromBlock, toBlock),
          this.pollPool.queryFilter(this.pollPool.filters.PoolCancelled(), fromBlock, toBlock),
          this.pollPool.queryFilter(this.pollPool.filters.RewardsDistributed(), fromBlock, toBlock)
        ]);

        // Procesar PoolCreated
        for (const event of poolCreatedEvents) {
          await this.handlePoolCreated(event);
          poolsCreated++;
          totalEventsProcessed++;
        }

        // Procesar BetPlaced
        for (const event of betPlacedEvents) {
          await this.handleBetPlaced(event);
          betsPlaced++;
          totalEventsProcessed++;
        }

        // Procesar otros eventos
        for (const event of poolClosedEvents) {
          await this.handlePoolClosed(event);
          totalEventsProcessed++;
        }

        for (const event of poolValidatedEvents) {
          await this.handlePoolValidated(event);
          totalEventsProcessed++;
        }

        for (const event of poolCancelledEvents) {
          await this.handlePoolCancelled(event);
          totalEventsProcessed++;
        }

        for (const event of rewardsDistributedEvents) {
          await this.handleRewardsDistributed(event);
          totalEventsProcessed++;
        }

        // Actualizar progreso en DB después de cada lote
        await prisma.syncState.update({
          where: { id: 1 },
          data: { 
            lastBlockNumber: toBlock,
            lastSyncTime: new Date()
          }
        });
      }

      logger.info(`✅ Sincronización histórica completada:`);
      logger.info(`   📊 Eventos procesados: ${totalEventsProcessed}`);
      logger.info(`   📊 Pools creados: ${poolsCreated}`);
      logger.info(`   📊 Apuestas: ${betsPlaced}`);
      logger.info(`   📍 Último bloque: ${currentBlock}`);

      return {
        synced: true,
        fromBlock: startBlock,
        toBlock: currentBlock,
        eventsProcessed: totalEventsProcessed,
        poolsCreated,
        betsPlaced
      };

    } catch (error) {
      logger.error('❌ Error sincronizando eventos históricos:', error);
      throw error;
    }
  }

  // Forzar sincronización desde un bloque específico (útil para re-sincronizar)
  async forceSync(fromBlock = 0) {
    logger.info(`🔄 Iniciando sincronización forzada desde bloque ${fromBlock}`);
    return await this.syncHistoricalEvents(fromBlock);
  }

  // Sincronizar solo un pool específico
  async syncPool(poolId) {
    try {
      logger.info(`🔄 Sincronizando pool ${poolId}...`);
      
      const poolData = await this.pollPool.getPool(poolId);
      const [category, isPremium, imageURI] = await this.pollPool.getPoolCategoryInfo(poolId);
      
      await prisma.pool.upsert({
        where: { poolId: Number(poolId) },
        update: {
          totalStake: poolData.totalStake.toString(),
          currentParticipants: Number(poolData.currentParticipants),
          status: mapPoolStatus(Number(poolData.status)),
          winningOption: poolData.winningOption ? Number(poolData.winningOption) : null,
          rewardsDistributed: poolData.rewardsDistributed
        },
        create: {
          poolId: Number(poolId),
          creator: poolData.creator.toLowerCase(),
          question: poolData.question,
          options: poolData.options,
          openTime: new Date(Number(poolData.openTime) * 1000),
          closeTime: new Date(Number(poolData.closeTime) * 1000),
          totalStake: poolData.totalStake.toString(),
          fixedBetAmount: poolData.fixedBetAmount.toString(),
          maxParticipants: Number(poolData.maxParticipants),
          currentParticipants: Number(poolData.currentParticipants),
          status: mapPoolStatus(Number(poolData.status)),
          category: mapCategory(Number(category)),
          isPremium: isPremium,
          imageURI: imageURI || null
        }
      });
      
      logger.info(`✅ Pool ${poolId} sincronizado`);
      return true;
    } catch (error) {
      logger.error(`❌ Error sincronizando pool ${poolId}:`, error);
      throw error;
    }
  }

  // Configurar listeners de eventos en tiempo real
  setupEventListeners() {
    logger.info('👂 Configurando listeners de eventos...');

    // PoolCreated
    this.pollPool.on('PoolCreated', async (poolId, creator, question, category, isPremium, event) => {
      logger.info(`📊 Nuevo pool creado: ${poolId}`);
      await this.handlePoolCreated(event);
    });

    // BetPlaced
    this.pollPool.on('BetPlaced', async (poolId, bettor, option, amount, event) => {
      logger.info(`🎲 Nueva apuesta en pool ${poolId}`);
      await this.handleBetPlaced(event);
    });

    // PoolClosed
    this.pollPool.on('PoolClosed', async (poolId, event) => {
      logger.info(`🔒 Pool cerrado: ${poolId}`);
      await this.handlePoolClosed(event);
    });

    // PoolValidated
    this.pollPool.on('PoolValidated', async (poolId, winningOption, event) => {
      logger.info(`✅ Pool validado: ${poolId}, opción ganadora: ${winningOption}`);
      await this.handlePoolValidated(event);
    });

    // PoolCancelled
    this.pollPool.on('PoolCancelled', async (poolId, cancelledBy, reason, byOwner, event) => {
      logger.info(`❌ Pool cancelado: ${poolId}, razón: ${reason}`);
      await this.handlePoolCancelled(event);
    });

    // RewardsDistributed
    this.pollPool.on('RewardsDistributed', async (poolId, totalRewards, event) => {
      logger.info(`💰 Recompensas distribuidas en pool ${poolId}`);
      await this.handleRewardsDistributed(event);
    });

    logger.info('✅ Listeners configurados');
  }

  // Manejadores de eventos
  async handlePoolCreated(event) {
    try {
      const { poolId, creator, question, category, isPremium } = event.args;
      const block = await event.getBlock();
      const tx = await event.getTransaction();

      // Obtener datos completos del pool del contrato
      const poolData = await this.pollPool.getPool(poolId);
      const [, , imageURI] = await this.pollPool.getPoolCategoryInfo(poolId);

      // Crear o actualizar pool en DB
      await prisma.pool.upsert({
        where: { poolId: Number(poolId) },
        update: {},
        create: {
          poolId: Number(poolId),
          creator: creator.toLowerCase(),
          question: question,
          options: poolData.options,
          openTime: new Date(Number(poolData.openTime) * 1000),
          closeTime: new Date(Number(poolData.closeTime) * 1000),
          totalStake: poolData.totalStake.toString(),
          fixedBetAmount: poolData.fixedBetAmount.toString(),
          maxParticipants: Number(poolData.maxParticipants),
          currentParticipants: Number(poolData.currentParticipants),
          status: 'OPEN',
          category: mapCategory(Number(category)),
          isPremium: isPremium,
          imageURI: imageURI || null,
          txHash: tx.hash,
          blockNumber: block.number
        }
      });

      // Registrar transacción
      await this.saveTransaction(event, 'POOL_CREATED', Number(poolId));

      // Actualizar stats del usuario
      await this.updateUserStats(creator.toLowerCase(), { poolsCreated: { increment: 1 } });

    } catch (error) {
      logger.error(`Error procesando PoolCreated:`, error);
    }
  }

  async handleBetPlaced(event) {
    try {
      const { poolId, bettor, option, amount } = event.args;
      const block = await event.getBlock();
      const tx = await event.getTransaction();

      // Crear bet en DB
      await prisma.bet.create({
        data: {
          poolId: Number(poolId),
          bettor: bettor.toLowerCase(),
          amount: amount.toString(),
          option: Number(option),
          timestamp: new Date(block.timestamp * 1000),
          txHash: tx.hash,
          blockNumber: block.number
        }
      });

      // Actualizar pool
      const poolData = await this.pollPool.getPool(poolId);
      await prisma.pool.update({
        where: { poolId: Number(poolId) },
        data: {
          totalStake: poolData.totalStake.toString(),
          currentParticipants: Number(poolData.currentParticipants)
        }
      });

      // Registrar transacción
      await this.saveTransaction(event, 'BET_PLACED', Number(poolId));

      // Actualizar stats del usuario
      await this.updateUserStats(bettor.toLowerCase(), { 
        totalBets: { increment: 1 },
        totalStaked: amount.toString() // Se sumará en el update
      });

    } catch (error) {
      logger.error(`Error procesando BetPlaced:`, error);
    }
  }

  async handlePoolClosed(event) {
    try {
      const { poolId } = event.args;

      await prisma.pool.update({
        where: { poolId: Number(poolId) },
        data: { status: 'CLOSED' }
      });

      await this.saveTransaction(event, 'POOL_CLOSED', Number(poolId));

    } catch (error) {
      logger.error(`Error procesando PoolClosed:`, error);
    }
  }

  async handlePoolValidated(event) {
    try {
      const { poolId, winningOption } = event.args;

      await prisma.pool.update({
        where: { poolId: Number(poolId) },
        data: { 
          status: 'VALIDATED',
          winningOption: Number(winningOption)
        }
      });

      await this.saveTransaction(event, 'POOL_VALIDATED', Number(poolId));

    } catch (error) {
      logger.error(`Error procesando PoolValidated:`, error);
    }
  }

  async handlePoolCancelled(event) {
    try {
      const { poolId, cancelledBy, reason, byOwner } = event.args;

      await prisma.pool.update({
        where: { poolId: Number(poolId) },
        data: { status: 'CANCELLED' }
      });

      await this.saveTransaction(event, 'POOL_CANCELLED', Number(poolId), {
        cancelledBy: cancelledBy.toLowerCase(),
        reason,
        byOwner
      });

    } catch (error) {
      logger.error(`Error procesando PoolCancelled:`, error);
    }
  }

  async handleRewardsDistributed(event) {
    try {
      const { poolId, totalRewards } = event.args;

      await prisma.pool.update({
        where: { poolId: Number(poolId) },
        data: { rewardsDistributed: true }
      });

      await this.saveTransaction(event, 'REWARDS_DISTRIBUTED', Number(poolId), {
        totalRewards: totalRewards.toString()
      });

    } catch (error) {
      logger.error(`Error procesando RewardsDistributed:`, error);
    }
  }

  // Guardar transacción en DB
  async saveTransaction(event, type, poolId = null, extraData = null) {
    try {
      const block = await event.getBlock();
      const tx = await event.getTransaction();

      await prisma.transaction.upsert({
        where: { txHash: tx.hash },
        update: {},
        create: {
          txHash: tx.hash,
          blockNumber: block.number,
          blockTimestamp: new Date(block.timestamp * 1000),
          from: tx.from.toLowerCase(),
          to: tx.to?.toLowerCase() || null,
          value: tx.value.toString(),
          type: type,
          status: 'CONFIRMED',
          poolId: poolId,
          eventName: event.eventName || event.fragment?.name,
          eventData: extraData
        }
      });

    } catch (error) {
      // Si ya existe, ignorar (upsert debería manejarlo)
      if (!error.code?.includes('P2002')) {
        logger.error('Error guardando transacción:', error);
      }
    }
  }

  // Actualizar estadísticas de usuario
  async updateUserStats(address, updates) {
    try {
      await prisma.user.upsert({
        where: { address: address.toLowerCase() },
        update: {
          ...updates,
          lastActive: new Date()
        },
        create: {
          address: address.toLowerCase(),
          ...updates
        }
      });
    } catch (error) {
      logger.error('Error actualizando stats de usuario:', error);
    }
  }

  // Sincronización periódica
  async periodicSync() {
    try {
      const syncState = await prisma.syncState.findUnique({ where: { id: 1 } });
      const lastBlock = syncState?.lastBlockNumber || 0;
      const currentBlock = await this.provider.getBlockNumber();

      if (currentBlock > lastBlock) {
        logger.debug(`🔄 Sincronización periódica: bloques ${lastBlock + 1} - ${currentBlock}`);
        
        // Procesar nuevos bloques
        // (Los eventos en tiempo real deberían capturarlos, pero esto es un backup)
        
        await prisma.syncState.update({
          where: { id: 1 },
          data: { 
            lastBlockNumber: currentBlock,
            lastSyncTime: new Date()
          }
        });
      }

    } catch (error) {
      logger.error('Error en sincronización periódica:', error);
    }
  }
}

module.exports = BlockchainSync;

