# 🔗 Configuración de Red Hardhat para Frontend

## 📱 Agregar Red Hardhat a MetaMask

### Configuración Manual:
1. Abre MetaMask
2. Click en el dropdown de redes (arriba)
3. Selecciona "Add Network" o "Agregar Red"
4. Selecciona "Add a network manually"

### Datos de la Red Hardhat:
```
Network Name: Hardhat Local
RPC URL: http://127.0.0.1:8545
Chain ID: 31337
Currency Symbol: ETH
Block Explorer URL: (dejar vacío)
```

## 🔑 Importar Cuentas de Prueba

### Cuentas Hardhat Predeterminadas:
```javascript
// Account #0 (Deployer)
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

// Account #1 (User1)  
Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
Address: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

// Account #2 (User2)
Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
Address: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
```

### Importar en MetaMask:
1. Click en el icono de cuenta (arriba derecha)
2. Selecciona "Import Account"
3. Pega la private key
4. Click "Import"

## ⚠️ Importante:
- Estas cuentas son SOLO para desarrollo local
- NUNCA uses estas private keys en mainnet
- Cada vez que reinicies Hardhat, los balances se resetean