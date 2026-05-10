import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import axios from 'axios';

@Injectable()
export class SmsService {
  constructor(private redis: RedisService) {}

  async send(phone: string, message: string): Promise<void> {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[SMS] To: ${phone} | Message: ${message}`);
      return;
    }

    const token = await this.getEskizToken();
    if (!token) {
      console.error('Failed to get Eskiz token, SMS not sent');
      return;
    }

    try {
      await axios.post(
        'https://notify.eskiz.uz/api/message/sms/send',
        {
          mobile_phone: phone.replace('+', ''),
          message,
          from: '4546',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
    } catch (error) {
      console.error('Eskiz SMS send failed:', error.message);
    }
  }

  private async getEskizToken(): Promise<string | null> {
    const cacheKey = 'eskiz:token';
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.post('https://notify.eskiz.uz/api/auth/login', {
        email: process.env.ESKIZ_EMAIL,
        password: process.env.ESKIZ_PASSWORD,
      });

      const token = response.data?.data?.token;
      if (token) {
        await this.redis.set(cacheKey, token, 29 * 24 * 60 * 60);
      }
      return token || null;
    } catch (error) {
      console.error('Eskiz login failed:', error.message);
      return null;
    }
  }
}
