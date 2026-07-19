import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma, WalletTxType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * The wallet is the single internal currency. Every balance movement MUST go
 * through `adjust`, which writes an immutable WalletTransaction ledger row with
 * the running balance. Gateways fund the wallet — they are never a parallel
 * money path.
 */
@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  /**
   * The single, atomic, ledgered entry point for ALL wallet balance changes.
   * Writes a WalletTransaction with the running balance. Rejects overdrafts
   * unless explicitly allowed. Positive amount = credit in, negative = debit out.
   *
   * Pass an existing transaction `client` to compose this into a larger atomic
   * operation (e.g. join match: debit wallet + confirm booking in one tx).
   */
  async adjust(
    userId: string,
    amount: number,
    type: WalletTxType,
    opts: { reference?: string; description: string; allowOverdraft?: boolean },
    client?: Prisma.TransactionClient,
  ): Promise<number> {
    const run = async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { credit: true },
      });
      const current = Number(user.credit);
      const next = current + amount;
      if (next < 0 && !opts.allowOverdraft) {
        throw new BadRequestException('Insufficient wallet balance');
      }
      await tx.user.update({ where: { id: userId }, data: { credit: next } });
      await tx.walletTransaction.create({
        data: {
          userId,
          type,
          amount,
          balanceAfter: next,
          reference: opts.reference,
          description: opts.description,
        },
      });
      return next;
    };

    return client ? run(client) : this.prisma.$transaction(run);
  }

  async getHistory(userId: string, limit = 50) {
    return this.prisma.walletTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { credit: true },
    });
    return { balance: Number(user.credit) };
  }

  /**
   * Grant the one-time welcome bonus. Idempotent: a user can only ever receive
   * a single WELCOME_BONUS ledger entry.
   */
  async grantWelcomeBonus(
    userId: string,
    amount = Number(process.env.WELCOME_BONUS_AMOUNT ?? 50000),
    client?: Prisma.TransactionClient,
  ): Promise<number | null> {
    if (amount <= 0) return null;
    const existing = await (client ?? this.prisma).walletTransaction.findFirst({
      where: { userId, type: 'WELCOME_BONUS' },
      select: { id: true },
    });
    if (existing) return null;
    return this.adjust(
      userId,
      amount,
      'WELCOME_BONUS',
      { reference: 'signup', description: 'Welcome bonus' },
      client,
    );
  }

  /**
   * Gateway-funded top-up. Creates a PENDING transaction and returns the
   * payment URL; the wallet is credited (via `adjust`) only once the gateway
   * webhook confirms payment. Gated behind PAYMENT_GATEWAYS_ENABLED at the
   * controller level.
   */
  async topUp(userId: string, amount: number, gateway: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        amount,
        platformFee: 0,
        gateway: gateway as any,
        status: 'PENDING',
      },
    });

    let paymentUrl: string;
    switch (gateway) {
      case 'PAYME':
        paymentUrl = `https://checkout.paycom.uz/${Buffer.from(
          JSON.stringify({ id: transaction.id, amount: Math.round(amount * 100) }),
        ).toString('base64')}`;
        break;
      case 'CLICK':
        paymentUrl = `https://my.click.uz/services/pay?service_id=${process.env.CLICK_SERVICE_ID}&merchant_id=${process.env.CLICK_MERCHANT_ID}&amount=${amount}&transaction_param=${transaction.id}`;
        break;
      default:
        paymentUrl = `https://uzum.uz/pay?merchant_id=${process.env.UZUM_MERCHANT_ID || ''}&order_id=${transaction.id}&amount=${amount}`;
    }

    return { transaction, paymentUrl };
  }
}
