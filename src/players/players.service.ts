import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchPlayersDto } from './dto/search-players.dto';
import { Role } from '@prisma/client';

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchPlayersDto, userRole?: Role) {
    const { name, position, club, teamId, league, birthYear, page = 1, limit = 20 } = dto;
    const pageNum  = Number(page)  || 1;
    const limitNum = Number(limit) || 20;
    const skip     = (pageNum - 1) * limitNum;

    const where: any = {};

    if (name) {
      const parts = name.trim().split(' ');
      where.OR = [
        { firstName: { contains: name, mode: 'insensitive' } },
        { lastName:  { contains: name, mode: 'insensitive' } },
        ...(parts.length > 1
          ? [{
              AND: [
                { firstName: { contains: parts[0], mode: 'insensitive' } },
                { lastName:  { contains: parts[1], mode: 'insensitive' } },
              ],
            }]
          : []),
      ];
    }

    if (position) where.position = { equals: position, mode: 'insensitive' };

    if (teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        include: { league: true },
      });

      if (team) {
        // Takım adı: exact + case-insensitive
        where.club = { equals: team.name, mode: 'insensitive' };

        // ✅ KRİTİK DÜZELTME:
        // Team.league.name = "U14 Gelişim Ligi — 1.GRUP"  (grup eki var)
        // Player.league    = "U14 Gelişim Ligi"            (grup eki yok)
        //
        // Çözüm: " — " ile ayır, sadece lig adının base kısmını al.
        // "U14 Gelişim Ligi — 1.GRUP" → "U14 Gelişim Ligi"
        // "U19 PAF Ligi" → "U19 PAF Ligi" (değişmez, — yoksa)
        const leagueBaseName = team.league.name.split(' — ')[0].trim();

        // Player.league "U14 Gelişim Ligi" içeriyor mu? (contains + insensitive)
        where.league = { contains: leagueBaseName, mode: 'insensitive' };
      } else {
        return {
          data: [],
          meta: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 },
        };
      }
    } else {
      if (club)   where.club   = { equals: club,    mode: 'insensitive' };
      if (league) where.league = { contains: league, mode: 'insensitive' };
    }

    if (birthYear) where.birthYear = birthYear;

    const [players, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ isClaimed: 'desc' }, { lastName: 'asc' }],
        include: { customData: true },
      }),
      this.prisma.player.count({ where }),
    ]);

    return {
      data: players.map((p) => this.sanitizePlayer(p, userRole)),
      meta: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async findOne(id: string, userRole?: Role) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        customData: {
          include: {
            monthlySnapshots: {
              orderBy: [{ year: 'asc' }, { month: 'asc' }],
            },
          },
        },
      },
    });

    if (!player) throw new NotFoundException('Oyuncu bulunamadı.');

    const nextMatch = await this.prisma.match.findFirst({
      where: {
        homeScore: null,
        OR: [
          { homeTeam: { name: { equals: player.club, mode: 'insensitive' } } },
          { awayTeam: { name: { equals: player.club, mode: 'insensitive' } } },
        ],
      },
      include: { homeTeam: true, awayTeam: true, league: true },
      orderBy: { weekNumber: 'asc' },
    });

    return { ...this.sanitizePlayer(player, userRole), nextMatch: nextMatch || null };
  }

  async findUnclaimedForUser() {
    return this.prisma.player.findMany({
      where: { isClaimed: false },
      select: {
        id: true, firstName: true, lastName: true,
        birthYear: true, club: true, league: true, position: true,
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async upsertFromTff(players: any[]) {
    const results = { created: 0, updated: 0, errors: 0 };

    for (const p of players) {
      try {
        if (!p.tffId) { results.errors++; continue; }

        const existing = await this.prisma.player.findUnique({ where: { tffId: p.tffId } });

        if (existing) {
          await this.prisma.player.update({
            where: { tffId: p.tffId },
            data: {
              firstName:     p.firstName     ?? existing.firstName,
              lastName:      p.lastName      ?? existing.lastName,
              club:          p.club          ?? existing.club,
              league:        p.league        ?? existing.league,
              position:      p.position      ?? existing.position,
              birthYear:     p.birthYear     ?? existing.birthYear,
              matches:       p.matches       ?? existing.matches,
              goals:         p.goals         ?? existing.goals,
              assists:       p.assists       ?? existing.assists,
              minutesPlayed: p.minutesPlayed ?? existing.minutesPlayed,
              starts:        p.starts        ?? existing.starts,
              yellowCards:   p.yellowCards   ?? existing.yellowCards,
              redCards:      p.redCards      ?? existing.redCards,
              ...(p.careerHistory !== undefined && { careerHistory: p.careerHistory }),
            },
          });
          results.updated++;
        } else {
          await this.prisma.player.create({
            data: {
              tffId:         p.tffId,
              firstName:     p.firstName    || '',
              lastName:      p.lastName     || '',
              birthYear:     p.birthYear    || 0,
              club:          p.club         || '',
              league:        p.league       || '',
              position:      p.position     || 'Forvet',
              matches:       p.matches      ?? 0,
              goals:         p.goals        ?? 0,
              assists:       p.assists      ?? 0,
              minutesPlayed: p.minutesPlayed ?? 0,
              starts:        p.starts       ?? 0,
              yellowCards:   p.yellowCards  ?? 0,
              redCards:      p.redCards     ?? 0,
              ...(p.careerHistory !== undefined && { careerHistory: p.careerHistory }),
            },
          });
          results.created++;
        }
      } catch (e) {
        results.errors++;
      }
    }

    return results;
  }

  async takeSnapshotsForUpdated(tffIds: string[]) {
    for (const tffId of tffIds) {
      const player = await this.prisma.player.findUnique({
        where: { tffId },
        include: { customData: true },
      });
      if (!player || !player.isClaimed) continue;

      let customData = player.customData;
      if (!customData) {
        customData = await this.prisma.playerCustomData.create({ data: { playerId: player.id } });
      }

      const now   = new Date();
      const year  = now.getFullYear();
      const month = now.getMonth() + 1;

      await this.prisma.playerMonthlySnapshot.upsert({
        where: { playerId_year_month: { playerId: player.id, year, month } },
        create: {
          playerId: player.id, customDataId: customData.id, year, month,
          matches: player.matches, goals: player.goals, assists: player.assists,
          minutesPlayed: player.minutesPlayed, starts: player.starts,
          yellowCards: player.yellowCards, redCards: player.redCards,
        },
        update: {
          matches: player.matches, goals: player.goals, assists: player.assists,
          minutesPlayed: player.minutesPlayed, starts: player.starts,
          yellowCards: player.yellowCards, redCards: player.redCards,
        },
      }).catch(() => {});
    }
  }

  private sanitizePlayer(player: any, userRole?: Role) {
    return player;
  }
}
