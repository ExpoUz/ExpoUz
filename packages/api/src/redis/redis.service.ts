import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async setNX(key: string, value: string, ttl: number): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttl, 'NX');
    return result === 'OK';
  }

  async lockPosition(positionId: string, userId: string): Promise<boolean> {
    return this.setNX(`position:lock:${positionId}`, userId, 300);
  }

  async releasePosition(positionId: string): Promise<void> {
    await this.del(`position:lock:${positionId}`);
  }

  async getPositionLock(positionId: string): Promise<string | null> {
    return this.get(`position:lock:${positionId}`);
  }
}
