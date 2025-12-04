# 📊 Estados de un Poll en PollBucket

Este documento explica los diferentes estados que puede tener un poll y cómo transicionan entre ellos.

## 🔄 Estados Disponibles

Hay **dos versiones** del contrato con estados ligeramente diferentes:

### 1. **PollPool.sol** (Contrato Principal con Sistema de Jurados)

```solidity
enum PoolStatus {
    Open,        // 0 - Abierto para apuestas
    Closed,       // 1 - Cerrado, esperando validación de jurados
    Validated,    // 2 - Validado por jurados, listo para distribuir recompensas
    Cancelled     // 3 - Cancelado (emergencia)
}
```

### 2. **SimplePollPool.sol** (Versión Simplificada sin Jurados)

```solidity
enum PoolStatus {
    Open,        // 0 - Abierto para apuestas
    Closed,       // 1 - Cerrado, esperando resolución
    Resolved,     // 2 - Resuelto por el creador, listo para distribuir recompensas
    Cancelled     // 3 - Cancelado (emergencia)
}
```

## 📈 Flujo de Estados

### **PollPool.sol** (Con Jurados)

```
┌─────────┐
│  Open   │ ← Estado inicial cuando se crea el poll
└────┬────┘
     │
     │ closePool() - Creador o tiempo vencido
     ▼
┌─────────┐
│ Closed  │ ← Pool cerrado, activa sistema de jurados
└────┬────┘
     │
     │ validatePool() - Llamado por JurySystem
     ▼
┌──────────┐
│Validated │ ← Resultado validado por jurados
└────┬─────┘
     │
     │ distributeRewards() - Distribuir recompensas
     ▼
  (Recompensas distribuidas)
```

### **SimplePollPool.sol** (Sin Jurados)

```
┌─────────┐
│  Open   │ ← Estado inicial cuando se crea el poll
└────┬────┘
     │
     │ closePool() - Creador o tiempo vencido
     ▼
┌─────────┐
│ Closed  │ ← Pool cerrado, esperando resolución
└────┬────┘
     │
     │ resolvePool() - Creador resuelve manualmente
     ▼
┌──────────┐
│ Resolved │ ← Resultado establecido por el creador
└────┬─────┘
     │
     │ distributeRewards() - Distribuir recompensas
     ▼
  (Recompensas distribuidas)
```

## 📝 Descripción Detallada de Cada Estado

### 🟢 **Open (0)** - Abierto

**Descripción:** El poll está activo y aceptando apuestas.

**Características:**
- ✅ Los usuarios pueden apostar (`placeBet()`)
- ✅ El tiempo de cierre (`closeTime`) aún no ha llegado
- ✅ No se ha alcanzado el máximo de participantes (si hay límite)

**Transiciones:**
- → `Closed`: Cuando se llama `closePool()` o el tiempo de cierre expira

**Validaciones:**
```javascript
// Verificar si un pool está abierto
const pool = await pollPool.getPool(poolId);
const isOpen = pool.status === 0; // PoolStatus.Open
const canBet = isOpen && block.timestamp < pool.closeTime;
```

---

### 🔴 **Closed (1)** - Cerrado

**Descripción:** El poll ya no acepta nuevas apuestas y está esperando validación/resolución.

**Características:**
- ❌ No se pueden hacer nuevas apuestas
- ⏳ Esperando validación de jurados (PollPool) o resolución del creador (SimplePollPool)
- 💰 Las apuestas están bloqueadas hasta la validación/resolución

**Transiciones:**
- → `Validated` (PollPool): Cuando los jurados validan el resultado
- → `Resolved` (SimplePollPool): Cuando el creador resuelve manualmente
- → `Cancelled`: En caso de emergencia (solo owner)

**Cómo se cierra:**
```javascript
// El creador puede cerrar manualmente
await pollPool.closePool(poolId);

// O se cierra automáticamente cuando expire closeTime
// (necesitas verificar en el frontend y llamar closePool)
```

---

### ✅ **Validated (2)** - Validado (Solo PollPool)

**Descripción:** El resultado ha sido validado por el sistema de jurados.

**Características:**
- ✅ El resultado es confiable (validado por múltiples jurados)
- 💰 Listo para distribuir recompensas
- 🎯 La opción ganadora (`winningOption`) está establecida

**Transiciones:**
- → Recompensas distribuidas: Cuando se llama `distributeRewards()`

**Quién valida:**
- Solo el contrato `JurySystem` puede llamar `validatePool()`
- Los jurados votan y el sistema determina el resultado

---

### ✅ **Resolved (2)** - Resuelto (Solo SimplePollPool)

**Descripción:** El creador ha establecido manualmente la opción ganadora.

**Características:**
- ✅ El resultado fue establecido por el creador
- 💰 Listo para distribuir recompensas
- 🎯 La opción ganadora (`winningOption`) está establecida

**Transiciones:**
- → Recompensas distribuidas: Cuando se llama `distributeRewards()`

**Quién resuelve:**
- Solo el creador del pool puede llamar `resolvePool()`

---

### ⛔ **Cancelled (3)** - Cancelado

**Descripción:** El poll ha sido cancelado por el creador o el owner del contrato.

**Características:**
- ❌ No se pueden hacer apuestas
- ❌ No se puede validar/resolver
- 📝 Incluye razón de cancelación en el evento

**Quién puede cancelar:**
1. **El creador del pool** - Puede cancelar su propio pool
2. **El owner del contrato** - Puede cancelar cualquier pool (ej: violación de políticas)

**Funciones de cancelación:**
- `cancelPool(poolId, "razón")` - Creador u owner con razón
- `emergencyPause(poolId)` - Solo owner, sin razón requerida

**Evento emitido:**
```solidity
event PoolCancelled(
    uint256 indexed poolId, 
    address indexed cancelledBy, 
    string reason,
    bool byOwner // true si fue cancelado por el owner
);
```

**Restricciones:**
- No se puede cancelar un pool ya cancelado
- No se puede cancelar un pool ya validado/resuelto

**Nota:** Este estado es irreversible.

---

## 🔍 Cómo Verificar el Estado en el Frontend

### Ejemplo con JavaScript/Ethers.js

```javascript
// Obtener información del pool
const pool = await pollPool.getPool(poolId);

// Verificar estado
const status = pool.status; // 0, 1, 2, o 3

// Mapear a nombres legibles
const statusNames = {
  0: 'Open',
  1: 'Closed',
  2: 'Validated', // o 'Resolved' en SimplePollPool
  3: 'Cancelled'
};

console.log(`Estado del pool: ${statusNames[status]}`);

// Verificar si está abierto
const isOpen = status === 0;
const canBet = isOpen && Date.now() / 1000 < pool.closeTime;

// Verificar si está listo para distribuir recompensas
const canDistribute = (status === 2) && !pool.rewardsDistributed;
```

### Ejemplo con React Hook

```jsx
import { useState, useEffect } from 'react';

function usePoolStatus(poolId) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const pool = await pollPool.getPool(poolId);
        setStatus({
          code: pool.status,
          name: ['Open', 'Closed', 'Validated', 'Cancelled'][pool.status],
          canBet: pool.status === 0 && Date.now() / 1000 < pool.closeTime,
          canDistribute: pool.status === 2 && !pool.rewardsDistributed,
          isExpired: Date.now() / 1000 >= pool.closeTime
        });
      } catch (error) {
        console.error('Error obteniendo estado:', error);
      } finally {
        setLoading(false);
      }
    }
    
    if (poolId) fetchStatus();
  }, [poolId]);

  return { status, loading };
}
```

## 📊 Tabla Comparativa

| Estado | PollPool | SimplePollPool | Puede Apostar | Puede Distribuir |
|--------|----------|----------------|---------------|------------------|
| **Open** | ✅ | ✅ | ✅ | ❌ |
| **Closed** | ✅ | ✅ | ❌ | ❌ |
| **Validated** | ✅ | ❌ | ❌ | ✅ |
| **Resolved** | ❌ | ✅ | ❌ | ✅ |
| **Cancelled** | ✅ | ✅ | ❌ | ❌ |

## 🎯 Casos de Uso por Estado

### Estado Open
- Mostrar formulario de apuesta
- Mostrar contador de tiempo restante
- Mostrar número de participantes actuales
- Permitir cerrar manualmente (si eres creador)

### Estado Closed
- Mostrar mensaje "Pool cerrado"
- Mostrar "Esperando validación/resolución"
- Deshabilitar botón de apuesta
- Mostrar apuestas realizadas

### Estado Validated/Resolved
- Mostrar opción ganadora
- Mostrar botón "Distribuir Recompensas" (si eres ganador o creador)
- Mostrar lista de ganadores
- Mostrar monto total a distribuir

### Estado Cancelled
- Mostrar mensaje de cancelación
- No permitir ninguna acción
- Mostrar información de reembolso (si aplica)

## 🔗 Funciones Relacionadas

```javascript
// Obtener pools por estado
const openPools = await pollPool.getPoolsByStatus(0); // Open
const closedPools = await pollPool.getPoolsByStatus(1); // Closed
const validatedPools = await pollPool.getPoolsByStatus(2); // Validated

// Verificar si un usuario puede apostar
const canBet = await pollPool.canJoinPool(poolId);

// Obtener información completa del pool
const poolInfo = await pollPool.getPoolInfo(poolId);
```

## ❌ Cancelar un Pool

### El creador cancela su propio pool:
```javascript
// El creador puede cancelar con una razón
const tx = await pollPool.cancelPool(
  poolId, 
  "Ya no quiero continuar con este poll"
);
await tx.wait();
```

### El owner cancela por violación de políticas:
```javascript
// El owner puede cancelar cualquier pool
const tx = await pollPool.cancelPool(
  poolId, 
  "Violación de políticas: contenido inapropiado"
);
await tx.wait();

// O usar emergencyPause sin razón específica
const tx2 = await pollPool.emergencyPause(poolId);
await tx2.wait();
```

### Escuchar evento de cancelación:
```javascript
pollPool.on("PoolCancelled", (poolId, cancelledBy, reason, byOwner) => {
  console.log(`Pool ${poolId} cancelado`);
  console.log(`Por: ${cancelledBy}`);
  console.log(`Razón: ${reason}`);
  console.log(`¿Por owner?: ${byOwner}`);
  
  if (byOwner) {
    // Mostrar alerta de que fue cancelado por la plataforma
    alert(`El pool fue cancelado por la plataforma: ${reason}`);
  }
});
```

### Verificar si se puede cancelar:
```javascript
async function canCancelPool(poolId, userAddress) {
  const pool = await pollPool.getPool(poolId);
  const ownerAddress = await pollPool.owner();
  
  const isCreator = pool.creator === userAddress;
  const isOwner = ownerAddress === userAddress;
  const isNotCancelled = pool.status !== 3; // Cancelled
  const isNotValidated = pool.status !== 2; // Validated
  
  return (isCreator || isOwner) && isNotCancelled && isNotValidated;
}
```

## ⚠️ Notas Importantes

1. **El estado es un número (0-3)**, no un string
2. **Los estados son mutuamente excluyentes** - un pool solo puede estar en un estado a la vez
3. **Las transiciones son unidireccionales** - no se puede volver a un estado anterior
4. **El estado `Cancelled` es irreversible**
5. **En SimplePollPool**, el estado 2 se llama `Resolved` en lugar de `Validated`

## 📚 Referencias

- [Contrato PollPool](../contracts/PollPool.sol)
- [Contrato SimplePollPool](../contracts/SimplePollPool.sol)
- [Interfaz IPollPool](../contracts/interfaces/IPollPool.sol)



