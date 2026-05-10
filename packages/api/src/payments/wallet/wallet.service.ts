import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getBalance(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { credit: true },
    });
    return { balance: user.credit };
  }

  async topUp(userId: string, amount: number, gateway: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        bookingId: `wallet_topup_${userId}_${Date.now()}`,
        amount,
        platformFee: 0,
        gateway: gateway as any,
        status: 'PENDING',
      },
    });

    const paymentUrl = this.generatePaymentUrl(transaction.id, amount, gateway);
    return { transaction, paymentUrl };
  }

  async deduct(userId: string, amount: number) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (Number(user.credit) < amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.user.update({
        where: { id: userId },
        data: { credit: { decrement: amount } },
        select: { credit: true },
      });
    });
  }

  async creditWallet(userId: string, amount: number) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { credit: { increment: amount } },
      select: { credit: true },
    });
  }

  private generatePaymentUrl(transactionId: string, amount: number, gateway: string): string {
    switch (gateway) {
      case 'PAYME':
        return `https://checkout.paycom.uz/${Buffer.from(
          JSON.stringify({ id: transactionId, amount: amount * 100 }),
        ).toString('base64')}`;
      case 'CLICK':
        return `https://my.click.uz/services/pay?service_id=${process.env.CLICK_SERVICE_ID}&merchant_id=${process.env.CLICK_MERCHANT_ID}&amount=${amount}&transaction_param=${transactionId}`;
      default:
        return `https://uzum.uz/pay?merchant_id=${process.env.UZUM_MERCHANT_ID}&order_id=${transactionId}&amount=${amount}`;
    }
  }
}
