import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async findMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        preferredPositions: true,
        _count: {
          select: {
            bookings: true,
            ratingsReceived: true,
          },
        },
      },
    });
    return user;
  }

  async updateMe(userId: string, dto: UpdateUserDto) {
    const updateData: any = { ...dto };
    if (dto.dateOfBirth) {
      updateData.dateOfBirth = new Date(dto.dateOfBirth);
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<{ avatarUrl: string }> {
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'avatars', public_id: `user_${userId}`, overwrite: true },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      uploadStream.end(file.buffer);
    });

    const avatarUrl = uploadResult.secure_url;
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return { avatarUrl };
  }

  async getMyBookings(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where: { userId },
        include: {
          match: {
            include: {
              pitch: { select: { name: true, addressLine: true, district: true } },
            },
          },
          transaction: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.booking.count({ where: { userId } }),
    ]);

    return { data: bookings, total, page, limit };
  }

  async getMyStats(userId: string) {
    const now = new Date();
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last365d = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const [total, last7Days, last30Days, lastYear, thumbsUp, thumbsDown, user] =
      await Promise.all([
        this.prisma.booking.count({ where: { userId, status: 'COMPLETED' } }),
        this.prisma.booking.count({
          where: { userId, status: 'COMPLETED', createdAt: { gte: last7d } },
        }),
        this.prisma.booking.count({
          where: { userId, status: 'COMPLETED', createdAt: { gte: last30d } },
        }),
        this.prisma.booking.count({
          where: { userId, status: 'COMPLETED', createdAt: { gte: last365d } },
        }),
        this.prisma.playerRating.count({ where: { ratedId: userId, thumbsUp: true } }),
        this.prisma.playerRating.count({ where: { ratedId: userId, thumbsUp: false } }),
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { eloRating: true, reliabilityScore: true, skillLevel: true },
        }),
      ]);

    return {
      gamesPlayed: { total, last7Days, last30Days, lastYear },
      ratings: { thumbsUp, thumbsDown, total: thumbsUp + thumbsDown },
      eloRating: user?.eloRating,
      reliabilityScore: user?.reliabilityScore,
      skillLevel: user?.skillLevel,
    };
  }

  async getMyNotifications(userId: string, page = 1) {
    const limit = 20;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return { data: notifications, total, page, limit };
  }

  async markNotificationRead(userId: string, notifId: string) {
    const notif = await this.prisma.notification.findFirst({
      where: { id: notifId, userId },
    });
    if (!notif) throw new NotFoundException('Notification not found');

    return this.prisma.notification.update({
      where: { id: notifId },
      data: { isRead: true },
    });
  }

  async setPreferredPositions(
    userId: string,
    positions: { position: string; isPrimary: boolean }[],
  ) {
    await this.prisma.userPosition.deleteMany({ where: { userId } });

    if (positions.length > 0) {
      await this.prisma.userPosition.createMany({
        data: positions.map((p) => ({
          userId,
          position: p.position as any,
          isPrimary: p.isPrimary,
        })),
      });
    }

    return this.prisma.userPosition.findMany({ where: { userId } });
  }

  async getPublicProfile(targetId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        bio: true,
        eloRating: true,
        reliabilityScore: true,
        skillLevel: true,
        city: true,
        createdAt: true,
        preferredPositions: true,
        _count: {
          select: {
            bookings: true,
            ratingsReceived: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const [thumbsUp, thumbsDown] = await Promise.all([
      this.prisma.playerRating.count({ where: { ratedId: targetId, thumbsUp: true } }),
      this.prisma.playerRating.count({ where: { ratedId: targetId, thumbsUp: false } }),
    ]);

    const recentMatches = await this.prisma.booking.findMany({
      where: { userId: targetId, status: 'COMPLETED' },
      include: {
        match: {
          select: {
            id: true,
            title: true,
            sport: true,
            startTime: true,
            pitch: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      ...user,
      ratings: { thumbsUp, thumbsDown },
      recentMatches,
    };
  }

  async applyReferral(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.referredBy) {
      throw new BadRequestException('Referral already applied');
    }

    const referrer = await this.prisma.user.findFirst({
      where: { referralCode: code },
    });

    if (!referrer) throw new NotFoundException('Referral code not found');
    if (referrer.id === userId) throw new BadRequestException('Cannot refer yourself');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          referredBy: referrer.id,
          credit: { increment: 50000 },
        },
      }),
      this.prisma.user.update({
        where: { id: referrer.id },
        data: { credit: { increment: 50000 } },
      }),
    ]);

    return { message: 'Referral applied. 50,000 UZS credit added to both accounts.' };
  }
}
