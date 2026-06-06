import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class UzumService {
  constructor(private prisma: PrismaService) {}

  validateWebhookSignature(body: any, signature: string): boolean {
    const secretKey = process.env.UZUM_SECRET_KEY || '';
    const payload = typeof body === 'string' ? body : JSON.stringify(body);
    const expected = crypto
      .createHmac('sha256', secretKey)
      .update(payload)
      .digest('hex');
    return expected === signature;
  }

  async handleCheck(dto: { orderId: string }) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.orderId },
    });

    if (!transaction) {
      return { result: -1, error: 'Order not found' };
    }

    if (transaction.status === 'FAILED') {
      return { result: -2, error: 'Transaction failed' };
    }

    return { result: 0, orderId: dto.orderId };
  }

  async handleCreate(dto: { orderId: string; transactionId: string; amount: number }) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.orderId },
    });

    if (!transaction) {
      return { result: -1, error: 'Order not found' };
    }

    await this.prisma.transaction.update({
      where: { id: dto.orderId },
      data: {
        gatewayTxId: dto.transactionId,
        status: 'HELD',
        heldAt: new Date(),
      },
    });

    await this.confirmBooking(transaction, 'CONFIRMED');

    return { result: 0, transactionId: dto.transactionId };
  }

  async handleConfirm(dto: { orderId: string; transactionId: string }) {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.orderId },
    });

    if (!transaction) {
      return { result: -1, error: 'Order not found' };
    }

    await this.prisma.transaction.update({
      where: { id: dto.orderId },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
      },
    });

    await this.confirmBooking(transaction, 'COMPLETED');

    return { result: 0, transactionId: dto.transactionId };
  }

  // ─── Shared helper ──────────────────────────────────────────────────────────
  private async confirmBooking(transaction: any, bookingStatus: string) {
    if (transaction.bookingId) {
      await this.prisma.booking.update({
        where: { id: transaction.bookingId },
        data: { status: bookingStatus },
      });
    } else if (transaction.pitchBookingId) {
      await this.prisma.pitchBooking.update({
        where: { id: transaction.pitchBookingId },
        data: { status: bookingStatus },
      });
    }
  }

  generatePaymentUrl(transactionId: string, amount: number): string {
    const merchantId = process.env.UZUM_MERCHANT_ID || '';
    return `https://uzum.uz/pay?merchant_id=${merchantId}&order_id=${transactionId}&amount=${amount}`;
  }
}
