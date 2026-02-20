import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchPlayersDto } from './dto/search-players.dto';
import { Role } from '@prisma/client';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchPlayersDto, userRole?: Role) {
    const { name, position, club, league, birthYear, page = 1, limit = 20 } = dto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (name) {
      const parts = name.trim().split(' ');
      where.OR = [
        { firstName: { contains: name, mode: 'insensitive' } },
        { lastName: { contains: name, mode: 'insensitive' } },
        ...(parts.length > 1
          ? [
              {
                AND: [
                  { firstName: { contains: parts[0], mode: 'insensitive' } },
                  { lastName: { contains: parts[1], mode: 'insensitive' } },
                ],
              },
            ]
          : []),
      ];
    }

    if (position) where.position = { equals: position, mode: 'insensitive' };
    if (club) where.club = { contains: club, mode: 'insensitive' };
    if (league) where.league = { contains: league, mode: 'insensitive' };
    if (birthYear) where.birthYear = birthYear;

    const [players, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          // Premium oyuncular öne çıkar
          { isClaimed: 'desc' },
          { lastName: 'asc' },
        ],
        include: {
          customData: userRole === 'premium' || userRole === 'admin',
        },
      }),
      this.prisma.player.count({ where }),
    ]);

    // Free kullanıcılara premium içerik gösterilmez
    const sanitized = players.map((p) => this.sanitizePlayer(p, userRole));

    return {
      data: sanitized,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userRole?: Role) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: { customData: true },
    });

    if (!player) throw new NotFoundException('Oyuncu bulunamadı.');

    return this.sanitizePlayer(player, userRole);
  }

  async findUnclaimedForUser() {
    return this.prisma.player.findMany({
      where: { isClaimed: false },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthYear: true,
        club: true,
        league: true,
        position: true,
      },
      orderBy: { lastName: 'asc' },
    });
  }

  // TFF import - upsert mantığı
  async upsertFromTff(players: any[]) {
    const results = { created: 0, updated: 0, errors: 0 };

    for (const p of players) {
      try {
        const existing = await this.prisma.player.findUnique({
          where: { tffId: p.tffId },
        });

        if (existing) {
          await this.prisma.player.update({
            where: { tffId: p.tffId },
            data: {
              firstName: p.firstName,
              lastName: p.lastName,
              club: p.club,
              league: p.league,
              position: p.position,
              matches: p.matches ?? existing.matches,
              goals: p.goals ?? existing.goals,
              assists: p.assists ?? existing.assists,
            },
          });
          results.updated++;
        } else {
          await this.prisma.player.create({ data: p });
          results.created++;
        }
      } catch {
        results.errors++;
      }
    }

    return results;
  }

  private sanitizePlayer(player: any, userRole?: Role) {
    const isPrivileged = userRole === 'premium' || userRole === 'admin';

    // Premium içerik: kullanıcı premium değilse customData gizlenir
    const claimedUserIsPremium = player.isClaimed; // Backend'de claimed user'ın rolü kontrol edilebilir
    // Basit kural: customData yalnızca premium/admin görür
    if (!isPrivileged) {
      return { ...player, customData: null };
    }

    return player;
  }
}
