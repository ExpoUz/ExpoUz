import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { ContactService } from './contact.service';
import { GatewayService } from './gateway.service';
import { isE164, maskPhone, normalizeE164 } from './phone.util';

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly contact: ContactService,
    private readonly gateway: GatewayService,
  ) {}

  /** Current verification status for the profile screen / gating. */
  async getStatus(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { phone: true, phoneVerified: true, phoneVerifyMethod: true, phoneVerifiedAt: true },
    });
    return {
      phoneVerified: user.phoneVerified,
      method: user.phoneVerifyMethod,
      verifiedAt: user.phoneVerifiedAt,
      // Never return the raw number to the client that didn't provide it.
      maskedPhone: isE164(user.phone) ? maskPhone(user.phone!) : null,
    };
  }

  /**
   * Guard helper: throw PHONE_REQUIRED unless the user has a verified phone.
   * Used by gated actions (booking, hosting, wallet movements).
   */
  async assertVerified(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phoneVerified: true },
    });
    if (!user?.phoneVerified) {
      throw new ForbiddenException({ code: 'PHONE_REQUIRED' });
    }
  }

  // ─── Tier 1: one-tap Telegram contact share ────────────────────────────────
  async saveTelegramContact(userId: string, raw: string) {
    const { phone, telegramUserId } = this.contact.validateContactPayload(raw);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, telegramId: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // The shared contact MUST belong to the authenticated Telegram user,
    // otherwise anyone could submit someone else's signed contact.
    if (!user.telegramId || telegramUserId !== user.telegramId) {
      throw new ForbiddenException({ code: 'CONTACT_MISMATCH' });
    }

    await this.ensurePhoneFree(phone, userId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        phone,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        phoneVerifyMethod: 'TELEGRAM_CONTACT',
      },
    });

    return { verified: true, method: 'TELEGRAM_CONTACT', maskedPhone: maskPhone(phone) };
  }

  // ─── Tier 2/3: request a code (Gateway, SMS fallback) ──────────────────────
  async requestCode(userId: string, rawPhone: string) {
    const phone = normalizeE164(rawPhone);
    if (!isE164(phone)) throw new BadRequestException({ code: 'PHONE_INVALID' });

    await this.ensurePhoneFree(phone, userId);

    // Prefer Telegram Gateway.
    if (this.gateway.enabled) {
      const ability = await this.gateway.checkSendAbility(phone);
      if (ability.ok) {
        const sent = await this.gateway.sendVerificationCode(phone, ability.result?.request_id);
        if (sent.ok && sent.result?.request_id) {
          await this.prisma.phoneVerification.create({
            data: {
              userId,
              phone,
              requestId: sent.result.request_id,
              method: 'TELEGRAM_GATEWAY',
              expiresAt: new Date(Date.now() + CODE_TTL_MS),
            },
          });
          return { method: 'TELEGRAM_GATEWAY', expiresIn: CODE_TTL_MS / 1000 };
        }
      }
    }

    // SMS fallback (feature-flagged, not required for launch).
    if (process.env.SMS_ENABLED === 'true') {
      return this.sendSmsCode(userId, phone);
    }

    throw new BadRequestException({ code: 'PHONE_NOT_REACHABLE' });
  }

  async verifyCode(userId: string, code: string) {
    if (!code || !/^\d{4,8}$/.test(code)) {
      throw new BadRequestException({ code: 'CODE_INVALID' });
    }

    const v = await this.prisma.phoneVerification.findFirst({
      where: { userId, verified: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!v) throw new BadRequestException({ code: 'CODE_EXPIRED' });
    if (v.attempts >= MAX_VERIFY_ATTEMPTS) {
      throw new BadRequestException({ code: 'TOO_MANY_ATTEMPTS' });
    }

    await this.prisma.phoneVerification.update({
      where: { id: v.id },
      data: { attempts: { increment: 1 } },
    });

    const valid = await this.checkCode(v, code);
    if (!valid) throw new BadRequestException({ code: 'CODE_INVALID' });

    // Race guard: another account could have verified this number in the
    // meantime. One phone = one account.
    await this.ensurePhoneFree(v.phone, userId);

    await this.prisma.$transaction([
      this.prisma.phoneVerification.update({ where: { id: v.id }, data: { verified: true } }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          phone: v.phone,
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          phoneVerifyMethod: v.method,
        },
      }),
    ]);

    return { verified: true, method: v.method, maskedPhone: maskPhone(v.phone) };
  }

  // ─── Admin: manually mark a phone verified ─────────────────────────────────
  async adminMarkVerified(targetUserId: string, rawPhone: string) {
    const phone = normalizeE164(rawPhone);
    if (!isE164(phone)) throw new BadRequestException({ code: 'PHONE_INVALID' });
    await this.ensurePhoneFree(phone, targetUserId);

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        phone,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
        phoneVerifyMethod: 'ADMIN',
      },
      select: {
        id: true,
        phone: true,
        phoneVerified: true,
        phoneVerifyMethod: true,
        phoneVerifiedAt: true,
      },
    });
  }

  // ─── internals ─────────────────────────────────────────────────────────────

  /** Reject if the phone is already tied to a different account. */
  private async ensurePhoneFree(phone: string, userId: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== userId) {
      throw new ConflictException({ code: 'PHONE_ALREADY_USED' });
    }
  }

  private async checkCode(
    v: { method: string; requestId: string | null; codeHash: string | null },
    code: string,
  ): Promise<boolean> {
    if (v.method === 'TELEGRAM_GATEWAY') {
      if (!v.requestId) return false;
      const status = await this.gateway.checkStatus(v.requestId, code);
      return status.result?.verification_status?.status === 'code_valid';
    }
    if (v.method === 'SMS') {
      if (!v.codeHash) return false;
      return bcrypt.compare(code, v.codeHash);
    }
    return false;
  }

  /** Generate a code, store only its bcrypt hash, and deliver it via Eskiz. */
  private async sendSmsCode(userId: string, phone: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    await this.prisma.phoneVerification.create({
      data: {
        userId,
        phone,
        codeHash,
        method: 'SMS',
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    });
    await this.sendEskizSms(phone, `ExpoUz: ${code}`);
    return { method: 'SMS', expiresIn: CODE_TTL_MS / 1000 };
  }

  private async sendEskizSms(phone: string, message: string): Promise<void> {
    try {
      const tokenResponse = await axios.post('https://notify.eskiz.uz/api/auth/login', {
        email: this.config.get<string>('ESKIZ_EMAIL'),
        password: this.config.get<string>('ESKIZ_PASSWORD'),
      });
      const token = tokenResponse.data?.data?.token;
      if (!token) return;
      await axios.post(
        'https://notify.eskiz.uz/api/message/sms/send',
        { mobile_phone: phone.replace('+', ''), message, from: '4546' },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (error: any) {
      // Never log the number or the code.
      this.logger.warn(`Eskiz SMS failed: ${error?.message}`);
    }
  }
}
