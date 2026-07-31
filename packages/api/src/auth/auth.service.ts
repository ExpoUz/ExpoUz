import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { WalletService } from '../payments/wallet/wallet.service';
import { normalizeLocale } from '../i18n/locales';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private wallet: WalletService,
  ) {}

  async sendOtp(dto: SendOtpDto): Promise<{ maskedPhone: string; expiresIn: number }> {
    const { phone } = dto;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    await this.prisma.otpCode.updateMany({
      where: { phone, used: false },
      data: { used: true },
    });

    await this.prisma.otpCode.create({
      data: { phone, code, expiresAt },
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV OTP] Phone: ${phone}, Code: ${code}`);
    } else {
      await this.sendEskizSms(phone, `Your ExpoUz code: ${code}. Valid 2 minutes.`);
    }

    const maskedPhone = phone.replace(/(\+998)(\d{2})(\d{3})(\d{4})/, '$1$2***$4');
    return { maskedPhone, expiresIn: 120 };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{
    accessToken: string;
    refreshToken: string;
    isNewUser: boolean;
    user: any;
  }> {
    const { phone, otp } = dto;
    const now = new Date();

    // Dev bypass: phone +998900000000 always accepts code 000000
    const isDevBypass =
      process.env.NODE_ENV !== 'production' &&
      phone === '+998900000000' &&
      otp === '000000';

    // Env-gated reusable test OTP. When TEST_OTP_CODE is set, this code logs in
    // any EXISTING account without consuming a real OTP. Unset the env to
    // disable. SECURITY: this is a deliberate login bypass — keep it secret and
    // remove it outside of testing.
    const isTestOtp =
      !!process.env.TEST_OTP_CODE && otp === process.env.TEST_OTP_CODE;

    if (!isDevBypass && !isTestOtp) {
      const otpRecord = await this.prisma.otpCode.findFirst({
        where: {
          phone,
          code: otp,
          used: false,
          expiresAt: { gt: now },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!otpRecord) {
        throw new UnauthorizedException('Invalid or expired OTP');
      }

      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { used: true },
      });
    }

    let user = await this.prisma.user.findUnique({ where: { phone } });
    let isNewUser = false;

    if (!user) {
      // The test OTP must never create accounts — only log into existing ones.
      if (isTestOtp) {
        throw new UnauthorizedException('Test login is only available for existing accounts');
      }
      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          phone,
          firstName: 'User',
          lastName: phone.slice(-4),
          role: 'PLAYER',
          skillLevel: 'AMATEUR',
          eloRating: 1000,
          reliabilityScore: 100.0,
        },
      });
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Your account has been banned');
    }

    // One-time welcome bonus so new users can transact immediately. Idempotent
    // (only one WELCOME_BONUS ledger entry per user ever), so it's also safe for
    // pre-existing users who signed up before this path granted it.
    await this.wallet.grantWelcomeBonus(user.id).catch(() => {
      // Non-critical to login.
    });

    const tokens = await this.generateTokens(user.id, user.role);

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: refreshExpiry,
      },
    });

    return { ...tokens, isNewUser, user };
  }

  async register(userId: string, dto: RegisterDto): Promise<any> {
    const updateData: any = {};
    if (dto.firstName) updateData.firstName = dto.firstName;
    if (dto.lastName) updateData.lastName = dto.lastName;
    if (dto.dateOfBirth) updateData.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.gender) updateData.gender = dto.gender;
    if (dto.city) updateData.city = dto.city;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    // One-time welcome bonus so new users can transact immediately (idempotent).
    await this.wallet.grantWelcomeBonus(userId).catch(() => {
      // Welcome bonus failure is non-critical to registration.
    });

    if (dto.referralCode) {
      try {
        const referrer = await this.prisma.user.findFirst({
          where: { referralCode: dto.referralCode },
        });
        if (referrer && referrer.id !== userId) {
          const currentUser = await this.prisma.user.findUnique({ where: { id: userId } });
          if (!currentUser.referredBy) {
            const bonus = Number(process.env.REFERRAL_BONUS_AMOUNT ?? 50000);
            await this.prisma.$transaction(async (tx) => {
              await tx.user.update({
                where: { id: userId },
                data: { referredBy: referrer.id },
              });
              await this.wallet.adjust(
                userId,
                bonus,
                'REFERRAL_BONUS',
                { reference: referrer.id, description: 'Referral bonus (joined via invite)' },
                tx,
              );
              await this.wallet.adjust(
                referrer.id,
                bonus,
                'REFERRAL_BONUS',
                { reference: userId, description: 'Referral bonus (invited a friend)' },
                tx,
              );
            });
          }
        }
      } catch {
        // Referral bonus failure is non-critical
      }
    }

    return user;
  }

  async refreshToken(dto: RefreshDto): Promise<{ accessToken: string; refreshToken: string }> {
    const { refreshToken } = dto;

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const tokens = await this.generateTokens(stored.user.id, stored.user.role);

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: {
        userId: stored.user.id,
        token: tokens.refreshToken,
        expiresAt: refreshExpiry,
      },
    });

    return tokens;
  }

  async logout(userId: string, token: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { userId, token },
    });
  }

  async telegramAuth(initData: string): Promise<{
    accessToken: string;
    refreshToken: string;
    isNewUser: boolean;
    user: any;
  }> {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) throw new UnauthorizedException('Missing hash');

    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const checkHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (checkHash !== hash) {
      throw new UnauthorizedException('Invalid Telegram initData');
    }

    const userParam = params.get('user');
    if (!userParam) throw new UnauthorizedException('Missing user data');

    const tgUser = JSON.parse(userParam);

    let user = await this.prisma.user.findUnique({
      where: { telegramId: String(tgUser.id) },
    });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const phone = `+998000${String(tgUser.id).slice(-7).padStart(7, '0')}`;
      user = await this.prisma.user.create({
        data: {
          phone,
          firstName: tgUser.first_name || 'User',
          lastName: tgUser.last_name || '',
          telegramId: String(tgUser.id),
          telegramUsername: tgUser.username,
          avatarUrl: tgUser.photo_url,
          // Auto-detect UI language from Telegram (uz/ru supported, else en).
          language: normalizeLocale(tgUser.language_code),
          role: 'PLAYER',
          skillLevel: 'AMATEUR',
          eloRating: 1000,
          reliabilityScore: 100.0,
        },
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          telegramUsername: tgUser.username,
          avatarUrl: tgUser.photo_url,
        },
      });
    }

    if (user.isBanned) {
      throw new UnauthorizedException('Your account has been banned');
    }

    // One-time welcome bonus so new users can transact immediately. Idempotent
    // (only one WELCOME_BONUS ledger entry per user ever), so it's also safe for
    // pre-existing users who signed up before this path granted it.
    await this.wallet.grantWelcomeBonus(user.id).catch(() => {
      // Non-critical to login.
    });

    const tokens = await this.generateTokens(user.id, user.role);

    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 30);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: tokens.refreshToken,
        expiresAt: refreshExpiry,
      },
    });

    return { ...tokens, isNewUser, user };
  }

  /**
   * Authenticate an admin from the @ExpoUzAdminBot Mini App.
   * Validates initData against the ADMIN bot token, then requires that the
   * Telegram account is already linked to an ADMIN/SUPER_ADMIN user.
   */
  async telegramAdminAuth(initData: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: any;
  }> {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) throw new UnauthorizedException('Missing hash');
    params.delete('hash');

    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const botToken =
      this.config.get<string>('TELEGRAM_ADMIN_BOT_TOKEN') ||
      this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const checkHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (checkHash !== hash) throw new UnauthorizedException('Invalid Telegram initData');

    const userParam = params.get('user');
    if (!userParam) throw new UnauthorizedException('Missing user data');
    const tgUser = JSON.parse(userParam);

    const user = await this.prisma.user.findUnique({
      where: { telegramId: String(tgUser.id) },
    });
    if (!user || !['SUPER_ADMIN', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Admin access required. Contact the platform owner.');
    }
    if (user.isBanned) throw new UnauthorizedException('Your account has been banned');

    const tokens = await this.generateTokens(user.id, user.role);
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 30);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, token: tokens.refreshToken, expiresAt: refreshExpiry },
    });
    return { ...tokens, user };
  }

  async googleAuth(credential: string): Promise<{
    accessToken: string;
    refreshToken: string;
    isNewUser: boolean;
    user: any;
  }> {
    let googleUser: any;
    try {
      const { data } = await axios.get(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`,
      );
      googleUser = data;
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    const { email, given_name, family_name, name, sub: googleId } = googleUser;
    if (!googleId || !email) throw new UnauthorizedException('Incomplete Google profile');

    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      user = await this.prisma.user.create({
        data: {
          googleId,
          email,
          firstName: given_name || (name ? name.split(' ')[0] : 'User'),
          lastName: family_name || (name ? name.split(' ').slice(1).join(' ') : googleId.slice(-4)),
          role: 'PLAYER',
          skillLevel: 'AMATEUR',
          eloRating: 1000,
          reliabilityScore: 100.0,
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      });
    }

    if (user.isBanned) throw new UnauthorizedException('Your account has been banned');

    const tokens = await this.generateTokens(user.id, user.role);
    const refreshExpiry = new Date();
    refreshExpiry.setDate(refreshExpiry.getDate() + 30);
    await this.prisma.refreshToken.create({
      data: { userId: user.id, token: tokens.refreshToken, expiresAt: refreshExpiry },
    });

    return { ...tokens, isNewUser, user };
  }

  private async generateTokens(
    userId: string,
    role: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, role },
        {
          secret: this.config.get<string>('JWT_SECRET'),
          expiresIn: this.config.get<string>('JWT_EXPIRES_IN') || '15m',
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, role },
        {
          secret: this.config.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d',
        },
      ),
    ]);

    return { accessToken, refreshToken };
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
      console.error('Eskiz SMS failed:', error.message);
    }
  }
}
