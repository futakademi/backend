import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateMatchDto {
  weekNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number | null;
  awayScore?: number | null;
  playedAt?: string | null;
  venue?: string | null;
}

export interface UpdateMatchDto {
  homeScore?: number | null;
  awayScore?: number | null;
  playedAt?: string | null;
  venue?: string | null;
  weekNumber?: number;
}

export interface GenerateFixturesDto {
  startDate?: string; // ISO date string for week 1
  daysBetweenWeeks?: number; // default 7
}

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bir ligin kaç haftası var — hafta numaralarını döndür */
  async getWeeks(leagueId: string): Promise<number[]> {
    await this.assertLeagueExists(leagueId);
    const rows = await this.prisma.match.findMany({
      where: { leagueId },
      select: { weekNumber: true },
      distinct: ['weekNumber'],
      orderBy: { weekNumber: 'asc' },
    });
    return rows.map((r) => r.weekNumber);
  }

  /**
   * Belirli bir haftanın maçları + o haftaya kadar birikimli puan durumu.
   * Puan durumu her zaman seçilen haftaya kadar oynanmış maçlardan hesaplanır.
   */
  async getWeekData(leagueId: string, week: number) {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { id: true, name: true, season: true },
    });
    if (!league) throw new NotFoundException('Lig bulunamadı.');

    // Bu haftanın maçları (fikstür/sonuç)
    const matches = await this.prisma.match.findMany({
      where: { leagueId, weekNumber: week },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
      orderBy: [{ playedAt: 'asc' }, { createdAt: 'asc' }],
    });

    // Bu haftaya kadar (hafta dahil) oynanmış tüm maçlardan puan hesapla
    const playedMatches = await this.prisma.match.findMany({
      where: {
        leagueId,
        weekNumber: { lte: week },
        homeScore: { not: null },
        awayScore: { not: null },
      },
    });

    // Tüm takımları al
    const teams = await this.prisma.team.findMany({
      where: { leagueId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Puan tablosu hesapla
    const table: Record<string, {
      id: string; name: string;
      played: number; win: number; draw: number; loss: number;
      goalsFor: number; goalsAgainst: number; points: number;
    }> = {};

    for (const t of teams) {
      table[t.id] = {
        id: t.id, name: t.name,
        played: 0, win: 0, draw: 0, loss: 0,
        goalsFor: 0, goalsAgainst: 0, points: 0,
      };
    }

    for (const m of playedMatches) {
      if (m.homeScore === null || m.awayScore === null) continue;
      const home = table[m.homeTeamId];
      const away = table[m.awayTeamId];
      if (!home || !away) continue;

      home.played++; away.played++;
      home.goalsFor  += m.homeScore; home.goalsAgainst += m.awayScore;
      away.goalsFor  += m.awayScore; away.goalsAgainst += m.homeScore;

      if (m.homeScore > m.awayScore) {
        home.win++;  home.points += 3; away.loss++;
      } else if (m.homeScore < m.awayScore) {
        away.win++;  away.points += 3; home.loss++;
      } else {
        home.draw++; away.draw++; home.points++; away.points++;
      }
    }

    const standings = Object.values(table).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const avA = a.goalsFor - a.goalsAgainst;
      const avB = b.goalsFor - b.goalsAgainst;
      if (avB !== avA) return avB - avA;
      return b.goalsFor - a.goalsFor;
    });

    // En son oynanmış hafta numarasını bul (tüm ligde)
    const lastPlayedRow = await this.prisma.match.findFirst({
      where: { leagueId, homeScore: { not: null }, awayScore: { not: null } },
      orderBy: { weekNumber: 'desc' },
      select: { weekNumber: true },
    });

    return {
      leagueId:        league.id,
      leagueName:      league.name,
      season:          league.season,
      weekNumber:      week,
      lastPlayedWeek:  lastPlayedRow?.weekNumber ?? null,
      matches,
      standings,
    };
  }

  /** Admin: tek maç ekle */
  async createMatch(leagueId: string, dto: CreateMatchDto) {
    await this.assertLeagueExists(leagueId);
    if (dto.homeTeamId === dto.awayTeamId) {
      throw new BadRequestException('Ev sahibi ve deplasman takımı aynı olamaz.');
    }
    await this.assertTeamInLeague(dto.homeTeamId, leagueId, 'Ev sahibi');
    await this.assertTeamInLeague(dto.awayTeamId, leagueId, 'Deplasman');

    return this.prisma.match.create({
      data: {
        leagueId,
        weekNumber: dto.weekNumber,
        homeTeamId: dto.homeTeamId,
        awayTeamId: dto.awayTeamId,
        homeScore:  dto.homeScore  ?? null,
        awayScore:  dto.awayScore  ?? null,
        playedAt:   dto.playedAt   ? new Date(dto.playedAt) : null,
        venue:      dto.venue      ?? null,
      },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    });
  }

  /** Admin: skor / tarih güncelle */
  async updateMatch(matchId: string, dto: UpdateMatchDto) {
    const existing = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!existing) throw new NotFoundException('Maç bulunamadı.');

    return this.prisma.match.update({
      where: { id: matchId },
      data: {
        homeScore:  dto.homeScore  !== undefined ? dto.homeScore  : existing.homeScore,
        awayScore:  dto.awayScore  !== undefined ? dto.awayScore  : existing.awayScore,
        playedAt:   dto.playedAt   !== undefined ? (dto.playedAt ? new Date(dto.playedAt) : null) : existing.playedAt,
        venue:      dto.venue      !== undefined ? dto.venue      : existing.venue,
        weekNumber: dto.weekNumber !== undefined ? dto.weekNumber : existing.weekNumber,
      },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
    });
  }

  /** Admin: maç sil */
  async deleteMatch(matchId: string) {
    const existing = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!existing) throw new NotFoundException('Maç bulunamadı.');
    return this.prisma.match.delete({ where: { id: matchId } });
  }

  /**
   * Admin: Round-robin fikstür otomatik oluştur.
   * Mevcut maçları siler, tüm haftaları yeniden oluşturur.
   */
  async generateFixtures(leagueId: string, dto: GenerateFixturesDto) {
    await this.assertLeagueExists(leagueId);

    const teams = await this.prisma.team.findMany({
      where: { leagueId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (teams.length < 2) {
      throw new BadRequestException('Fikstür için en az 2 takım gereklidir.');
    }

    // Mevcut maçları sil
    await this.prisma.match.deleteMany({ where: { leagueId } });

    // Çift sayı için BYE ekle
    const list = [...teams] as Array<{ id: string; name: string }>;
    const hasBye = list.length % 2 !== 0;
    if (hasBye) list.push({ id: '__bye__', name: 'BYE' });

    const n      = list.length;
    const rounds = n - 1;
    const perRound = n / 2;
    const daysBetween = dto.daysBetweenWeeks ?? 7;
    const baseDate = dto.startDate ? new Date(dto.startDate) : null;

    const created: any[] = [];

    for (let round = 0; round < rounds; round++) {
      const weekNumber = round + 1;
      const weekDate   = baseDate
        ? new Date(baseDate.getTime() + round * daysBetween * 86400000)
        : null;

      for (let i = 0; i < perRound; i++) {
        const home = list[i];
        const away = list[n - 1 - i];
        if (home.id === '__bye__' || away.id === '__bye__') continue;

        const match = await this.prisma.match.create({
          data: {
            leagueId,
            weekNumber,
            homeTeamId: home.id,
            awayTeamId: away.id,
            playedAt:   weekDate,
          },
        });
        created.push(match);
      }

      // Döngüsel kaydırma (ilk eleman sabit)
      const last = list.pop()!;
      list.splice(1, 0, last);
    }

    return { weeksCreated: rounds, matchesCreated: created.length };
  }

  // ── PRIVATE ──
  private async assertLeagueExists(leagueId: string) {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('Lig bulunamadı.');
    return league;
  }

  private async assertTeamInLeague(teamId: string, leagueId: string, label: string) {
    const team = await this.prisma.team.findFirst({ where: { id: teamId, leagueId } });
    if (!team) throw new NotFoundException(`${label} takımı bu ligde bulunamadı.`);
    return team;
  }
}
