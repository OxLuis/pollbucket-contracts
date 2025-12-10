# 🚀 PollBucket Backend

Backend API para PollBucket - Sistema de sincronización blockchain y servicios REST.

## 📋 Características

- ✅ **Sincronización Blockchain**: Escucha eventos del contrato y guarda en base de datos
- ✅ **API REST**: Endpoints para pools, transacciones, usuarios y estadísticas
- ✅ **Upload de Imágenes**: Servicio para subir imágenes de pools premium
- ✅ **Base de Datos**: PostgreSQL con Prisma ORM
- ✅ **Logging**: Winston para logs estructurados
- ✅ **Seguridad**: Helmet, CORS, Rate Limiting

## 🛠️ Instalación

### 1. Instalar dependencias

```bash
cd backend
npm install
```

### 2. Configurar base de datos

Necesitas PostgreSQL. Puedes usar Docker:

```bash
docker run --name pollbucket-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=pollbucket -p 5432:5432 -d postgres
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus valores
```

### 4. Ejecutar migraciones

```bash
npm run db:generate
npm run db:push
```

### 5. Iniciar servidor

```bash
# Desarrollo (con hot reload)
npm run dev

# Producción
npm start
```

## 📁 Estructura del Proyecto

```
backend/
├── prisma/
│   └── schema.prisma        # Esquema de base de datos
├── src/
│   ├── index.js             # Servidor principal
│   ├── routes/
│   │   ├── pools.js         # API de pools
│   │   ├── transactions.js  # API de transacciones
│   │   ├── users.js         # API de usuarios
│   │   ├── upload.js        # API de upload de imágenes
│   │   └── stats.js         # API de estadísticas
│   ├── services/
│   │   └── blockchainSync.js # Sincronización blockchain
│   └── utils/
│       ├── blockchain.js    # Utilidades blockchain
│       ├── logger.js        # Configuración de logs
│       └── prisma.js        # Cliente Prisma
├── uploads/                 # Imágenes subidas
├── logs/                    # Archivos de log
├── package.json
└── .env.example
```

## 🔌 API Endpoints

### Health Check
```
GET /health
```

### Pools
```
GET  /api/pools                    # Listar pools (con filtros y paginación)
GET  /api/pools/active             # Pools activos
GET  /api/pools/premium            # Pools premium
GET  /api/pools/category/:category # Pools por categoría
GET  /api/pools/:id                # Obtener pool por ID
GET  /api/pools/:id/bets           # Apuestas de un pool
GET  /api/pools/user/:address      # Pools de un usuario
```

### Transacciones
```
GET  /api/transactions             # Listar transacciones
GET  /api/transactions/recent      # Transacciones recientes
GET  /api/transactions/:txHash     # Obtener por hash
GET  /api/transactions/user/:addr  # Transacciones de usuario
GET  /api/transactions/pool/:id    # Transacciones de pool
```

### Usuarios
```
GET  /api/users/:address           # Perfil de usuario
GET  /api/users/:address/pools     # Pools del usuario
GET  /api/users/:address/bets      # Apuestas del usuario
GET  /api/users/leaderboard/top    # Top usuarios
```

### Upload
```
POST /api/upload/image             # Subir imagen (multipart)
POST /api/upload/image/base64      # Subir imagen base64
GET  /api/upload/:filename         # Info de imagen
DELETE /api/upload/:filename       # Eliminar imagen
```

### Estadísticas
```
GET  /api/stats/overview           # Estadísticas generales
GET  /api/stats/pools              # Estadísticas de pools
GET  /api/stats/transactions       # Estadísticas de transacciones
GET  /api/stats/categories         # Estadísticas por categoría
GET  /api/stats/sync               # Estado de sincronización
GET  /api/stats/top-pools          # Pools más populares
```

## 📝 Ejemplos de Uso

### Listar pools activos
```bash
curl http://localhost:3001/api/pools/active
```

### Obtener pool con estadísticas
```bash
curl http://localhost:3001/api/pools/1
```

### Listar pools por categoría
```bash
curl http://localhost:3001/api/pools/category/crypto?status=OPEN
```

### Subir imagen para pool premium
```bash
curl -X POST http://localhost:3001/api/upload/image \
  -F "image=@./mi-imagen.jpg" \
  -F "address=0x123..." \
  -F "poolId=1"
```

### Filtrar pools
```bash
curl "http://localhost:3001/api/pools?status=OPEN&category=SPORTS&isPremium=true&page=1&limit=10"
```

## ⚙️ Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `DATABASE_URL` | URL de PostgreSQL | requerido |
| `PORT` | Puerto del servidor | 3001 |
| `BLOCKCHAIN_NETWORK` | Red blockchain | fuji |
| `POLL_POOL_ADDRESS` | Dirección del contrato PollPool | requerido |
| `FUJI_RPC_URL` | RPC de Fuji testnet | avax testnet |
| `SYNC_START_BLOCK` | Bloque inicial para sync | 0 |
| `UPLOAD_DIR` | Directorio de uploads | ./uploads |
| `MAX_FILE_SIZE` | Tamaño máximo de archivo | 5MB |
| `PUBLIC_URL` | URL pública del servidor | localhost |
| `CORS_ORIGINS` | Orígenes permitidos | localhost |

## 🔄 Sincronización Blockchain

El servicio de sincronización:

1. **Sincroniza eventos históricos** al iniciar
2. **Escucha eventos en tiempo real** del contrato
3. **Actualiza la base de datos** automáticamente

### Eventos sincronizados:
- `PoolCreated` - Nuevo pool creado
- `BetPlaced` - Nueva apuesta
- `PoolClosed` - Pool cerrado
- `PoolValidated` - Pool validado
- `PoolCancelled` - Pool cancelado
- `RewardsDistributed` - Recompensas distribuidas

## 🖼️ Servicio de Imágenes

Las imágenes se procesan con Sharp:
- Redimensionadas a 1200x630 (tamaño óptimo para preview)
- Convertidas a WebP (mejor compresión)
- Calidad: 80%

## 🔐 Seguridad

- **Helmet**: Headers de seguridad HTTP
- **CORS**: Configuración de orígenes permitidos
- **Rate Limiting**: 100 requests / 15 minutos por IP

## 📊 Base de Datos

### Modelos principales:

- **Pool**: Información de pools/encuestas
- **Bet**: Apuestas realizadas
- **Transaction**: Log de transacciones blockchain
- **User**: Caché de usuarios y estadísticas
- **UploadedImage**: Imágenes subidas
- **SyncState**: Estado de sincronización

### Ver base de datos:
```bash
npm run db:studio
```

## 🐳 Docker

```dockerfile
# Dockerfile (crear si necesitas)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 3001
CMD ["npm", "start"]
```

## 📝 Licencia

MIT

