import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient, UserRole } from '../generated/prisma/client';

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} não foi definida.`);
  }

  return value;
}

function getAdminPassword(): string {
  const value = process.env.ADMIN_PASSWORD;

  if (!value || value.trim().length < 12) {
    throw new Error('ADMIN_PASSWORD deve possuir pelo menos 12 caracteres.');
  }

  return value;
}

const connectionString = getRequiredEnvironmentVariable('DATABASE_URL');
const adminName = getRequiredEnvironmentVariable('ADMIN_NAME');
const adminEmail = getRequiredEnvironmentVariable('ADMIN_EMAIL').toLowerCase();
const adminLogin = getRequiredEnvironmentVariable('ADMIN_LOGIN').toLowerCase();

const adminPassword = getAdminPassword();

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

async function seedStores(): Promise<void> {
  for (const store of stores) {
    await prisma.store.upsert({
      where: { code: store.code },
      update: {},
      create: store,
    });
  }

  console.log(`${stores.length} lojas processadas com sucesso.`);
}

async function seedAdministrator(): Promise<void> {
  const existingAdministrator = await prisma.user.findUnique({
    where: { login: adminLogin },
    select: { id: true },
  });

  if (existingAdministrator) {
    console.log('Administrador inicial já existe e foi preservado.');
    return;
  }

  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      login: adminLogin,
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  console.log('Administrador inicial criado com sucesso.');
}

async function main(): Promise<void> {
  await seedStores();
  await seedAdministrator();
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
