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

    // Wallet top-ups are not linked to any booking — bookingId omitted (nullable)
    const transaction = await this.prisma.transaction.create({
      data: {
        userId,
        amount,
        platformFee: 0,
        gateway: gateway as any,
        status: 'PENDING',
      },
    });

    // Build payment URL inline (no booking context, just fund the wallet)
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
}
