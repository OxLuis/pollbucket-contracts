// 📝 Ejemplo de cómo usar los ABIs copiados en el frontend

// OPCIÓN 1: Importar desde la carpeta abis/ (recomendado)
import PollPoolABI from './abis/PollPool.json';
import ReputationSystemABI from './abis/ReputationSystem.json';
import JurySystemABI from './abis/JurySystem.json';
import PlatformGovernanceABI from './abis/PlatformGovernance.json';

// O importar desde contract-config si lo configuraste ahí
// import { ABIS, CONTRACTS } from './contract-config.js';

import { ethers } from 'ethers';
import { CONTRACTS } from './contract-config.js';

/**
 * Ejemplo: Inicializar contratos con ABIs copiados
 */
async function initializeContractsWithABIs() {
  // Conectar wallet
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  // Crear instancias de contratos usando los ABIs
  const pollPool = new ethers.Contract(
    CONTRACTS.POLL_POOL,
    PollPoolABI.abi, // Usar el campo .abi del JSON
    signer
  );
  
  const reputationSystem = new ethers.Contract(
    CONTRACTS.REPUTATION_SYSTEM,
    ReputationSystemABI.abi,
    signer
  );
  
  const jurySystem = new ethers.Contract(
    CONTRACTS.JURY_SYSTEM,
    JurySystemABI.abi,
    signer
  );
  
  const platformGovernance = new ethers.Contract(
    CONTRACTS.PLATFORM_GOVERNANCE,
    PlatformGovernanceABI.abi,
    signer
  );
  
  return {
    pollPool,
    reputationSystem,
    jurySystem,
    platformGovernance
  };
}

/**
 * Ejemplo: Usar en una clase (como PollBucketWeb3)
 */
class PollBucketWeb3WithABIs {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contracts = {};
  }
  
  async connectWallet() {
    if (!window.ethereum) {
      throw new Error('MetaMask no está instalado');
    }
    
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    this.provider = new ethers.BrowserProvider(window.ethereum);
    this.signer = await this.provider.getSigner();
    
    return await this.signer.getAddress();
  }
  
  async initializeContracts() {
    if (!this.signer) {
      throw new Error('Wallet no conectado');
    }
    
    // Usar los ABIs importados
    this.contracts = {
      pollPool: new ethers.Contract(
        CONTRACTS.POLL_POOL,
        PollPoolABI.abi,
        this.signer
      ),
      reputationSystem: new ethers.Contract(
        CONTRACTS.REPUTATION_SYSTEM,
        ReputationSystemABI.abi,
        this.signer
      ),
      jurySystem: new ethers.Contract(
        CONTRACTS.JURY_SYSTEM,
        JurySystemABI.abi,
        this.signer
      ),
      platformGovernance: new ethers.Contract(
        CONTRACTS.PLATFORM_GOVERNANCE,
        PlatformGovernanceABI.abi,
        this.signer
      )
    };
    
    console.log('✅ Contratos inicializados con ABIs completos');
  }
  
  // Ahora puedes usar todas las funciones del contrato
  async getPool(poolId) {
    return await this.contracts.pollPool.getPool(poolId);
  }
  
  async createPool(question, options, durationHours, maxParticipants, betAmountETH) {
    // ... implementación usando this.contracts.pollPool
  }
}

/**
 * Ejemplo: Actualizar web3-integration.js para usar ABIs completos
 */
// En lugar de definir ABIs manualmente:
/*
const pollPoolABI = [
  "function createPool(...)",
  "function placeBet(...)",
  // ... solo algunas funciones
];
*/

// Usa el ABI completo:
/*
import PollPoolABI from './abis/PollPool.json';

this.contracts.pollPool = new ethers.Contract(
  CONTRACTS.POLL_POOL,
  PollPoolABI.abi, // ABI completo con todas las funciones
  this.signer
);
*/

export {
  initializeContractsWithABIs,
  PollBucketWeb3WithABIs
};




