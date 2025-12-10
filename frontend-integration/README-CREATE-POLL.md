# 📝 Guía: Cómo Crear un Poll desde el Frontend

Esta guía te muestra cómo implementar la funcionalidad de crear polls en tu aplicación frontend.

## 📋 Requisitos Previos

1. **MetaMask instalado** en el navegador del usuario
2. **Contratos desplegados** y sus direcciones
3. **Ethers.js** instalado (`npm install ethers` o usar CDN)

## 🔧 Configuración Básica

### 1. Importar la clase PollBucketWeb3

```javascript
import PollBucketWeb3 from './web3-integration.js';
```

### 2. Configurar las direcciones de los contratos

Asegúrate de tener configurado el archivo `contract-config.js` con las direcciones correctas:

```javascript
export const CONTRACTS = {
  POLL_POOL: '0x...', // Dirección del contrato PollPool
  REPUTATION_SYSTEM: '0x...',
  // ...
};
```

## 🚀 Ejemplo Básico

```javascript
const pollBucket = new PollBucketWeb3();

// 1. Conectar wallet
await pollBucket.connectWallet();

// 2. Inicializar contratos
await pollBucket.initializeContracts();

// 3. Crear poll
const result = await pollBucket.createPool(
  "¿Cuál será el precio de AVAX al final del mes?", // Pregunta
  ["Menos de $20", "$20-$30", "$30-$40", "Más de $40"], // Opciones
  168, // Duración en horas (7 días)
  10, // Máximo de participantes (0 = sin límite)
  "0.05" // Monto fijo por apuesta en AVAX
);

console.log('Pool creado:', result.poolId);
console.log('TX Hash:', result.txHash);
```

## 📊 Parámetros de createPool()

| Parámetro | Tipo | Descripción | Requisitos |
|-----------|------|-------------|------------|
| `question` | `string` | Texto de la pregunta | Mínimo 10 caracteres |
| `options` | `string[]` | Array de opciones de respuesta | Mínimo 2 opciones |
| `durationHours` | `number` | Duración del poll en horas | Entre 1 y 720 horas |
| `maxParticipants` | `number` | Máximo de participantes | 0 = sin límite, o mínimo 2 |
| `betAmountETH` | `string` | Monto fijo por apuesta en AVAX | Mínimo 0.05 AVAX |

## 💰 Cálculo de Comisiones

El contrato cobra una **comisión de transacción del 2%** sobre el monto fijo. El método `createPool()` calcula automáticamente el total a pagar:

```
Monto fijo: 0.05 AVAX
Comisión (2%): 0.001 AVAX
Total a pagar: 0.051 AVAX
```

## ✅ Validaciones Automáticas

El método `createPool()` realiza las siguientes validaciones automáticamente:

- ✅ Verifica que la pregunta tenga al menos 10 caracteres
- ✅ Verifica que haya al menos 2 opciones
- ✅ Verifica que el monto sea >= 0.05 AVAX (mínimo configurado)
- ✅ Verifica que el tiempo de cierre sea futuro
- ✅ Verifica que el balance del usuario sea suficiente
- ✅ Calcula y envía el monto correcto (monto fijo + comisión)

## 🎨 Ejemplo con React

```jsx
import { useState } from 'react';
import PollBucketWeb3 from './web3-integration.js';

function CreatePollForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  
  const pollBucket = new PollBucketWeb3();
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await pollBucket.connectWallet();
      await pollBucket.initializeContracts();
      
      const result = await pollBucket.createPool(
        e.target.question.value,
        e.target.options.value.split(',').map(opt => opt.trim()),
        parseInt(e.target.durationHours.value),
        parseInt(e.target.maxParticipants.value) || 0,
        e.target.betAmount.value
      );
      
      setSuccess(`Poll creado! ID: ${result.poolId}`);
      e.target.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input name="question" placeholder="Pregunta" required />
      <input name="options" placeholder="Opciones (separadas por comas)" required />
      <input name="durationHours" type="number" defaultValue={168} required />
      <input name="maxParticipants" type="number" defaultValue={0} />
      <input name="betAmount" type="number" step="0.01" min="0.05" defaultValue="0.05" required />
      <button type="submit" disabled={loading}>
        {loading ? 'Creando...' : 'Crear Poll'}
      </button>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
    </form>
  );
}
```

## 🔍 Obtener Información Antes de Crear

Puedes obtener información útil antes de crear el poll:

```javascript
// Obtener monto mínimo
const minimumFixedBetAmount = await pollBucket.contracts.pollPool.minimumFixedBetAmount();
console.log(`Monto mínimo: ${ethers.formatEther(minimumFixedBetAmount)} AVAX`);

// Obtener comisión de transacción
const transactionFee = await pollBucket.contracts.pollPool.transactionFee();
console.log(`Comisión: ${Number(transactionFee) / 100}%`);

// Verificar balance
const balance = await pollBucket.provider.getBalance(await pollBucket.signer.getAddress());
console.log(`Balance: ${ethers.formatEther(balance)} AVAX`);
```

## 📝 Manejo de Errores

El método `createPool()` puede lanzar los siguientes errores:

- `"MetaMask no está instalado"` - El usuario no tiene MetaMask
- `"Wallet no conectado"` - No se ha conectado el wallet
- `"La pregunta no puede estar vacía"` - Validación de pregunta
- `"Debe haber al menos 2 opciones"` - Validación de opciones
- `"El monto mínimo es X AVAX"` - Monto insuficiente
- `"Balance insuficiente"` - El usuario no tiene suficiente AVAX
- `"Debe pagar el monto fijo + comision de transaccion"` - Error del contrato (ya manejado automáticamente)

## 🎯 Ejemplo Completo con UI

Ver el archivo `example-html.html` para un ejemplo completo con interfaz HTML/CSS/JS lista para usar.

## 📚 Archivos de Ejemplo

- `example-create-poll.js` - Ejemplos de código JavaScript
- `example-html.html` - Ejemplo completo con HTML/CSS/JS
- `web3-integration.js` - Clase principal de integración (actualizada)

## ⚠️ Notas Importantes

1. **Siempre valida los datos** antes de enviar la transacción
2. **Muestra el monto total** (monto fijo + comisión) al usuario antes de confirmar
3. **Maneja los errores** de manera amigable para el usuario
4. **Verifica el balance** antes de permitir crear el poll
5. **Usa estados de carga** para mejorar la UX durante la transacción

## 🔗 Recursos Adicionales

- [Documentación de Ethers.js](https://docs.ethers.io/)
- [MetaMask Documentation](https://docs.metamask.io/)
- [Contrato PollPool](../contracts/PollPool.sol)




