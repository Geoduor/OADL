import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Health check for the host (Render's health check path). Public, not rate
 * limited, and returns no data besides the status. It fails with 503 when the
 * database cannot be reached so the host does not route traffic to a broken
 * instance.
 */
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: 'ok' }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      // Do not leak the driver error (it can include the connection string).
      throw new ServiceUnavailableException();
    }
    return { status: 'ok' };
  }
}
