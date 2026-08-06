import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { normalizeE164 } from './phone.util';

/**
 * Validates the signed contact payload returned by Telegram's `requestContact`.
 *
 * Telegram signs it exactly like initData: HMAC-SHA256 over a sorted
 * `key=value\n` data-check-string, keyed by HMAC-SHA256("WebAppData", botToken).
 * We must verify the signature server-side before trusting any phone number —
 * the client is never trusted with the number it claims.
 */
@Injectable()
export class ContactService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Verify the raw contact payload and extract the phone + Telegram user id.
   * Throws if the signature is missing or invalid. The caller MUST additionally
   * check that `telegramUserId` matches the authenticated user's telegramId.
   */
  validateContactPayload(raw: string): { phone: string; telegramUserId: string } {
    if (!raw || typeof raw !== 'string') {
      throw new BadRequestException('Missing contact payload');
    }

    const params = new URLSearchParams(raw);
    const hash = params.get('hash');
    if (!hash) throw new BadRequestException('Missing hash');
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new BadRequestException('Telegram bot not configured');
    }

    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const computed = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

    // Constant-time comparison to avoid signature timing leaks.
    const a = Buffer.from(computed, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid contact signature');
    }

    let contact: any;
    try {
      contact = JSON.parse(params.get('contact') || '{}');
    } catch {
      throw new BadRequestException('Malformed contact payload');
    }

    const phone = normalizeE164(contact.phone_number);
    const telegramUserId = contact.user_id != null ? String(contact.user_id) : '';
    if (!phone || !telegramUserId) {
      throw new BadRequestException('Contact payload missing phone or user id');
    }

    return { phone, telegramUserId };
  }
}
