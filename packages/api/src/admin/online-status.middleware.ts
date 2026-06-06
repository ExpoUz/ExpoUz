import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

/**
 * Runs after every authenticated request and upserts a UserSession row
 * so we can track who is online (lastSeenAt within the last 5 minutes).
 * Non-blocking: errors are silently swallowed so they never affect the request.
 */
@Injectable()
export class OnlineStatusMiddleware implements NestMiddleware {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  use(req: Request, _res: Response, next: NextFunction) {
    // Extract Bearer token without throwing
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const payload = this.jwtService.verify(token) as any;
        const userId: string = payload?.sub ?? payload?.id;
        if (userId) {
          const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            ?? req.socket?.remoteAddress;
          const ua = req.headers['user-agent']?.slice(0, 200);

          // Fire-and-forget — do not await
          this.prisma.userSession
            .upsert({
              where: { userId },
              update: { lastSeenAt: new Date(), ipAddress: ip, deviceInfo: ua },
              create: { userId, ipAddress: ip, deviceInfo: ua },
            })
            .catch(() => {});
        }
      } catch {
        // Invalid / expired token — ignore, let auth guard handle it
      }
    }

    next();
  }
}
