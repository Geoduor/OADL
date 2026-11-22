import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CountiesService {
  constructor(private readonly prisma: PrismaService) {}

  // Allow-list: only what the storefront dropdown needs.
  list() {
    return this.prisma.county.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
  }
}
