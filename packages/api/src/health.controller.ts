import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { RedisService } from './redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const [db, redis] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(
        () => 'up' as const,
        () => 'down' as const,
      ),
      this.redis.get('health:ping').then(
        () => 'up' as const,
        () => 'down' as const,
      ),
    ]);

    return {
      status: db === 'up' && redis === 'up' ? 'ok' : 'degraded',
      db,
      redis,
      timestamp: new Date().toISOString(),
    };
  }
}
