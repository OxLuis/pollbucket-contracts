// 📝 Ejemplo completo de cómo crear un poll desde el frontend
// Este archivo muestra cómo implementar la creación de polls en tu aplicación React/Vue/Vanilla JS

import PollBucketWeb3 from './web3-integration.js';
// O si usas require:
// const PollBucketWeb3 = require('./web3-integration.js');

/**
 * Ejemplo 1: Crear un poll básico
 */
async function ejemploCrearPollBasico() {
  try {
    // 1. Inicializar la instancia de PollBucketWeb3
    const pollBucket = new PollBucketWeb3();
    
    // 2. Conectar el wallet del usuario
    console.log('🔌 Conectando wallet...');
    await pollBucket.connectWallet();
    
    // 3. Inicializar los contratos (necesitas tener las direcciones configuradas)
    console.log('📋 Inicializando contratos...');
    await pollBucket.initializeContracts();
    
    // 4. Crear el poll
    console.log('📊 Creando poll...');
    const result = await pollBucket.createPool(
      "¿Cuál será el precio de AVAX al final del mes?", // Pregunta
      ["Menos de $20", "$20-$30", "$30-$40", "Más de $40"], // Opciones
      168, // Duración en horas (7 días)
      10, // Máximo de participantes (0 = sin límite)
      "0.05" // Monto fijo por apuesta en AVAX
    );
    
    console.log('✅ Poll creado exitosamente!');
    console.log('   Pool ID:', result.poolId);
    console.log('   Transaction Hash:', result.txHash);
    
    return result;
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

/**
 * Ejemplo 2: Crear un poll con validación de formulario
 */
async function ejemploCrearPollConValidacion(formData) {
  const pollBucket = new PollBucketWeb3();
  
  try {
    // Validaciones del lado del cliente
    if (!formData.question || formData.question.trim().length < 10) {
      throw new Error('La pregunta debe tener al menos 10 caracteres');
    }
    
    if (!formData.options || formData.options.length < 2) {
      throw new Error('Debe haber al menos 2 opciones');
    }
    
    if (formData.options.length > 10) {
      throw new Error('Máximo 10 opciones permitidas');
    }
    
    if (formData.durationHours < 1) {
      throw new Error('La duración mínima es 1 hora');
    }
    
    if (formData.durationHours > 720) {
      throw new Error('La duración máxima es 720 horas (30 días)');
    }
    
    if (parseFloat(formData.betAmount) < 0.05) {
      throw new Error('El monto mínimo es 0.05 AVAX');
    }
    
    // Conectar wallet
    await pollBucket.connectWallet();
    await pollBucket.initializeContracts();
    
    // Crear poll
    const result = await pollBucket.createPool(
      formData.question,
      formData.options,
      formData.durationHours,
      formData.maxParticipants || 0,
      formData.betAmount
    );
    
    return {
      success: true,
      poolId: result.poolId,
      txHash: result.txHash
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Ejemplo 3: Implementación con React Hook
 */
// Para usar en un componente React:
/*
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
    
    const formData = {
      question: e.target.question.value,
      options: e.target.options.value.split(',').map(opt => opt.trim()),
      durationHours: parseInt(e.target.durationHours.value),
      maxParticipants: parseInt(e.target.maxParticipants.value) || 0,
      betAmount: e.target.betAmount.value
    };
    
    try {
      await pollBucket.connectWallet();
      await pollBucket.initializeContracts();
      
      const result = await pollBucket.createPool(
        formData.question,
        formData.options,
        formData.durationHours,
        formData.maxParticipants,
        formData.betAmount
      );
      
      setSuccess(`Poll creado exitosamente! Pool ID: ${result.poolId}`);
      e.target.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Pregunta:</label>
        <input 
          type="text" 
          name="question" 
          required 
          minLength={10}
          placeholder="Ej: ¿Cuál será el precio de AVAX al final del mes?"
        />
      </div>
      
      <div>
        <label>Opciones (separadas por comas):</label>
        <input 
          type="text" 
          name="options" 
          required
          placeholder="Ej: Menos de $20, $20-$30, $30-$40, Más de $40"
        />
      </div>
      
      <div>
        <label>Duración (horas):</label>
        <input 
          type="number" 
          name="durationHours" 
          required 
          min={1} 
          max={720}
          defaultValue={168}
        />
      </div>
      
      <div>
        <label>Máximo de participantes (0 = sin límite):</label>
        <input 
          type="number" 
          name="maxParticipants" 
          min={0}
          defaultValue={0}
        />
      </div>
      
      <div>
        <label>Monto por apuesta (AVAX):</label>
        <input 
          type="number" 
          name="betAmount" 
          required 
          min={0.05} 
          step={0.01}
          defaultValue={0.05}
        />
      </div>
      
      <button type="submit" disabled={loading}>
        {loading ? 'Creando...' : 'Crear Poll'}
      </button>
      
      {error && <div style={{color: 'red'}}>{error}</div>}
      {success && <div style={{color: 'green'}}>{success}</div>}
    </form>
  );
}
*/

/**
 * Ejemplo 4: Implementación con manejo de estados y UI moderna
 */
async function ejemploCrearPollConUI() {
  const pollBucket = new PollBucketWeb3();
  
  // Estado de la UI
  const uiState = {
    step: 'idle', // 'idle' | 'connecting' | 'creating' | 'success' | 'error'
    message: '',
    poolId: null,
    txHash: null
  };
  
  try {
    // Paso 1: Conectar wallet
    uiState.step = 'connecting';
    uiState.message = 'Conectando wallet...';
    // Actualizar UI aquí
    
    await pollBucket.connectWallet();
    
    // Paso 2: Inicializar contratos
    uiState.message = 'Inicializando contratos...';
    // Actualizar UI aquí
    
    await pollBucket.initializeContracts();
    
    // Paso 3: Crear poll
    uiState.step = 'creating';
    uiState.message = 'Creando poll...';
    // Actualizar UI aquí
    
    const result = await pollBucket.createPool(
      "¿Subirá Bitcoin esta semana?",
      ["Sí, subirá más de 5%", "Se mantendrá estable", "No, bajará más de 5%"],
      24, // 24 horas
      0, // Sin límite de participantes
      "0.05" // 0.05 AVAX
    );
    
    // Paso 4: Éxito
    uiState.step = 'success';
    uiState.message = `Poll creado exitosamente!`;
    uiState.poolId = result.poolId;
    uiState.txHash = result.txHash;
    // Actualizar UI aquí
    
    return uiState;
    
  } catch (error) {
    uiState.step = 'error';
    uiState.message = `Error: ${error.message}`;
    // Actualizar UI aquí
    
    return uiState;
  }
}

/**
 * Ejemplo 5: Obtener información antes de crear el poll
 */
async function ejemploObtenerInfoAntesDeCrear() {
  const pollBucket = new PollBucketWeb3();
  
  try {
    await pollBucket.connectWallet();
    await pollBucket.initializeContracts();
    
    // Obtener monto mínimo requerido
    const minimumFixedBetAmount = await pollBucket.contracts.pollPool.minimumFixedBetAmount();
    console.log(`💰 Monto mínimo: ${ethers.formatEther(minimumFixedBetAmount)} AVAX`);
    
    // Obtener comisión de transacción
    const transactionFee = await pollBucket.contracts.pollPool.transactionFee();
    console.log(`💳 Comisión de transacción: ${Number(transactionFee) / 100}%`);
    
    // Calcular monto total para un poll con apuesta de 0.1 AVAX
    const betAmount = ethers.parseEther("0.1");
    const feeAmount = (betAmount * transactionFee) / 10000n;
    const totalRequired = betAmount + feeAmount;
    
    console.log(`📊 Para crear un poll con apuesta de 0.1 AVAX:`);
    console.log(`   Monto fijo: ${ethers.formatEther(betAmount)} AVAX`);
    console.log(`   Comisión: ${ethers.formatEther(feeAmount)} AVAX`);
    console.log(`   Total requerido: ${ethers.formatEther(totalRequired)} AVAX`);
    
    // Verificar balance
    const balance = await pollBucket.provider.getBalance(await pollBucket.signer.getAddress());
    console.log(`💼 Balance disponible: ${ethers.formatEther(balance)} AVAX`);
    
    if (balance < totalRequired) {
      console.warn(`⚠️ Balance insuficiente. Necesitas ${ethers.formatEther(totalRequired)} AVAX`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Exportar ejemplos
export {
  ejemploCrearPollBasico,
  ejemploCrearPollConValidacion,
  ejemploCrearPollConUI,
  ejemploObtenerInfoAntesDeCrear
};

// Ejemplo de uso directo:
/*
(async () => {
  try {
    const result = await ejemploCrearPollBasico();
    console.log('Poll creado:', result);
  } catch (error) {
    console.error('Error:', error);
  }
})();
*/



