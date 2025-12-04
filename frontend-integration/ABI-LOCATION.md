# 📋 Ubicación de los ABIs de los Contratos

Esta guía explica dónde encontrar los ABIs de los contratos desplegados y cómo usarlos en el frontend.

## 📁 Ubicación de los ABIs

Los ABIs se generan automáticamente cuando compilas los contratos con Hardhat y se encuentran en:

```
artifacts/contracts/
├── PollPool.sol/
│   └── PollPool.json          ← ABI completo aquí
├── ReputationSystem.sol/
│   └── ReputationSystem.json  ← ABI completo aquí
├── JurySystem.sol/
│   └── JurySystem.json        ← ABI completo aquí
├── PlatformGovernance.sol/
│   └── PlatformGovernance.json ← ABI completo aquí
└── SimplePollPool.sol/
    └── SimplePollPool.json    ← ABI completo aquí
```

## 📄 Estructura del Archivo JSON

Cada archivo JSON contiene:

```json
{
  "_format": "hh-sol-artifact-1",
  "contractName": "PollPool",
  "sourceName": "contracts/PollPool.sol",
  "abi": [
    // ... ABI completo aquí
  ],
  "bytecode": "0x...",
  "deployedBytecode": "0x...",
  // ... más metadatos
}
```

**El campo `abi` es lo que necesitas para el frontend.**

## 🔧 Cómo Usar los ABIs en el Frontend

### Opción 1: Importar directamente desde artifacts (Node.js/React con bundler)

```javascript
// En un proyecto Node.js con bundler (Webpack, Vite, etc.)
import PollPoolABI from '../artifacts/contracts/PollPool.sol/PollPool.json';
import ReputationSystemABI from '../artifacts/contracts/ReputationSystem.sol/ReputationSystem.json';

const pollPool = new ethers.Contract(
  contractAddress,
  PollPoolABI.abi, // Usar el campo .abi
  signer
);
```

### Opción 2: Copiar solo el ABI a un archivo separado

Crea archivos de ABIs en tu carpeta frontend:

```javascript
// frontend/src/abis/PollPool.json
// Copia solo el array del campo "abi" del archivo artifacts

// frontend/src/abis/ReputationSystem.json
// Copia solo el array del campo "abi"
```

Luego importa:

```javascript
import PollPoolABI from './abis/PollPool.json';
import ReputationSystemABI from './abis/ReputationSystem.json';
```

### Opción 3: Actualizar contract-config.js

Actualiza el archivo `frontend-integration/contract-config.js`:

```javascript
// Importar ABIs desde artifacts
import PollPoolArtifact from '../../artifacts/contracts/PollPool.sol/PollPool.json';
import ReputationSystemArtifact from '../../artifacts/contracts/ReputationSystem.sol/ReputationSystem.json';
import JurySystemArtifact from '../../artifacts/contracts/JurySystem.sol/JurySystem.json';
import PlatformGovernanceArtifact from '../../artifacts/contracts/PlatformGovernance.sol/PlatformGovernance.json';

export const ABIS = {
  POLL_POOL: PollPoolArtifact.abi,
  REPUTATION_SYSTEM: ReputationSystemArtifact.abi,
  JURY_SYSTEM: JurySystemArtifact.abi,
  PLATFORM_GOVERNANCE: PlatformGovernanceArtifact.abi
};
```

## 📝 Script para Extraer ABIs

Puedes crear un script para copiar los ABIs a tu proyecto frontend:

```javascript
// scripts/copy-abis.js
const fs = require('fs');
const path = require('path');

const contracts = [
  'PollPool',
  'ReputationSystem',
  'JurySystem',
  'PlatformGovernance'
];

const sourceDir = path.join(__dirname, '../artifacts/contracts');
const targetDir = path.join(__dirname, '../frontend/src/abis');

// Crear directorio si no existe
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

contracts.forEach(contractName => {
  const sourceFile = path.join(sourceDir, `${contractName}.sol`, `${contractName}.json`);
  const targetFile = path.join(targetDir, `${contractName}.json`);
  
  if (fs.existsSync(sourceFile)) {
    const artifact = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
    // Guardar solo el ABI
    fs.writeFileSync(
      targetFile,
      JSON.stringify(artifact.abi, null, 2)
    );
    console.log(`✅ Copiado ABI de ${contractName}`);
  } else {
    console.warn(`⚠️ No se encontró ${sourceFile}`);
  }
});
```

Ejecutar con:
```bash
node scripts/copy-abis.js
```

## 🎯 Ejemplo Completo de Uso

```javascript
import { ethers } from 'ethers';
import PollPoolABI from './abis/PollPool.json';
import { CONTRACTS } from './contract-config.js';

// Conectar wallet
const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// Crear instancia del contrato
const pollPool = new ethers.Contract(
  CONTRACTS.POLL_POOL,
  PollPoolABI, // ABI completo
  signer
);

// Usar el contrato
const pool = await pollPool.getPool(0);
console.log('Pool:', pool);
```

## 📊 Archivos de Deployment vs ABIs

### `deployments/` - Solo Direcciones
Los archivos en `deployments/` contienen:
- ✅ Direcciones de los contratos
- ✅ Hashes de transacciones
- ✅ Información de red
- ❌ **NO contienen ABIs**

### `artifacts/` - ABIs Completos
Los archivos en `artifacts/` contienen:
- ✅ ABIs completos
- ✅ Bytecode
- ✅ Metadatos de compilación
- ❌ **NO contienen direcciones de deployment**

**Necesitas ambos:**
- Direcciones desde `deployments/[network]-modular-deployment.json`
- ABIs desde `artifacts/contracts/[Contract].sol/[Contract].json`

## 🔄 Actualizar ABIs Después de Cambios

Si modificas los contratos:

1. **Recompilar:**
   ```bash
   npx hardhat compile
   ```

2. **Los ABIs se actualizan automáticamente** en `artifacts/`

3. **Copiar a tu frontend** (si usas la Opción 2):
   ```bash
   node scripts/copy-abis.js
   ```

## 📚 Estructura Recomendada para Frontend

```
frontend/
├── src/
│   ├── abis/
│   │   ├── PollPool.json           ← Solo el array ABI
│   │   ├── ReputationSystem.json
│   │   ├── JurySystem.json
│   │   └── PlatformGovernance.json
│   ├── config/
│   │   └── contracts.js            ← Direcciones de contratos
│   └── utils/
│       └── web3.js                 ← Instancias de contratos
```

## ⚠️ Notas Importantes

1. **Los ABIs son específicos por contrato** - Cada contrato tiene su propio ABI
2. **Los ABIs cambian si cambias el contrato** - Siempre recompila después de cambios
3. **Los ABIs son públicos** - No contienen información sensible
4. **Usa el ABI correcto** - Asegúrate de usar el ABI del contrato correcto

## 🔗 Referencias

- [Documentación de Ethers.js - Contracts](https://docs.ethers.io/v5/api/contract/contract/)
- [Hardhat - Artifacts](https://hardhat.org/hardhat-runner/docs/advanced/artifacts)



