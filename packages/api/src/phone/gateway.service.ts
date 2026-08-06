import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const BASE_URL = 'https://gatewayapi.telegram.org';

interface GatewayResult<T = any> {
  ok: boolean;
  result?: T;
  error?: string;
}

/**
 * Thin client for the Telegram Gateway API (OTP delivery inside Telegram).
 *
 * Docs: https://core.telegram.org/gateway/api
 * Auth: Bearer TELEGRAM_GATEWAY_TOKEN. Sending codes to your own number is free.
 *
 * We let Telegram generate and validate the code (checkVerificationStatus), so
 * a plaintext code never touches our servers or database.
 */
@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  get enabled(): boolean {
    return (
      process.env.TELEGRAM_GATEWAY_ENABLED === 'true' &&
      !!process.env.TELEGRAM_GATEWAY_TOKEN
    );
  }

  private get token(): string {
    return process.env.TELEGRAM_GATEWAY_TOKEN || '';
  }

  private async post<T>(path: string, body: Record<string, any>): Promise<GatewayResult<T>> {
    try {
      const { data } = await axios.post(`${BASE_URL}/${path}`, body, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        timeout: 15000,
      });
      return data as GatewayResult<T>;
    } catch (err: any) {
      // Never log the phone number itself.
      this.logger.warn(`Gateway ${path} failed: ${err?.response?.status ?? err?.message}`);
      return { ok: false, error: err?.response?.data?.error ?? 'REQUEST_FAILED' };
    }
  }

  /**
   * Pre-check deliverability before paying for a send. Returns a request_id that
   * should be reused in sendVerificationCode to avoid a double charge.
   */
  async checkSendAbility(phone: string): Promise<GatewayResult<{ request_id: string }>> {
    if (!this.enabled) return { ok: false, error: 'GATEWAY_DISABLED' };
    return this.post('checkSendAbility', { phone_number: phone });
  }

  /**
   * Ask Telegram to generate and deliver a 6-digit code. Undelivered within
   * `ttl` is auto-refunded by Telegram.
   */
  async sendVerificationCode(
    phone: string,
    requestId?: string,
  ): Promise<GatewayResult<{ request_id: string; delivery_status?: any }>> {
    if (!this.enabled) return { ok: false, error: 'GATEWAY_DISABLED' };
    return this.post('sendVerificationMessage', {
      phone_number: phone,
      request_id: requestId,
      code_length: 6,
      ttl: 300,
      payload: 'expouz-phone-verify',
    });
  }

  /**
   * Verify a user-entered code against a prior send. status is one of
   * 'code_valid' | 'code_invalid' | 'expired'.
   */
  async checkStatus(
    requestId: string,
    code: string,
  ): Promise<GatewayResult<{ verification_status?: { status: string } }>> {
    if (!this.enabled) return { ok: false, error: 'GATEWAY_DISABLED' };
    return this.post('checkVerificationStatus', { request_id: requestId, code });
  }
}
