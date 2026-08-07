import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from '../generated/prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL não foi definida.');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const stores = Array.from({ length: 18 }, (_, index) => {
  const storeNumber = index + 1;

  return {
    code: `LJ${String(storeNumber).padStart(3, '0')}`,
    name: `Loja ${String(storeNumber).padStart(2, '0')}`,
  };
});

async function main() {
  for (const store of stores) {
    await prisma.store.upsert({
      where: { code: store.code },
      update: { name: store.name },
      create: store,
    });
  }

  console.log(`${stores.length} lojas processadas com sucesso.`);
}

void main()
  .catch((error: unknown) => {
    console.error('Erro ao executar seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
