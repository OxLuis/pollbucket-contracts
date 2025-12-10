// ⛓️ Utilidades para conexión blockchain
const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');

// Cargar ABIs
const abiPath = path.join(__dirname, '..', '..', '..', 'frontend-integration', 'abis');

function loadABI(contractName) {
  const filePath = path.join(abiPath, `${contractName}.json`);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data.abi || data;
  }
  throw new Error(`ABI no encontrado: ${contractName}`);
}

// Obtener provider según la red configurada
function getProvider() {
  const network = process.env.BLOCKCHAIN_NETWORK || 'hardhat';
  
  const rpcUrls = {
    hardhat: process.env.HARDHAT_RPC_URL || 'http://127.0.0.1:8545',
    fuji: process.env.FUJI_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
    avalanche: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc'
  };
  
  const rpcUrl = rpcUrls[network];
  if (!rpcUrl) {
    throw new Error(`Red no soportada: ${network}`);
  }
  
  return new ethers.JsonRpcProvider(rpcUrl);
}

// Obtener instancia de contrato
function getContract(contractName, address) {
  const provider = getProvider();
  const abi = loadABI(contractName);
  return new ethers.Contract(address, abi, provider);
}

// Convertir wei a formato legible
function formatWei(wei) {
  return ethers.formatEther(wei);
}

// Convertir a wei
function parseEther(amount) {
  return ethers.parseEther(amount.toString());
}

// Mapear categoría del contrato a enum de la base de datos
function mapCategory(categoryIndex) {
  const categories = [
    'GENERAL', 'SPORTS', 'CRYPTO', 'POLITICS', 
    'ENTERTAINMENT', 'TECHNOLOGY', 'GAMING', 'FINANCE', 'OTHER'
  ];
  return categories[categoryIndex] || 'GENERAL';
}

// Mapear status del contrato a enum de la base de datos
function mapPoolStatus(statusIndex) {
  const statuses = ['OPEN', 'CLOSED', 'VALIDATED', 'CANCELLED'];
  return statuses[statusIndex] || 'OPEN';
}

module.exports = {
  getProvider,
  getContract,
  loadABI,
  formatWei,
  parseEther,
  mapCategory,
  mapPoolStatus
};

