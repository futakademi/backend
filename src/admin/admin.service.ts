import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlayersService } from '../players/players.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly playersService: PlayersService,
  ) {}

  // ── CLAIM YÖNETİMİ ──────────────────────────────────────────

  async getPendingClaims() {
    return this.prisma.claimRequest.findMany({
      where: { status: 'pending_admin_review' },
      include: {
        user: {
          select: { id: true, email: true, verificationStatus: true },
          include: {
            identityVerifications: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { firstName: true, lastName: true, birthYear: true, nviResult: true },
            },
          },
        },
        player: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            birthYear: true,
            club: true,
            position: true,
            league: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveClaim(claimId: string, adminId: string) {
    const claim = await this.prisma.claimRequest.findUnique({
      where: { id: claimId },
      include: { player: true, user: true },
    });

    if (!claim) throw new NotFoundException('Talep bulunamadı.');
    if (claim.status !== 'pending_admin_review') {
      throw new BadRequestException('Bu talep zaten işleme alınmış.');
    }
    if (claim.player.isClaimed) {
      throw new BadRequestException('Bu oyuncu profili zaten başka biri tarafından alınmış.');
    }

    await this.prisma.$transaction([
      this.prisma.claimRequest.update({
        where: { id: claimId },
        data: { status: 'approved', reviewedAt: new Date() },
      }),
      this.prisma.player.update({
        where: { id: claim.playerId },
        data: { isClaimed: true, claimedById: claim.userId },
      }),
      this.prisma.user.update({
        where: { id: claim.userId },
        data: {
          claimedPlayerId: claim.playerId,
          verificationStatus: 'approved',
        },
      }),
      this.prisma.adminAuditLog.create({
        data: {
          adminId,
          action: 'CLAIM_APPROVED',
          targetType: 'ClaimRequest',
          targetId: claimId,
          meta: { playerId: claim.playerId, userId: claim.userId },
        },
      }),
    ]);

    return { message: 'Profil talebi onaylandı.' };
  }

  async rejectClaim(claimId: string, adminId: string, reason?: string) {
    const claim = await this.prisma.claimRequest.findUnique({ where: { id: claimId } });
    if (!claim) throw new NotFoundException('Talep bulunamadı.');
    if (claim.status !== 'pending_admin_review') {
      throw new BadRequestException('Bu talep zaten işleme alınmış.');
    }

    await this.prisma.$transaction([
      this.prisma.claimRequest.update({
        where: { id: claimId },
        data: { status: 'rejected', reviewedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: claim.userId },
        data: { verificationStatus: 'rejected' },
      }),
      this.prisma.adminAuditLog.create({
        data: {
          adminId,
          action: 'CLAIM_REJECTED',
          targetType: 'ClaimRequest',
          targetId: claimId,
          meta: { reason, userId: claim.userId },
        },
      }),
    ]);

    return { message: 'Profil talebi reddedildi.' };
  }

  // ── KULLANICI YÖNETİMİ ──────────────────────────────────────

  async getUsers(page = 1, limit = 50, role?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          verificationStatus: true,
          claimAttempts: true,
          subscriptionEnd: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { data: users, meta: { total, page, limit } };
  }

  async setUserRole(userId: string, role: string, adminId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: { id: true, email: true, role: true },
    });

    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'USER_ROLE_CHANGED',
        targetType: 'User',
        targetId: userId,
        meta: { newRole: role },
      },
    });

    return user;
  }

  // ── TFF IMPORT ──────────────────────────────────────────────

  async importPlayers(players: any[], adminId: string) {
    const result = await this.playersService.upsertFromTff(players);

    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'TFF_IMPORT',
        targetType: 'Player',
        targetId: 'bulk',
        meta: result,
      },
    });

    return result;
  }

  // ── AUDIT LOG ───────────────────────────────────────────────

  async getAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminAuditLog.count(),
    ]);
    return { data: logs, meta: { total, page, limit } };
  }

  // ── DASHBOARD ───────────────────────────────────────────────

  async getDashboardStats() {
    const [
      totalUsers,
      premiumUsers,
      totalPlayers,
      claimedPlayers,
      pendingClaims,
      totalPosts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'premium' } }),
      this.prisma.player.count(),
      this.prisma.player.count({ where: { isClaimed: true } }),
      this.prisma.claimRequest.count({ where: { status: 'pending_admin_review' } }),
      this.prisma.post.count({ where: { status: 'published' } }),
    ]);

    return {
      totalUsers,
      premiumUsers,
      totalPlayers,
      claimedPlayers,
      pendingClaims,
      totalPosts,
    };
  }
}
