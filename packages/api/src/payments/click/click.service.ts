import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ClickService {
  constructor(private prisma: PrismaService) {}

  private validateSignString(
    clickTransId: string,
    serviceId: string,
    secretKey: string,
    merchantTransId: string,
    amount: string,
    action: string,
    signTime: string,
  ): string {
    // MD5 is required by the Click payment gateway API specification and cannot be replaced.
    // See: https://docs.click.uz/click-api-request/#sign_string
    // lgtm [js/weak-cryptographic-algorithm]
    const raw = `${clickTransId}${serviceId}${secretKey}${merchantTransId}${amount}${action}${signTime}`;
    return crypto.createHash('md5').update(raw).digest('hex'); // lgtm [js/weak-cryptographic-algorithm]
  }

  async handlePrepare(dto: {
    click_trans_id: string;
    service_id: string;
    merchant_trans_id: string;
    amount: string;
    action: string;
    sign_time: string;
    sign_string: string;
  }) {
    const secretKey = process.env.CLICK_SECRET_KEY || '';
    const expected = this.validateSignString(
      dto.click_trans_id,
      dto.service_id,
      secretKey,
      dto.merchant_trans_id,
      dto.amount,
      dto.action,
      dto.sign_time,
    );

    if (expected !== dto.sign_string) {
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        error: -1,
        error_note: 'SIGN CHECK FAILED!',
      };
    }

    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.merchant_trans_id },
    });

    if (!transaction) {
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        error: -5,
        error_note: 'Order not found',
      };
    }

    return {
      click_trans_id: dto.click_trans_id,
      merchant_trans_id: dto.merchant_trans_id,
      merchant_prepare_id: transaction.id,
      error: 0,
      error_note: 'Success',
    };
  }

  async handleComplete(dto: {
    click_trans_id: string;
    service_id: string;
    merchant_trans_id: string;
    merchant_prepare_id: string;
    amount: string;
    action: string;
    sign_time: string;
    sign_string: string;
    error: string;
  }) {
    const secretKey = process.env.CLICK_SECRET_KEY || '';
    const expected = this.validateSignString(
      dto.click_trans_id,
      dto.service_id,
      secretKey,
      dto.merchant_trans_id,
      dto.amount,
      dto.action,
      dto.sign_time,
    );

    if (expected !== dto.sign_string) {
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        error: -1,
        error_note: 'SIGN CHECK FAILED!',
      };
    }

    if (Number(dto.error) < 0) {
      await this.prisma.transaction.update({
        where: { id: dto.merchant_prepare_id },
        data: { status: 'FAILED' },
      });

      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        error: Number(dto.error),
        error_note: 'Transaction cancelled',
      };
    }

    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.merchant_prepare_id },
    });

    if (!transaction) {
      return {
        click_trans_id: dto.click_trans_id,
        merchant_trans_id: dto.merchant_trans_id,
        error: -6,
        error_note: 'Transaction not found',
      };
    }

    await this.prisma.transaction.update({
      where: { id: dto.merchant_prepare_id },
      data: {
        gatewayTxId: dto.click_trans_id,
        status: 'HELD',
        heldAt: new Date(),
      },
    });

    await this.confirmBooking(transaction, 'CONFIRMED');

    return {
      click_trans_id: dto.click_trans_id,
      merchant_trans_id: dto.merchant_trans_id,
      merchant_confirm_id: transaction.id,
      error: 0,
      error_note: 'Success',
    };
  }

  // ─── Shared helper ──────────────────────────────────────────────────────────
  private async confirmBooking(transaction: any, bookingStatus: string) {
    if (transaction.bookingId) {
      await this.prisma.booking.update({
        where: { id: transaction.bookingId },
        data: { status: bookingStatus as any },
      });
    } else if (transaction.pitchBookingId) {
      await this.prisma.pitchBooking.update({
        where: { id: transaction.pitchBookingId },
        data: { status: bookingStatus as any },
      });
    }
  }
}
