import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

// Prices are integer KES and come from the client's sheet (D10, Q2).
// TODO(confirm): rules for quantities above the listed bundles (Q2).
// TODO(confirm): product description, image and "was" price (Q14, Q25).
const bundles = [
  { quantity: 1, priceKes: 3999 },
  { quantity: 2, priceKes: 5500 },
  { quantity: 3, priceKes: 7000 },
];

async function main(): Promise<void> {
  const product = await prisma.product.upsert({
    where: { slug: 'prostguard' },
    update: {},
    create: { name: 'PROSTGUARD', slug: 'prostguard', sortOrder: 1 },
  });

  for (const bundle of bundles) {
    await prisma.productPrice.upsert({
      where: {
        productId_quantity: {
          productId: product.id,
          quantity: bundle.quantity,
        },
      },
      update: {},
      create: { productId: product.id, ...bundle },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
