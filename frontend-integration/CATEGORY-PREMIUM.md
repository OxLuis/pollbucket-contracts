# 📋 Categorías y Pools Premium

Esta guía explica cómo usar las nuevas funcionalidades de categorías y pools premium.

## 🏷️ Categorías Disponibles

```solidity
enum Category {
    General,        // 0 - General/Sin categoría
    Sports,         // 1 - Deportes
    Crypto,         // 2 - Criptomonedas
    Politics,       // 3 - Política
    Entertainment,  // 4 - Entretenimiento
    Technology,     // 5 - Tecnología
    Gaming,         // 6 - Juegos/eSports
    Finance,        // 7 - Finanzas
    Other           // 8 - Otros
}
```

## ⭐ Pools Premium

Los pools premium tienen las siguientes características:
- ✅ Pueden tener una imagen asociada
- ✅ Aparecen destacados en la plataforma
- 💰 Requieren un fee adicional (configurable, por defecto 0.01 AVAX)

### Reglas:
1. **Si `isPremium = true`**: puede o no tener `imageURI`
2. **Si tiene `imageURI`**: debe ser `isPremium = true`
3. La imagen es **opcional** para pools premium

## 📝 Estructura CreatePoolParams

```javascript
const createPoolParams = {
  question: "¿Quién ganará el mundial?",      // string - Pregunta
  options: ["Argentina", "Brasil", "Francia"], // string[] - Opciones
  closeTime: 1735689600,                       // uint256 - Timestamp Unix
  maxParticipants: 100,                        // uint256 - 0 = sin límite
  fixedBetAmount: "50000000000000000",        // uint256 - En wei (0.05 AVAX)
  category: 1,                                 // uint8 - 0-8 (ver enum arriba)
  isPremium: true,                            // bool - Si es premium
  imageURI: "https://ejemplo.com/img.png"    // string - URL de imagen (o vacío)
};
```

## 🔧 Flujo Recomendado para Subir Imagen

```
┌─────────────────┐
│  Usuario sube   │
│  imagen en UI   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Frontend envía │
│  imagen al      │
│  backend/IPFS   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Backend guarda │
│  imagen y       │
│  devuelve URL   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Frontend llama │
│  createPool()   │
│  con la URL     │
└─────────────────┘
```

## 🎯 Ejemplo JavaScript/Frontend

### 1. Crear pool básico (sin premium)

```javascript
import { ethers } from 'ethers';

async function createBasicPool(pollPool, signer) {
  const fixedBetAmount = ethers.parseEther("0.05");
  
  // Calcular monto total
  const [totalRequired] = await pollPool.calculateCreatePoolAmount(fixedBetAmount, false);
  
  const params = {
    question: "¿Subirá Bitcoin esta semana?",
    options: ["Sí", "No"],
    closeTime: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 horas
    maxParticipants: 0, // Sin límite
    fixedBetAmount: fixedBetAmount,
    category: 2, // Crypto
    isPremium: false,
    imageURI: ""
  };
  
  const tx = await pollPool.createPool(params, { value: totalRequired });
  return await tx.wait();
}
```

### 2. Crear pool premium sin imagen

```javascript
async function createPremiumPoolNoImage(pollPool) {
  const fixedBetAmount = ethers.parseEther("0.1");
  
  // Calcular monto total (incluye premium fee)
  const [totalRequired, txFee, premiumFee] = await pollPool.calculateCreatePoolAmount(fixedBetAmount, true);
  
  console.log(`Monto fijo: ${ethers.formatEther(fixedBetAmount)} AVAX`);
  console.log(`Comisión tx: ${ethers.formatEther(txFee)} AVAX`);
  console.log(`Fee premium: ${ethers.formatEther(premiumFee)} AVAX`);
  console.log(`Total: ${ethers.formatEther(totalRequired)} AVAX`);
  
  const params = {
    question: "¿Quién ganará la Champions League?",
    options: ["Real Madrid", "Barcelona", "Bayern", "Manchester City"],
    closeTime: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 días
    maxParticipants: 1000,
    fixedBetAmount: fixedBetAmount,
    category: 1, // Sports
    isPremium: true, // ⭐ Premium
    imageURI: "" // Sin imagen por ahora
  };
  
  const tx = await pollPool.createPool(params, { value: totalRequired });
  return await tx.wait();
}
```

### 3. Crear pool premium CON imagen

```javascript
async function createPremiumPoolWithImage(pollPool, imageFile) {
  // PASO 1: Subir imagen al backend/IPFS
  const imageURI = await uploadImageToBackend(imageFile);
  // imageURI puede ser: "https://tubackend.com/images/poll123.jpg"
  // o IPFS: "ipfs://QmXxx..."
  
  const fixedBetAmount = ethers.parseEther("0.1");
  const [totalRequired] = await pollPool.calculateCreatePoolAmount(fixedBetAmount, true);
  
  const params = {
    question: "¿Quién será el MVP de la NBA?",
    options: ["LeBron", "Curry", "Giannis", "Dončić"],
    closeTime: Math.floor(Date.now() / 1000) + (60 * 24 * 60 * 60), // 60 días
    maxParticipants: 0,
    fixedBetAmount: fixedBetAmount,
    category: 1, // Sports
    isPremium: true,
    imageURI: imageURI // ✅ URL de la imagen
  };
  
  const tx = await pollPool.createPool(params, { value: totalRequired });
  return await tx.wait();
}

// Función para subir imagen (implementar según tu backend)
async function uploadImageToBackend(imageFile) {
  const formData = new FormData();
  formData.append('image', imageFile);
  
  const response = await fetch('https://tu-backend.com/api/upload-image', {
    method: 'POST',
    body: formData
  });
  
  const data = await response.json();
  return data.imageUrl; // URL donde se guardó la imagen
}
```

## 🔍 Obtener Pools por Categoría/Premium

```javascript
// Obtener pools de una categoría
const cryptoPools = await pollPool.getPoolsByCategory(2); // Crypto

// Obtener todos los pools premium
const premiumPools = await pollPool.getPremiumPools();

// Obtener info de categoría y premium de un pool
const [category, isPremium, imageURI] = await pollPool.getPoolCategoryInfo(poolId);

// Contar pools por categoría
const sportPoolsCount = await pollPool.getPoolCountByCategory(1); // Sports

// Total de pools premium
const totalPremium = await pollPool.getPremiumPoolsCount();

// Obtener nombres de categorías (útil para UI)
const categoryNames = await pollPool.getCategoryNames();
// ["General", "Sports", "Crypto", "Politics", "Entertainment", "Technology", "Gaming", "Finance", "Other"]
```

## 🖼️ Actualizar Imagen de Pool Premium

El creador del pool puede actualizar la imagen después de crearlo:

```javascript
// Solo el creador puede actualizar, y solo si el pool está abierto
async function updatePoolImage(pollPool, poolId, newImageURI) {
  const tx = await pollPool.updatePoolImage(poolId, newImageURI);
  await tx.wait();
  console.log("Imagen actualizada!");
}
```

## 💰 Fees

| Concepto | Monto | Quién lo paga |
|----------|-------|---------------|
| Comisión de transacción | 2% del monto fijo | Creador |
| Fee premium | 0.01 AVAX (configurable) | Creador (solo si isPremium) |

### Calcular monto total antes de crear:

```javascript
const [totalRequired, txFeeAmount, premiumFeeAmount] = await pollPool.calculateCreatePoolAmount(
  ethers.parseEther("0.05"), // fixedBetAmount
  true // isPremium
);

console.log(`Total a pagar: ${ethers.formatEther(totalRequired)} AVAX`);
console.log(`  - Monto fijo: 0.05 AVAX`);
console.log(`  - Comisión tx: ${ethers.formatEther(txFeeAmount)} AVAX`);
console.log(`  - Fee premium: ${ethers.formatEther(premiumFeeAmount)} AVAX`);
```

## 📊 Ejemplo Completo de Formulario React

```jsx
import { useState } from 'react';

function CreatePollForm({ pollPool }) {
  const [isPremium, setIsPremium] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [category, setCategory] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const categories = [
    "General", "Sports", "Crypto", "Politics", 
    "Entertainment", "Technology", "Gaming", "Finance", "Other"
  ];
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let imageURI = "";
      
      // Si es premium y tiene imagen, subirla primero
      if (isPremium && imageFile) {
        imageURI = await uploadImage(imageFile);
      }
      
      const fixedBetAmount = ethers.parseEther(e.target.betAmount.value);
      const [totalRequired] = await pollPool.calculateCreatePoolAmount(fixedBetAmount, isPremium);
      
      const params = {
        question: e.target.question.value,
        options: e.target.options.value.split('\n').filter(o => o.trim()),
        closeTime: Math.floor(new Date(e.target.closeTime.value).getTime() / 1000),
        maxParticipants: parseInt(e.target.maxParticipants.value) || 0,
        fixedBetAmount: fixedBetAmount,
        category: category,
        isPremium: isPremium,
        imageURI: imageURI
      };
      
      const tx = await pollPool.createPool(params, { value: totalRequired });
      await tx.wait();
      
      alert("Poll creado!");
    } catch (error) {
      console.error(error);
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Pregunta */}
      <input name="question" placeholder="Pregunta" required />
      
      {/* Opciones */}
      <textarea name="options" placeholder="Opciones (una por línea)" required />
      
      {/* Categoría */}
      <select value={category} onChange={(e) => setCategory(parseInt(e.target.value))}>
        {categories.map((cat, i) => (
          <option key={i} value={i}>{cat}</option>
        ))}
      </select>
      
      {/* Premium */}
      <label>
        <input 
          type="checkbox" 
          checked={isPremium} 
          onChange={(e) => setIsPremium(e.target.checked)} 
        />
        ⭐ Pool Premium
      </label>
      
      {/* Imagen (solo si es premium) */}
      {isPremium && (
        <div>
          <label>Imagen (opcional):</label>
          <input 
            type="file" 
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files[0])}
          />
        </div>
      )}
      
      {/* Otros campos */}
      <input name="betAmount" type="number" step="0.01" min="0.05" defaultValue="0.05" />
      <input name="closeTime" type="datetime-local" required />
      <input name="maxParticipants" type="number" min="0" defaultValue="0" />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Creando...' : 'Crear Poll'}
      </button>
    </form>
  );
}
```

## ⚠️ Validaciones del Contrato

El contrato valida:
1. ✅ Si tiene `imageURI` → debe ser `isPremium = true`
2. ✅ Si `isPremium = true` → la funcionalidad premium debe estar habilitada
3. ✅ El monto enviado debe incluir el fee premium si aplica

## 🔗 Funciones del Contrato Relacionadas

| Función | Descripción |
|---------|-------------|
| `createPool(CreatePoolParams)` | Crear pool con todos los parámetros |
| `getPoolsByCategory(category)` | Obtener pools por categoría |
| `getPremiumPools()` | Obtener todos los pools premium |
| `getPoolCategoryInfo(poolId)` | Obtener category, isPremium, imageURI |
| `getPoolCountByCategory(category)` | Contar pools en una categoría |
| `getPremiumPoolsCount()` | Total de pools premium |
| `updatePoolImage(poolId, newURI)` | Actualizar imagen (solo creador) |
| `calculateCreatePoolAmount(amount, isPremium)` | Calcular monto total a pagar |
| `getCategoryNames()` | Obtener nombres de categorías |
| `setPremiumFee(fee)` | Admin: cambiar fee premium |
| `setPremiumEnabled(enabled)` | Admin: habilitar/deshabilitar premium |

