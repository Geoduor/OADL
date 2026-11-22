import 'dotenv/config';
import { PasswordHasher } from '@nestjs/authentication';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { registerSchema } from '../src/auth/auth.schemas.js';

// Creates the one manager account (D23). There is no default account (AGENTS.md
// section 6): the name, phone and password come from the environment of the
// person running this, and the password is never printed or stored in a file.
//
//   MANAGER_NAME="..." MANAGER_PHONE="07..." MANAGER_PASSWORD="..." \
//     pnpm --filter api create-manager
//
// Refuses to run when a manager already exists.
async function main() {
  const parsed = registerSchema.omit({ turnstileToken: true }).safeParse({
    name: process.env['MANAGER_NAME'],
    phone: process.env['MANAGER_PHONE'],
    password: process.env['MANAGER_PASSWORD'],
  });
  if (!parsed.success) {
    console.error(
      'Set MANAGER_NAME, MANAGER_PHONE (Kenyan mobile) and MANAGER_PASSWORD (10 to 128 characters).',
    );
    process.exitCode = 1;
    return;
  }
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('DATABASE_URL is not set.');
    process.exitCode = 1;
    return;
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    const existing = await prisma.user.count({ where: { role: 'MANAGER' } });
    if (existing > 0) {
      console.error('A manager account already exists. Nothing was changed.');
      process.exitCode = 1;
      return;
    }
    const { name, phone, password } = parsed.data;
    await prisma.user.create({
      data: {
        name,
        phone,
        passwordHash: await new PasswordHasher().hash(password),
        role: 'MANAGER',
        status: 'ACTIVE',
      },
    });
    console.log('Manager account created.');
  } finally {
    await prisma.$disconnect();
  }
}

await main();
