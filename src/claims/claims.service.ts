import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClaimsService {
  constructor(private readonly prisma: PrismaService) {}

  async startClaim(userId: string, playerId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) throw new NotFoundException('Kullanıcı bulunamadı.');
    if (user.role !== 'premium') {
      throw new ForbiddenException('Profil talep etmek için premium üye olmanız gerekiyor.');
    }

    // 3 hak kontrolü
    if (user.claimAttempts >= 3) {
      throw new BadRequestException(
        'Maksimum profil talep hakkınızı (3) kullandınız.',
      );
    }

    // Zaten aktif claim var mı?
    const activeClaim = await this.prisma.claimRequest.findFirst({
      where: {
        userId,
        status: { in: ['pending_identity', 'pending_admin_review'] },
      },
    });

    if (activeClaim) {
      throw new BadRequestException(
        'Zaten aktif bir profil talebiniz var. Lütfen sonucunu bekleyin.',
      );
    }

    // Oyuncu mevcut mu ve daha önce alınmış mı?
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });

    if (!player) throw new NotFoundException('Oyuncu bulunamadı.');
    if (player.isClaimed) {
      throw new BadRequestException('Bu profil zaten başka bir kullanıcı tarafından alınmış.');
    }

    // Claim oluştur + attempt artır
    const [claimRequest] = await this.prisma.$transaction([
      this.prisma.claimRequest.create({
        data: { userId, playerId, status: 'pending_identity' },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          claimAttempts: { increment: 1 },
          verificationStatus: 'pending_identity',
        },
      }),
    ]);

    return {
      message: 'Profil talebi başlatıldı. Kimlik doğrulaması yapmanız gerekiyor.',
      claimRequestId: claimRequest.id,
      nextStep: 'identity_verification',
    };
  }

  async getMyClaim(userId: string) {
    return this.prisma.claimRequest.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        player: {
          select: { firstName: true, lastName: true, club: true, position: true },
        },
      },
    });
  }

  async updateCustomData(userId: string, playerId: string, data: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.role !== 'premium') {
      throw new ForbiddenException('Premium üyelik gerekiyor.');
    }

    if (user.claimedPlayerId !== playerId || user.verificationStatus !== 'approved') {
      throw new ForbiddenException('Bu profili düzenleme yetkiniz yok.');
    }

    return this.prisma.playerCustomData.upsert({
      where: { playerId },
      create: { playerId, ...data },
      update: data,
    });
  }
}
