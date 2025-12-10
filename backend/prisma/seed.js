// 🌱 Seed de base de datos para desarrollo
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // Crear estado de sincronización inicial
  await prisma.syncState.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      lastBlockNumber: 0,
      isRunning: false
    }
  });

  console.log('✅ SyncState creado');

  // Crear usuarios de ejemplo (opcional - para desarrollo)
  if (process.env.NODE_ENV === 'development') {
    const testUsers = [
      { address: '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266' }, // Hardhat account 0
      { address: '0x70997970c51812dc3a010c7d01b50e0d17dc79c8' }, // Hardhat account 1
      { address: '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc' }, // Hardhat account 2
    ];

    for (const user of testUsers) {
      await prisma.user.upsert({
        where: { address: user.address },
        update: {},
        create: user
      });
    }

    console.log('✅ Usuarios de prueba creados');
  }

  console.log('🎉 Seed completado');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

