// 🚀 PollBucket Backend - Servidor Principal
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const logger = require('./utils/logger');
const { prisma } = require('./utils/prisma');

// Importar rutas
const poolRoutes = require('./routes/pools');
const transactionRoutes = require('./routes/transactions');
const userRoutes = require('./routes/users');
const uploadRoutes = require('./routes/upload');
const statsRoutes = require('./routes/stats');
const syncRoutes = require('./routes/sync');

// Importar servicio de sincronización
const BlockchainSync = require('./services/blockchainSync');

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== MIDDLEWARE ====================

// Seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // Permitir imágenes cross-origin
}));

// CORS
const corsOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Demasiadas peticiones, intenta de nuevo más tarde' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Servir archivos estáticos (imágenes)
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.join(__dirname, '..', uploadDir)));

// ==================== RUTAS ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    network: process.env.BLOCKCHAIN_NETWORK || 'unknown'
  });
});

// API Routes
app.use('/api/pools', poolRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/sync', syncRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', err);
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ==================== INICIALIZACIÓN ====================

async function startServer() {
  try {
    // Verificar conexión a base de datos
    await prisma.$connect();
    logger.info('✅ Conectado a la base de datos');

    // Iniciar servidor HTTP
    app.listen(PORT, () => {
      logger.info(`🚀 Servidor corriendo en puerto ${PORT}`);
      logger.info(`📡 Red blockchain: ${process.env.BLOCKCHAIN_NETWORK || 'no configurada'}`);
      logger.info(`🌐 CORS habilitado para: ${corsOrigins.join(', ')}`);
    });

    // Iniciar sincronización blockchain (en segundo plano)
    if (process.env.BLOCKCHAIN_NETWORK && process.env.POLL_POOL_ADDRESS) {
      const sync = new BlockchainSync();
      
      // Hacer disponible para las rutas de API
      app.set('blockchainSync', sync);
      
      sync.start().catch(err => {
        logger.error('Error iniciando sincronización blockchain:', err);
      });
    } else {
      logger.warn('⚠️ Sincronización blockchain deshabilitada - configura BLOCKCHAIN_NETWORK y direcciones de contratos');
    }

  } catch (error) {
    logger.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGINT', async () => {
  logger.info('Cerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Cerrando servidor...');
  await prisma.$disconnect();
  process.exit(0);
});

// Iniciar
startServer();

module.exports = app;

