// 📤 Rutas API para Upload de Imágenes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../utils/prisma');
const logger = require('../utils/logger');

// Configuración de almacenamiento
const uploadDir = process.env.UPLOAD_DIR || './uploads';
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB
const allowedExtensions = (process.env.ALLOWED_EXTENSIONS || 'jpg,jpeg,png,gif,webp').split(',');

// Crear directorio si no existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de Multer
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Extensión no permitida. Permitidas: ${allowedExtensions.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: maxFileSize },
  fileFilter
});

// POST /api/upload/image - Subir imagen para pool
router.post('/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    const { poolId, address } = req.body;

    // Generar nombre único
    const filename = `${uuidv4()}.webp`;
    const filepath = path.join(uploadDir, filename);

    // Procesar imagen con Sharp (optimizar y convertir a WebP)
    await sharp(req.file.buffer)
      .resize(1200, 630, { // Tamaño óptimo para preview
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 80 })
      .toFile(filepath);

    // Obtener info del archivo procesado
    const stats = fs.statSync(filepath);
    const publicUrl = `${process.env.PUBLIC_URL || 'http://localhost:3001'}/uploads/${filename}`;

    // Guardar en base de datos
    const uploadedImage = await prisma.uploadedImage.create({
      data: {
        filename,
        originalName: req.file.originalname,
        mimetype: 'image/webp',
        size: stats.size,
        path: filepath,
        url: publicUrl,
        poolId: poolId ? parseInt(poolId) : null,
        uploadedBy: address?.toLowerCase() || null
      }
    });

    logger.info(`📤 Imagen subida: ${filename}`);

    res.json({
      success: true,
      data: {
        id: uploadedImage.id,
        filename,
        url: publicUrl,
        size: stats.size
      }
    });

  } catch (error) {
    logger.error('Error subiendo imagen:', error);
    res.status(500).json({ error: error.message || 'Error subiendo imagen' });
  }
});

// POST /api/upload/image/base64 - Subir imagen en base64
router.post('/image/base64', async (req, res) => {
  try {
    const { image, poolId, address } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    // Extraer datos de base64
    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ error: 'Formato de imagen inválido' });
    }

    const ext = matches[1];
    const base64Data = matches[2];

    if (!allowedExtensions.includes(ext)) {
      return res.status(400).json({ error: `Extensión no permitida: ${ext}` });
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // Verificar tamaño
    if (buffer.length > maxFileSize) {
      return res.status(400).json({ error: `Archivo muy grande. Máximo: ${maxFileSize / 1024 / 1024}MB` });
    }

    // Generar nombre único
    const filename = `${uuidv4()}.webp`;
    const filepath = path.join(uploadDir, filename);

    // Procesar imagen con Sharp
    await sharp(buffer)
      .resize(1200, 630, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 80 })
      .toFile(filepath);

    const stats = fs.statSync(filepath);
    const publicUrl = `${process.env.PUBLIC_URL || 'http://localhost:3001'}/uploads/${filename}`;

    // Guardar en base de datos
    const uploadedImage = await prisma.uploadedImage.create({
      data: {
        filename,
        originalName: `image.${ext}`,
        mimetype: 'image/webp',
        size: stats.size,
        path: filepath,
        url: publicUrl,
        poolId: poolId ? parseInt(poolId) : null,
        uploadedBy: address?.toLowerCase() || null
      }
    });

    logger.info(`📤 Imagen base64 subida: ${filename}`);

    res.json({
      success: true,
      data: {
        id: uploadedImage.id,
        filename,
        url: publicUrl,
        size: stats.size
      }
    });

  } catch (error) {
    logger.error('Error subiendo imagen base64:', error);
    res.status(500).json({ error: error.message || 'Error subiendo imagen' });
  }
});

// GET /api/upload/:filename - Obtener info de imagen
router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    const image = await prisma.uploadedImage.findUnique({
      where: { filename }
    });

    if (!image) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    res.json({ data: image });

  } catch (error) {
    logger.error('Error obteniendo imagen:', error);
    res.status(500).json({ error: 'Error obteniendo imagen' });
  }
});

// DELETE /api/upload/:filename - Eliminar imagen (solo el uploader)
router.delete('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { address } = req.body;

    const image = await prisma.uploadedImage.findUnique({
      where: { filename }
    });

    if (!image) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    // Verificar que sea el uploader
    if (image.uploadedBy && image.uploadedBy !== address?.toLowerCase()) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar esta imagen' });
    }

    // Eliminar archivo físico
    if (fs.existsSync(image.path)) {
      fs.unlinkSync(image.path);
    }

    // Eliminar de base de datos
    await prisma.uploadedImage.delete({
      where: { filename }
    });

    logger.info(`🗑️ Imagen eliminada: ${filename}`);

    res.json({ success: true, message: 'Imagen eliminada' });

  } catch (error) {
    logger.error('Error eliminando imagen:', error);
    res.status(500).json({ error: 'Error eliminando imagen' });
  }
});

// Middleware de error para Multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `Archivo muy grande. Máximo: ${maxFileSize / 1024 / 1024}MB` });
    }
    return res.status(400).json({ error: error.message });
  }
  next(error);
});

module.exports = router;

