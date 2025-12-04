// 🔗 Ejemplo de integración Web3 para PollBucket
import { ethers } from 'ethers';
import { CONTRACTS, NETWORKS } from './contract-config.js';

class PollBucketWeb3 {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contracts = {};
    this.currentNetwork = null;
  }

  // 🔌 Conectar a MetaMask
  async connectWallet() {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask no está instalado');
      }

      // Solicitar conexión
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Configurar provider
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      
      // Verificar red
      const network = await this.provider.getNetwork();
      this.currentNetwork = network.chainId;
      
      console.log('✅ Wallet conectado:', await this.signer.getAddress());
      console.log('🌐 Red:', network.name, '(Chain ID:', network.chainId, ')');
      
      return {
        address: await this.signer.getAddress(),
        network: network.chainId
      };
    } catch (error) {
      console.error('❌ Error conectando wallet:', error);
      throw error;
    }
  }

  // 🔄 Cambiar a red Hardhat
  async switchToHardhat() {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7A69' }], // 31337 en hex
      });
    } catch (switchError) {
      // Si la red no existe, agregarla
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0x7A69',
            chainName: 'Hardhat Local',
            rpcUrls: ['http://127.0.0.1:8545'],
            nativeCurrency: {
              name: 'Ethereum',
              symbol: 'ETH',
              decimals: 18
            }
          }]
        });
      }
    }
  }

  // 📋 Inicializar contratos
  async initializeContracts() {
    if (!this.signer) {
      throw new Error('Wallet no conectado');
    }

    // Aquí necesitarás importar los ABIs reales
    // Por ahora uso un ABI mínimo de ejemplo
    const pollPoolABI = [
      "function createPool(string memory question, string[] memory options, uint256 endTime, uint256 maxParticipants, uint256 fixedBetAmount) external payable",
      "function placeBet(uint256 poolId, uint256 optionIndex) external payable",
      "function pools(uint256) external view returns (tuple(string question, uint256 totalAmount, uint256 participantCount, uint256 maxParticipants, bool isActive))",
      "function transactionFee() external view returns (uint256)",
      "function minimumFixedBetAmount() external view returns (uint256)",
      "event PoolCreated(uint256 indexed poolId, address indexed creator, string question)"
    ];

    const reputationABI = [
      "function registerAsJuror() external payable",
      "function getJurorProfile(address juror) external view returns (tuple(uint256 reputation, uint256 stakedAmount, bool isActive))"
    ];

    this.contracts = {
      pollPool: new ethers.Contract(CONTRACTS.POLL_POOL, pollPoolABI, this.signer),
      reputationSystem: new ethers.Contract(CONTRACTS.REPUTATION_SYSTEM, reputationABI, this.signer)
    };

    console.log('✅ Contratos inicializados');
  }

  // 🎯 Crear un pool
  async createPool(question, options, durationHours, maxParticipants, betAmountETH) {
    try {
      // Validar parámetros
      if (!question || question.trim() === '') {
        throw new Error('La pregunta no puede estar vacía');
      }
      if (!options || options.length < 2) {
        throw new Error('Debe haber al menos 2 opciones');
      }
      if (durationHours <= 0) {
        throw new Error('La duración debe ser mayor a 0');
      }
      if (maxParticipants !== 0 && maxParticipants < 2) {
        throw new Error('El máximo de participantes debe ser 0 (sin límite) o al menos 2');
      }

      // Calcular tiempo de cierre
      const endTime = Math.floor(Date.now() / 1000) + (durationHours * 3600);
      
      // Convertir monto a wei
      const betAmount = ethers.parseEther(betAmountETH.toString());
      
      // Verificar monto mínimo
      const minimumFixedBetAmount = await this.contracts.pollPool.minimumFixedBetAmount();
      if (betAmount < minimumFixedBetAmount) {
        throw new Error(
          `El monto mínimo es ${ethers.formatEther(minimumFixedBetAmount)} AVAX`
        );
      }

      // Obtener comisión de transacción del contrato
      const transactionFee = await this.contracts.pollPool.transactionFee();
      
      // Calcular comisión y monto total requerido
      // transactionFee está en basis points (200 = 2%)
      const feeAmount = (betAmount * transactionFee) / 10000n;
      const totalRequired = betAmount + feeAmount;

      console.log(`💰 Monto fijo: ${ethers.formatEther(betAmount)} AVAX`);
      console.log(`💰 Comisión (${Number(transactionFee) / 100}%): ${ethers.formatEther(feeAmount)} AVAX`);
      console.log(`💰 Total a pagar: ${ethers.formatEther(totalRequired)} AVAX`);

      // Verificar balance suficiente
      const balance = await this.provider.getBalance(await this.signer.getAddress());
      if (balance < totalRequired) {
        throw new Error(
          `Balance insuficiente. Necesitas ${ethers.formatEther(totalRequired)} AVAX pero tienes ${ethers.formatEther(balance)} AVAX`
        );
      }

      // Crear el pool con el monto total (monto fijo + comisión)
      const tx = await this.contracts.pollPool.createPool(
        question,
        options,
        endTime,
        maxParticipants,
        betAmount, // Monto fijo por voto
        { value: totalRequired } // Total a pagar (monto fijo + comisión)
      );

      console.log('⏳ Creando pool...', tx.hash);
      const receipt = await tx.wait();
      
      // Extraer el poolId del evento PoolCreated
      const poolCreatedEvent = receipt.logs.find(
        log => {
          try {
            const parsed = this.contracts.pollPool.interface.parseLog(log);
            return parsed && parsed.name === 'PoolCreated';
          } catch {
            return false;
          }
        }
      );
      
      let poolId = null;
      if (poolCreatedEvent) {
        const parsed = this.contracts.pollPool.interface.parseLog(poolCreatedEvent);
        poolId = parsed.args.poolId.toString();
      }

      console.log('✅ Pool creado!', { 
        txHash: tx.hash, 
        poolId: poolId,
        blockNumber: receipt.blockNumber 
      });

      return {
        receipt,
        poolId,
        txHash: tx.hash
      };
    } catch (error) {
      console.error('❌ Error creando pool:', error);
      throw error;
    }
  }

  // 🎲 Apostar en un pool
  async placeBet(poolId, optionIndex, betAmountETH) {
    try {
      const betAmount = ethers.parseEther(betAmountETH.toString());

      const tx = await this.contracts.pollPool.placeBet(
        poolId,
        optionIndex,
        { value: betAmount }
      );

      console.log('⏳ Apostando...', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Apuesta realizada!', receipt);

      return receipt;
    } catch (error) {
      console.error('❌ Error apostando:', error);
      throw error;
    }
  }

  // 👨‍⚖️ Registrarse como jurado
  async registerAsJuror(stakeAmountETH = "0.1") {
    try {
      const stakeAmount = ethers.parseEther(stakeAmountETH);

      const tx = await this.contracts.reputationSystem.registerAsJuror({
        value: stakeAmount
      });

      console.log('⏳ Registrando como jurado...', tx.hash);
      const receipt = await tx.wait();
      console.log('✅ Registrado como jurado!', receipt);

      return receipt;
    } catch (error) {
      console.error('❌ Error registrando jurado:', error);
      throw error;
    }
  }

  // 📊 Obtener información de un pool
  async getPoolInfo(poolId) {
    try {
      const poolInfo = await this.contracts.pollPool.pools(poolId);
      return {
        question: poolInfo.question,
        totalAmount: ethers.formatEther(poolInfo.totalAmount),
        participantCount: poolInfo.participantCount.toString(),
        maxParticipants: poolInfo.maxParticipants.toString(),
        isActive: poolInfo.isActive
      };
    } catch (error) {
      console.error('❌ Error obteniendo info del pool:', error);
      throw error;
    }
  }

  // 📋 Listar todos los pools activos
  async getActivePools() {
    try {
      console.log("🔍 Obteniendo pools activos...");
      
      // Obtener IDs de pools con status "Open" (0)
      const activePoolIds = await this.contracts.pollPool.getPoolsByStatus(0);
      
      console.log(`📊 Encontrados ${activePoolIds.length} pools activos`);
      
      const activePools = [];
      
      for (let i = 0; i < activePoolIds.length; i++) {
        const poolId = activePoolIds[i];
        try {
          const pool = await this.contracts.pollPool.getPool(poolId);
          const poolInfo = await this.contracts.pollPool.getPoolInfo(poolId);
          const timeInfo = await this.contracts.pollPool.getPoolTimeRemaining(poolId);
          const [canJoin, joinReason] = await this.contracts.pollPool.canJoinPool(poolId);
          
          // Solo incluir si no está expirado
          if (!timeInfo.isExpired) {
            activePools.push({
              id: poolId.toString(),
              question: pool.question,
              options: pool.options,
              creator: pool.creator,
              totalAmount: ethers.formatEther(pool.totalAmount),
              fixedBetAmount: ethers.formatEther(poolInfo.fixedBetAmount),
              currentParticipants: poolInfo.currentParticipants.toString(),
              maxParticipants: poolInfo.maxParticipants.toString() === "0" ? "∞" : poolInfo.maxParticipants.toString(),
              secondsRemaining: timeInfo.secondsRemaining.toString(),
              isExpired: timeInfo.isExpired,
              canJoin: canJoin,
              joinReason: joinReason,
              endDate: new Date(Number(pool.endTime) * 1000).toLocaleString()
            });
          }
        } catch (error) {
          console.warn(`⚠️ Error obteniendo info del pool ${poolId}:`, error.message);
        }
      }
      
      // Ordenar por tiempo restante (los que expiran pronto primero)
      activePools.sort((a, b) => parseInt(a.secondsRemaining) - parseInt(b.secondsRemaining));
      
      console.log(`✅ ${activePools.length} pools activos válidos encontrados`);
      return activePools;
      
    } catch (error) {
      console.error("❌ Error obteniendo pools activos:", error);
      throw error;
    }
  }

  // 🔍 Filtrar pools activos por criterios
  async getFilteredActivePools(filters = {}) {
    try {
      const activePools = await this.getActivePools();
      let filteredPools = [...activePools];
      
      // Filtro por creador
      if (filters.creator) {
        filteredPools = filteredPools.filter(pool => 
          pool.creator.toLowerCase() === filters.creator.toLowerCase()
        );
      }
      
      // Filtro por monto de apuesta
      if (filters.minBetAmount) {
        filteredPools = filteredPools.filter(pool => 
          parseFloat(pool.fixedBetAmount) >= parseFloat(filters.minBetAmount)
        );
      }
      
      if (filters.maxBetAmount) {
        filteredPools = filteredPools.filter(pool => 
          parseFloat(pool.fixedBetAmount) <= parseFloat(filters.maxBetAmount)
        );
      }
      
      // Filtro por disponibilidad
      if (filters.canJoinOnly) {
        filteredPools = filteredPools.filter(pool => pool.canJoin);
      }
      
      // Filtro por tiempo restante mínimo (en horas)
      if (filters.minHoursRemaining) {
        const minSeconds = filters.minHoursRemaining * 3600;
        filteredPools = filteredPools.filter(pool => 
          parseInt(pool.secondsRemaining) >= minSeconds
        );
      }
      
      // Filtro por búsqueda en pregunta
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        filteredPools = filteredPools.filter(pool => 
          pool.question.toLowerCase().includes(query) ||
          pool.options.some(option => option.toLowerCase().includes(query))
        );
      }
      
      return filteredPools;
      
    } catch (error) {
      console.error("❌ Error filtrando pools:", error);
      throw error;
    }
  }

  // 📈 Obtener estadísticas de pools
  async getPoolStatistics() {
    try {
      const totalPools = await this.contracts.pollPool.getTotalPoolsCount();
      const activePools = await this.contracts.pollPool.getActivePoolsCount();
      
      return {
        total: totalPools.toString(),
        active: activePools.toString(),
        percentage: totalPools > 0 ? ((activePools * 100) / totalPools).toFixed(1) : "0"
      };
    } catch (error) {
      console.error("❌ Error obteniendo estadísticas:", error);
      throw error;
    }
  }

  // 🕒 Formatear tiempo restante
  formatTimeRemaining(secondsRemaining) {
    const seconds = parseInt(secondsRemaining);
    
    if (seconds <= 0) return "Expirado";
    
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // 📊 Obtener información del estado de un pool
  async getPoolStatus(poolId) {
    try {
      const pool = await this.contracts.pollPool.getPool(poolId);
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Estados posibles: 0=Open, 1=Closed, 2=Validated/Resolved, 3=Cancelled
      const statusCode = Number(pool.status);
      const statusNames = ['Open', 'Closed', 'Validated', 'Cancelled'];
      
      const isExpired = currentTime >= Number(pool.closeTime);
      const canBet = statusCode === 0 && !isExpired;
      const canDistribute = statusCode === 2 && !pool.rewardsDistributed;
      
      return {
        code: statusCode,
        name: statusNames[statusCode],
        isOpen: statusCode === 0,
        isClosed: statusCode === 1,
        isValidated: statusCode === 2,
        isCancelled: statusCode === 3,
        isExpired: isExpired,
        canBet: canBet,
        canDistribute: canDistribute,
        rewardsDistributed: pool.rewardsDistributed,
        winningOption: pool.winningOption ? Number(pool.winningOption) : null,
        closeTime: Number(pool.closeTime)
      };
    } catch (error) {
      console.error('❌ Error obteniendo estado del pool:', error);
      throw error;
    }
  }

  // 🔍 Verificar si un pool está abierto y acepta apuestas
  async canBetOnPool(poolId) {
    try {
      const status = await this.getPoolStatus(poolId);
      return status.canBet;
    } catch (error) {
      console.error('❌ Error verificando si se puede apostar:', error);
      return false;
    }
  }

  // 📋 Obtener pools por estado
  async getPoolsByStatus(statusCode) {
    try {
      const poolIds = await this.contracts.pollPool.getPoolsByStatus(statusCode);
      const pools = [];
      
      for (const poolId of poolIds) {
        try {
          const pool = await this.contracts.pollPool.getPool(poolId);
          pools.push({
            id: poolId.toString(),
            ...pool,
            status: Number(pool.status),
            statusName: ['Open', 'Closed', 'Validated', 'Cancelled'][Number(pool.status)]
          });
        } catch (error) {
          console.warn(`⚠️ Error obteniendo pool ${poolId}:`, error.message);
        }
      }
      
      return pools;
    } catch (error) {
      console.error('❌ Error obteniendo pools por estado:', error);
      throw error;
    }
  }

  // 🎨 Formatear estado para mostrar en UI
  formatPoolStatus(statusCode, isExpired = false) {
    const statusMap = {
      0: { name: 'Abierto', color: '#4CAF50', icon: '🟢' },
      1: { name: 'Cerrado', color: '#FF9800', icon: '🟠' },
      2: { name: 'Validado', color: '#2196F3', icon: '🔵' },
      3: { name: 'Cancelado', color: '#F44336', icon: '🔴' }
    };
    
    const status = statusMap[statusCode] || { name: 'Desconocido', color: '#9E9E9E', icon: '⚪' };
    
    if (statusCode === 0 && isExpired) {
      return {
        ...status,
        name: 'Expirado',
        color: '#9E9E9E',
        icon: '⏰'
      };
    }
    
    return status;
  }
}

// 🚀 Uso del ejemplo
export default PollBucketWeb3;

// Ejemplo de uso:
/*
const pollBucket = new PollBucketWeb3();

// Conectar wallet
await pollBucket.connectWallet();

// Cambiar a red Hardhat si es necesario
await pollBucket.switchToHardhat();

// Inicializar contratos
await pollBucket.initializeContracts();

// Crear un pool
await pollBucket.createPool(
  "¿Quién ganará el Mundial?",
  ["Argentina", "Brasil", "Francia", "España"],
  24, // 24 horas
  10, // máximo 10 participantes
  "0.05" // 0.05 ETH por apuesta
);

// Apostar en un pool
await pollBucket.placeBet(0, 1, "0.05"); // Pool 0, opción 1, 0.05 ETH
*/