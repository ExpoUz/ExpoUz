import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymeService {
  constructor(private prisma: PrismaService) {}

  private validateAuth(auth: string): void {
    const merchantId = process.env.PAYME_MERCHANT_ID || '';
    const secretKey = process.env.PAYME_SECRET_KEY || '';
    const expected = `Basic ${Buffer.from(`${merchantId}:${secretKey}`).toString('base64')}`;
    if (auth !== expected) {
      throw new UnauthorizedException('Invalid Payme credentials');
    }
  }

  async handleWebhook(method: string, params: any, auth: string): Promise<any> {
    this.validateAuth(auth);

    switch (method) {
      case 'CheckPerformTransaction':
        return this.checkPerformTransaction(params);
      case 'CreateTransaction':
        return this.createTransaction(params);
      case 'PerformTransaction':
        return this.performTransaction(params);
      case 'CancelTransaction':
        return this.cancelTransaction(params);
      case 'CheckTransaction':
        return this.checkTransaction(params);
      default:
        return { error: { code: -32601, message: 'Method not found' } };
    }
  }

  private async checkPerformTransaction(params: any) {
    const { amount, account } = params;
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: account.order_id },
    });

    if (!transaction) {
      return { error: { code: -31050, message: { ru: 'Заказ не найден', uz: 'Buyurtma topilmadi', en: 'Order not found' } } };
    }

    const expectedAmount = Number(transaction.amount) * 100;
    if (Math.abs(amount - expectedAmount) > 1) {
      return { error: { code: -31001, message: { ru: 'Неверная сумма', uz: 'Noto\'g\'ri summa', en: 'Invalid amount' } } };
    }

    return { result: { allow: true } };
  }

  private async createTransaction(params: any) {
    const { id: paymeId, amount, account, time } = params;
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: account.order_id },
    });

    if (!transaction) {
      return { error: { code: -31050, message: 'Order not found' } };
    }

    await this.prisma.transaction.update({
      where: { id: account.order_id },
      data: {
        gatewayTxId: paymeId,
        status: 'HELD',
        heldAt: new Date(time),
      },
    });

    await this.prisma.booking.update({
      where: { id: transaction.bookingId },
      data: { status: 'CONFIRMED' },
    });

    return {
      result: {
        create_time: time,
        transaction: paymeId,
        state: 1,
      },
    };
  }

  private async performTransaction(params: any) {
    const { id: paymeId } = params;
    const transaction = await this.prisma.transaction.findFirst({
      where: { gatewayTxId: paymeId },
    });

    if (!transaction) {
      return { error: { code: -31003, message: 'Transaction not found' } };
    }

    const now = Date.now();
    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });

    return {
      result: {
        perform_time: now,
        transaction: paymeId,
        state: 2,
      },
    };
  }

  private async cancelTransaction(params: any) {
    const { id: paymeId, reason } = params;
    const transaction = await this.prisma.transaction.findFirst({
      where: { gatewayTxId: paymeId },
    });

    if (!transaction) {
      return { error: { code: -31003, message: 'Transaction not found' } };
    }

    const now = Date.now();
    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'REFUNDED', refundedAt: new Date() },
    });

    await this.prisma.booking.update({
      where: { id: transaction.bookingId },
      data: { status: 'CANCELLED_REFUND' },
    });

    await this.prisma.user.update({
      where: { id: transaction.userId },
      data: { credit: { increment: transaction.amount } },
    });

    return {
      result: {
        cancel_time: now,
        transaction: paymeId,
        state: -1,
      },
    };
  }

  private async checkTransaction(params: any) {
    const { id: paymeId } = params;
    const transaction = await this.prisma.transaction.findFirst({
      where: { gatewayTxId: paymeId },
    });

    if (!transaction) {
      return { error: { code: -31003, message: 'Transaction not found' } };
    }

    const stateMap: Record<string, number> = {
      PENDING: 1,
      HELD: 1,
      RELEASED: 2,
      REFUNDED: -1,
      FAILED: -1,
      PARTIALLY_REFUNDED: -1,
    };

    return {
      result: {
        create_time: transaction.createdAt.getTime(),
        perform_time: transaction.releasedAt?.getTime() || 0,
        cancel_time: transaction.refundedAt?.getTime() || 0,
        transaction: paymeId,
        state: stateMap[transaction.status] || 1,
        reason: null,
      },
    };
  }
}
