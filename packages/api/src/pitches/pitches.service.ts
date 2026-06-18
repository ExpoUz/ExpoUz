import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePitchDto } from './dto/create-pitch.dto';
import { UpdatePitchDto } from './dto/update-pitch.dto';
import { v2 as cloudinary } from 'cloudinary';

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

@Injectable()
export class PitchesService {
  constructor(private prisma: PrismaService) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async findAll(filters: {
    sport?: string;
    city?: string;
    district?: string;
    isIndoor?: boolean;
    surfaceType?: string;
    pitchSize?: string;
    isVerified?: boolean;
  }) {
    const where: any = { isActive: true };
    if (filters.sport) where.sport = filters.sport;
    if (filters.city) where.city = filters.city;
    if (filters.district) where.district = filters.district;
    if (filters.isIndoor !== undefined) where.isIndoor = filters.isIndoor;
    if (filters.surfaceType) where.surfaceType = filters.surfaceType;
    if (filters.pitchSize) where.pitchSize = filters.pitchSize;
    if (filters.isVerified !== undefined) where.isVerified = filters.isVerified;

    return this.prisma.pitch.findMany({
      where,
      include: {
        amenities: true,
        _count: { select: { matches: true, followers: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findNearby(lat: number, lng: number, radiusKm = 5) {
    const pitches = await this.prisma.pitch.findMany({
      where: { isActive: true },
      include: {
        amenities: true,
        _count: { select: { matches: true } },
      },
    });

    const withDistance = pitches
      .map((pitch) => ({
        ...pitch,
        distance: haversine(lat, lng, pitch.lat, pitch.lng),
      }))
      .filter((p) => p.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    return withDistance;
  }

  async findOne(id: string) {
    const pitch = await this.prisma.pitch.findUnique({
      where: { id },
      include: {
        amenities: true,
        owner: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, phone: true },
        },
        matches: {
          where: { status: { in: ['OPEN', 'FULL'] }, startTime: { gt: new Date() } },
          include: {
            host: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { startTime: 'asc' },
          take: 10,
        },
        _count: { select: { followers: true, matches: true } },
      },
    });

    if (!pitch) throw new NotFoundException('Pitch not found');
    return pitch;
  }

  async create(ownerId: string, dto: CreatePitchDto) {
    const { amenities, ...pitchData } = dto;

    return this.prisma.$transaction(async (tx) => {
      const pitch = await tx.pitch.create({
        data: {
          ...pitchData,
          ownerId,
          hourlyRate: pitchData.hourlyRate,
        },
      });

      if (amenities && amenities.length > 0) {
        await tx.amenity.createMany({
          data: amenities.map((type) => ({ pitchId: pitch.id, type })),
        });
      }

      return tx.pitch.findUnique({
        where: { id: pitch.id },
        include: { amenities: true },
      });
    });
  }

  async update(id: string, ownerId: string, dto: UpdatePitchDto) {
    const pitch = await this.prisma.pitch.findUnique({ where: { id } });
    if (!pitch || pitch.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this pitch');
    }

    const { amenities, ...updateData } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (amenities !== undefined) {
        await tx.amenity.deleteMany({ where: { pitchId: id } });
        if (amenities.length > 0) {
          await tx.amenity.createMany({
            data: amenities.map((type) => ({ pitchId: id, type })),
          });
        }
      }

      return tx.pitch.update({
        where: { id },
        data: updateData,
        include: { amenities: true },
      });
    });
  }

  async uploadPhotos(id: string, ownerId: string, files: Express.Multer.File[]) {
    const pitch = await this.prisma.pitch.findUnique({ where: { id } });
    if (!pitch || pitch.ownerId !== ownerId) {
      throw new ForbiddenException('You do not own this pitch');
    }

    const uploadPromises = files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'pitches', public_id: `pitch_${id}_${Date.now()}` },
            (error, result) => {
              if (error) reject(error);
              else resolve(result.secure_url);
            },
          );
          uploadStream.end(file.buffer);
        }),
    );

    const urls = await Promise.all(uploadPromises);

    return this.prisma.pitch.update({
      where: { id },
      data: { photos: { push: urls } },
    });
  }

  async follow(pitchId: string, userId: string) {
    return this.prisma.pitchFollower.upsert({
      where: { pitchId_userId: { pitchId, userId } },
      update: {},
      create: { pitchId, userId },
    });
  }

  async unfollow(pitchId: string, userId: string) {
    await this.prisma.pitchFollower.delete({
      where: { pitchId_userId: { pitchId, userId } },
    });
    return { message: 'Unfollowed successfully' };
  }

  async verify(id: string, approved: boolean, reason?: string) {
    return this.prisma.pitch.update({
      where: { id },
      data: {
        isVerified: approved,
        rejectionReason: approved ? null : reason,
      },
    });
  }

  async getAnalytics(id: string, ownerId: string) {
    const pitch = await this.prisma.pitch.findUnique({ where: { id } });
    if (!pitch || pitch.ownerId !== ownerId) {
      throw new ForbiddenException('Access denied');
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const matches = await this.prisma.match.findMany({
      where: { pitchId: id },
      select: { id: true },
    });
    const matchIds = matches.map((m) => m.id);

    const [totalRevenue, thisMonthRevenue, bookingCount, thisMonthBookings] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          booking: { matchId: { in: matchIds } },
          status: { in: ['HELD', 'RELEASED'] },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          booking: { matchId: { in: matchIds } },
          status: { in: ['HELD', 'RELEASED'] },
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.booking.count({
        where: { matchId: { in: matchIds }, status: 'CONFIRMED' },
      }),
      this.prisma.booking.count({
        where: {
          matchId: { in: matchIds },
          status: 'CONFIRMED',
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

    return {
      totalRevenue: totalRevenue._sum.amount || 0,
      thisMonthRevenue: thisMonthRevenue._sum.amount || 0,
      bookingCount,
      thisMonthBookings,
      avgOccupancy:
        matches.length > 0
          ? Math.round((bookingCount / (matches.length * 14)) * 100)
          : 0,
    };
  }
}
