// 📋 Funciones para listar polls activos en PollBucket
import { ethers } from 'ethers';

export class PollListing {
  constructor(pollPoolContract) {
    this.pollPool = pollPoolContract;
  }

  // 🎯 Obtener todos los pools activos (no cerrados)
  async getActivePools() {
    try {
      console.log("🔍 Obteniendo pools activos...");
      
      // Obtener IDs de pools con status "Open" (0)
      const activePoolIds = await this.pollPool.getPoolsByStatus(0); // PoolStatus.Open = 0
      
      console.log(`📊 Encontrados ${activePoolIds.length} pools activos`);
      
      // Obtener información detallada de cada pool activo
      const activePools = [];
      
      for (let i = 0; i < activePoolIds.length; i++) {
        const poolId = activePoolIds[i];
        try {
          const poolInfo = await this.getDetailedPoolInfo(poolId);
          
          // Solo incluir si realmente está activo y no expirado
          if (poolInfo.isActive && !poolInfo.isExpired) {
            activePools.push({
              id: poolId.toString(),
              ...poolInfo
            });
          }
        } catch (error) {
          console.warn(`⚠️ Error obteniendo info del pool ${poolId}:`, error.message);
        }
      }
      
      // Ordenar por tiempo restante (los que expiran pronto primero)
      activePools.sort((a, b) => a.secondsRemaining - b.secondsRemaining);
      
      console.log(`✅ ${activePools.length} pools activos válidos encontrados`);
      return activePools;
      
    } catch (error) {
      console.error("❌ Error obteniendo pools activos:", error);
      throw error;
    }
  }

  // 📊 Obtener información detallada de un pool específico
  async getDetailedPoolInfo(poolId) {
    try {
      // Obtener información básica del pool
      const pool = await this.pollPool.getPool(poolId);
      
      // Obtener información extendida
      const poolInfo = await this.pollPool.getPoolInfo(poolId);
      const timeInfo = await this.pollPool.getPoolTimeRemaining(poolId);
      const [canJoin, joinReason] = await this.pollPool.canJoinPool(poolId);
      const stats = await this.pollPool.getPoolStats(poolId);
      
      return {
        // Información básica
        question: pool.question,
        options: pool.options,
        creator: pool.creator,
        endTime: pool.endTime.toString(),
        
        // Información financiera
        totalAmount: ethers.formatEther(pool.totalAmount),
        fixedBetAmount: ethers.formatEther(poolInfo.fixedBetAmount),
        
        // Participación
        currentParticipants: poolInfo.currentParticipants.toString(),
        maxParticipants: poolInfo.maxParticipants.toString() === "0" ? "∞" : poolInfo.maxParticipants.toString(),
        participantPercentage: stats.participantPercentage.toString(),
        
        // Estado y tiempo
        isActive: poolInfo.status === 0, // PoolStatus.Open
        isExpired: timeInfo.isExpired,
        secondsRemaining: timeInfo.secondsRemaining.toString(),
        daysRemaining: poolInfo.daysRemaining.toString(),
        hoursRemaining: poolInfo.hoursRemaining.toString(),
        minutesRemaining: poolInfo.minutesRemaining.toString(),
        
        // Capacidad
        isFull: stats.isFull,
        canJoin: canJoin,
        joinReason: joinReason,
        
        // Fechas formateadas
        endDate: new Date(Number(pool.endTime) * 1000).toLocaleString(),
        createdAt: new Date().toISOString() // Placeholder, el contrato no guarda fecha de creación
      };
      
    } catch (error) {
      console.error(`❌ Error obteniendo info detallada del pool ${poolId}:`, error);
      throw error;
    }
  }

  // 🔍 Filtrar pools por criterios específicos
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
      
      // Filtro por monto mínimo de apuesta
      if (filters.minBetAmount) {
        filteredPools = filteredPools.filter(pool => 
          parseFloat(pool.fixedBetAmount) >= parseFloat(filters.minBetAmount)
        );
      }
      
      // Filtro por monto máximo de apuesta
      if (filters.maxBetAmount) {
        filteredPools = filteredPools.filter(pool => 
          parseFloat(pool.fixedBetAmount) <= parseFloat(filters.maxBetAmount)
        );
      }
      
      // Filtro por disponibilidad (puede unirse)
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
      
      console.log(`🔍 Filtros aplicados: ${filteredPools.length} pools encontrados`);
      return filteredPools;
      
    } catch (error) {
      console.error("❌ Error filtrando pools:", error);
      throw error;
    }
  }

  // 📈 Obtener estadísticas generales de pools
  async getPoolStatistics() {
    try {
      const totalPools = await this.pollPool.getTotalPoolsCount();
      const activePools = await this.pollPool.getActivePoolsCount();
      
      // Obtener pools por estado
      const openPools = await this.pollPool.getPoolsByStatus(0); // Open
      const closedPools = await this.pollPool.getPoolsByStatus(1); // Closed
      const validatedPools = await this.pollPool.getPoolsByStatus(2); // Validated
      
      return {
        total: totalPools.toString(),
        active: activePools.toString(),
        open: openPools.length.toString(),
        closed: closedPools.length.toString(),
        validated: validatedPools.length.toString(),
        percentage: {
          active: totalPools > 0 ? ((activePools * 100) / totalPools).toFixed(1) : "0",
          closed: totalPools > 0 ? ((closedPools.length * 100) / totalPools).toFixed(1) : "0",
          validated: totalPools > 0 ? ((validatedPools.length * 100) / totalPools).toFixed(1) : "0"
        }
      };
    } catch (error) {
      console.error("❌ Error obteniendo estadísticas:", error);
      throw error;
    }
  }

  // 🕒 Formatear tiempo restante de manera legible
  formatTimeRemaining(secondsRemaining) {
    const seconds = parseInt(secondsRemaining);
    
    if (seconds <= 0) {
      return "Expirado";
    }
    
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

  // 🎨 Formatear pool para mostrar en UI
  formatPoolForDisplay(pool) {
    return {
      ...pool,
      timeRemainingFormatted: this.formatTimeRemaining(pool.secondsRemaining),
      totalAmountFormatted: `${pool.totalAmount} AVAX`,
      betAmountFormatted: `${pool.fixedBetAmount} AVAX`,
      participantsFormatted: `${pool.currentParticipants}/${pool.maxParticipants}`,
      statusBadge: pool.canJoin ? "Disponible" : pool.joinReason,
      urgencyLevel: this.getUrgencyLevel(pool.secondsRemaining)
    };
  }

  // ⚡ Determinar nivel de urgencia basado en tiempo restante
  getUrgencyLevel(secondsRemaining) {
    const seconds = parseInt(secondsRemaining);
    const hours = seconds / 3600;
    
    if (hours <= 1) return "critical"; // Menos de 1 hora
    if (hours <= 6) return "high";     // Menos de 6 horas
    if (hours <= 24) return "medium";  // Menos de 1 día
    return "low";                      // Más de 1 día
  }
}

// 🚀 Ejemplo de uso
export async function exampleUsage(pollPoolContract) {
  const pollListing = new PollListing(pollPoolContract);
  
  try {
    // Obtener todos los pools activos
    console.log("=== POOLS ACTIVOS ===");
    const activePools = await pollListing.getActivePools();
    
    activePools.forEach((pool, index) => {
      const formatted = pollListing.formatPoolForDisplay(pool);
      console.log(`\n📊 Pool ${pool.id}:`);
      console.log(`   Pregunta: ${pool.question}`);
      console.log(`   Tiempo restante: ${formatted.timeRemainingFormatted}`);
      console.log(`   Apuesta: ${formatted.betAmountFormatted}`);
      console.log(`   Participantes: ${formatted.participantsFormatted}`);
      console.log(`   Estado: ${formatted.statusBadge}`);
      console.log(`   Urgencia: ${formatted.urgencyLevel}`);
    });
    
    // Obtener estadísticas
    console.log("\n=== ESTADÍSTICAS ===");
    const stats = await pollListing.getPoolStatistics();
    console.log(`Total pools: ${stats.total}`);
    console.log(`Activos: ${stats.active} (${stats.percentage.active}%)`);
    console.log(`Cerrados: ${stats.closed} (${stats.percentage.closed}%)`);
    console.log(`Validados: ${stats.validated} (${stats.percentage.validated}%)`);
    
    // Ejemplo de filtros
    console.log("\n=== POOLS DISPONIBLES PARA UNIRSE ===");
    const availablePools = await pollListing.getFilteredActivePools({
      canJoinOnly: true,
      minHoursRemaining: 1 // Al menos 1 hora restante
    });
    
    console.log(`${availablePools.length} pools disponibles para unirse`);
    
  } catch (error) {
    console.error("❌ Error en ejemplo:", error);
  }
}

export default PollListing;