import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const publicProductSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  prices: {
    where: { active: true },
    orderBy: { quantity: 'asc' },
    select: { quantity: true, priceKes: true, compareAtPriceKes: true },
  },
} as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  listActive() {
    return this.prisma.product.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: publicProductSelect,
    });
  }

  findActiveBySlug(slug: string) {
    return this.prisma.product.findFirst({
      where: { slug, active: true },
      select: publicProductSelect,
    });
  }
}
