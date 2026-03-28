import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class SubscriptionMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    try {
      const token = authHeader.split(' ')[1];
      const payload = this.jwtService.verify(token);

      if (payload?.sub) {
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
          select: { id: true, role: true, subscriptionEnd: true },
        });

        if (
          user &&
          user.role === 'premium' &&
          user.subscriptionEnd &&
          new Date() > user.subscriptionEnd
        ) {
          // Premium süresi dolmuş, free'ye düşür
          await this.prisma.user.update({
            where: { id: user.id },
            data: { role: 'free' },
          });
          // claimedPlayerId korunur, sadece rol düşer
        }
      }
    } catch {
      // Token geçersizse middleware sessizce devam eder, guard handle eder
    }

    next();
  }
}
