// 📋 Configuración de Contratos para Frontend
// Copia las direcciones desde tu deployment

export const CONTRACTS = {
  // Direcciones de los contratos deployados
  POLL_POOL: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  REPUTATION_SYSTEM: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  JURY_SYSTEM: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  PLATFORM_GOVERNANCE: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
};

// Configuración de redes
export const NETWORKS = {
  hardhat: {
    chainId: 31337,
    name: "Hardhat Local",
    rpcUrl: "http://127.0.0.1:8545",
    blockExplorer: null
  },
  fuji: {
    chainId: 43113,
    name: "Avalanche Fuji",
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    blockExplorer: "https://testnet.snowtrace.io"
  }
};

// ABIs - Opciones para importar:
// 
// OPCIÓN 1: Importar directamente desde artifacts (si tienes acceso)
// import PollPoolArtifact from '../../artifacts/contracts/PollPool.sol/PollPool.json';
// import ReputationSystemArtifact from '../../artifacts/contracts/ReputationSystem.sol/ReputationSystem.json';
// import JurySystemArtifact from '../../artifacts/contracts/JurySystem.sol/JurySystem.json';
// import PlatformGovernanceArtifact from '../../artifacts/contracts/PlatformGovernance.sol/PlatformGovernance.json';
//
// OPCIÓN 2: Importar desde carpeta abis/ (después de ejecutar: node scripts/copy-abis.js)
// import PollPoolABI from './abis/PollPool.json';
// import ReputationSystemABI from './abis/ReputationSystem.json';
// import JurySystemABI from './abis/JurySystem.json';
// import PlatformGovernanceABI from './abis/PlatformGovernance.json';

export const ABIS = {
  // Ejecuta: node scripts/copy-abis.js para copiar los ABIs a frontend-integration/abis/
  // Luego importa y usa así:
  // POLL_POOL: PollPoolABI.abi,
  // REPUTATION_SYSTEM: ReputationSystemABI.abi,
  // JURY_SYSTEM: JurySystemABI.abi,
  // PLATFORM_GOVERNANCE: PlatformGovernanceABI.abi
  
  // Por ahora vacío - descomenta y configura según tu preferencia arriba
  POLL_POOL: [],
  REPUTATION_SYSTEM: [],
  JURY_SYSTEM: [],
  PLATFORM_GOVERNANCE: []
};

// 📝 Ubicación de los ABIs:
// - Fuente: artifacts/contracts/[Contract].sol/[Contract].json
// - El campo "abi" dentro del JSON contiene el ABI completo
// - Ver ABI-LOCATION.md para más detalles