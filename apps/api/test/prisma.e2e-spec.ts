import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { assertLocalDatabase } from './support/local-database.js';

describe('PrismaService (e2e)', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  assertLocalDatabase();
  beforeAll(async () => {
    const url = process.env.DATABASE_URL ?? '';
    if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
      throw new Error('Refusing to run database tests on a non-local database');
    }
    moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('reaches the database', async () => {
    const rows = await prisma.$queryRaw`SELECT 1 AS ok`;
    expect(rows).toHaveLength(1);
  });

  it('saves a product with a bundle price and reads it back', async () => {
    const slug = `test-product-${Date.now()}`;
    const product = await prisma.product.create({
      data: {
        name: 'TEST PRODUCT',
        slug,
        prices: { create: [{ quantity: 1, priceKes: 100 }] },
      },
    });
    try {
      const found = await prisma.product.findUnique({
        where: { slug },
        include: { prices: true },
      });
      expect(found?.prices).toHaveLength(1);
      expect(found?.prices[0]?.priceKes).toBe(100);
    } finally {
      await prisma.productPrice.deleteMany({
        where: { productId: product.id },
      });
      await prisma.product.delete({ where: { id: product.id } });
    }
  });
});
