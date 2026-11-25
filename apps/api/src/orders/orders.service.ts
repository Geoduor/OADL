import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { isUniqueViolation } from '../prisma/unique-violation.js';
import type { CreateOrderInput } from './create-order.schema.js';
import type { ManagerCreateOrderInput } from './manager-create-order.schema.js';

export type NewOrder = Omit<CreateOrderInput, 'turnstileToken'>;
import { generateOrderNo } from './order-number.js';

// Only these fields go back to the customer. Never return a whole row.
const publicOrderSelect = {
  orderNo: true,
  status: true,
  totalKes: true,
  items: {
    select: {
      quantity: true,
      lineTotalKes: true,
      product: { select: { name: true } },
    },
  },
} as const;

const MAX_ORDER_NO_ATTEMPTS = 5;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // Public order creation. Prices always come from the database; the
  // idempotency key makes a repeated submit return the first order.
  // Initial status is PLACED. Later status changes belong to the state
  // machine service (docs/ORDER_LIFECYCLE.md), which does not exist yet.
  // TODO(confirm): manager notification and sheet sync are not built yet.
  async create(input: NewOrder) {
    const existing = await this.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return this.toResponse(existing);
    }

    const county = await this.prisma.county.findUnique({
      where: { id: input.countyId },
      select: { id: true },
    });
    if (!county) {
      throw new BadRequestException('Unknown county');
    }

    const { lines, totalKes } = await this.priceLines(input.items);

    for (let attempt = 1; attempt <= MAX_ORDER_NO_ATTEMPTS; attempt++) {
      try {
        const order = await this.prisma.order.create({
          data: {
            orderNo: generateOrderNo(),
            idempotencyKey: input.idempotencyKey,
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            countyId: input.countyId,
            location: input.location,
            landingSlug: input.landingSlug,
            utmSource: input.utmSource,
            utmMedium: input.utmMedium,
            utmCampaign: input.utmCampaign,
            utmContent: input.utmContent,
            totalKes,
            items: { create: lines },
            history: { create: [{ toStatus: 'PLACED' }] },
          },
          select: publicOrderSelect,
        });
        return this.toResponse(order);
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
        // Either the same key was submitted at the same moment (return the
        // first order) or the random order number collided (try another).
        const winner = await this.findByIdempotencyKey(input.idempotencyKey);
        if (winner) {
          return this.toResponse(winner);
        }
      }
    }
    throw new Error('Could not allocate an order number');
  }

  // The manager enters an order for a customer who reached him another way
  // (D36). It starts CONFIRMED: he has already spoken to the customer, so the
  // phone-confirm step (D21) is done. Returns the order id; a repeated
  // idempotency key returns the first order. The creation row in the history
  // says who made it and, if the total was changed, why.
  async createByManager(
    manager: { id: string },
    input: ManagerCreateOrderInput,
  ): Promise<string> {
    const existing = await this.prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: { id: true },
    });
    if (existing) {
      return existing.id;
    }

    const county = await this.prisma.county.findUnique({
      where: { id: input.countyId },
      select: { id: true },
    });
    if (!county) {
      throw new BadRequestException('Unknown county');
    }

    const { lines, totalKes: bundleTotal } = await this.priceLines(input.items);
    const changed =
      input.totalKes !== undefined && input.totalKes !== bundleTotal;
    if (changed && !input.reason) {
      throw new BadRequestException(
        'A reason is required when the total differs from the bundle prices',
      );
    }
    const totalKes = changed ? (input.totalKes as number) : bundleTotal;
    const reason = changed
      ? `Created by manager. Total set to KES ${totalKes} instead of ${bundleTotal}: ${input.reason}`
      : 'Created by manager';

    for (let attempt = 1; attempt <= MAX_ORDER_NO_ATTEMPTS; attempt++) {
      try {
        const order = await this.prisma.order.create({
          data: {
            orderNo: generateOrderNo(),
            idempotencyKey: input.idempotencyKey,
            source: 'MANAGER_CREATED',
            status: 'CONFIRMED',
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            countyId: input.countyId,
            location: input.location,
            notes: input.notes,
            totalKes,
            items: { create: lines },
            history: {
              create: [
                {
                  toStatus: 'CONFIRMED',
                  reason,
                  changedByUserId: manager.id,
                },
              ],
            },
          },
          select: { id: true },
        });
        return order.id;
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
        // Same key at the same moment (return the first order) or a random
        // order number collision (try another).
        const winner = await this.prisma.order.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { id: true },
        });
        if (winner) {
          return winner.id;
        }
      }
    }
    throw new Error('Could not allocate an order number');
  }

  // Prices always come from the database, never from the client. Every line
  // must be a bundle that is on offer (Q2). Shared by the storefront and by
  // orders the manager creates.
  private async priceLines(items: { productId: string; quantity: number }[]) {
    const prices = await this.prisma.productPrice.findMany({
      where: {
        active: true,
        product: { active: true },
        OR: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
      select: { productId: true, quantity: true, priceKes: true },
    });

    const lines = items.map((item) => {
      const price = prices.find(
        (candidate) =>
          candidate.productId === item.productId &&
          candidate.quantity === item.quantity,
      );
      if (!price) {
        throw new BadRequestException(
          'A product is unavailable or its quantity is not an offered bundle',
        );
      }
      return {
        productId: item.productId,
        quantity: item.quantity,
        lineTotalKes: price.priceKes,
      };
    });
    const totalKes = lines.reduce((sum, line) => sum + line.lineTotalKes, 0);
    return { lines, totalKes };
  }

  // Used before the bot check so a double tap returns the first order
  // instead of failing on a spent Turnstile token.
  async findExisting(idempotencyKey: string) {
    const existing = await this.findByIdempotencyKey(idempotencyKey);
    return existing ? this.toResponse(existing) : null;
  }

  private findByIdempotencyKey(idempotencyKey: string) {
    return this.prisma.order.findUnique({
      where: { idempotencyKey },
      select: publicOrderSelect,
    });
  }

  private toResponse(order: {
    orderNo: string;
    status: string;
    totalKes: number;
    items: {
      quantity: number;
      lineTotalKes: number;
      product: { name: string };
    }[];
  }) {
    return {
      orderNo: order.orderNo,
      status: order.status,
      totalKes: order.totalKes,
      items: order.items.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        lineTotalKes: item.lineTotalKes,
      })),
    };
  }
}
