import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpsertTeamDto } from './dto/upsert-team.dto';

@Injectable()
export class LeaguesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.league.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, season: true },
    });
  }

  async getStandings(leagueId: string) {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        teams: {
          orderBy: [{ points: 'desc' }, { goalsFor: 'desc' }],
        },
      },
    });

    if (!league) throw new NotFoundException('Lig bulunamadı.');
    return league;
  }

  async createLeague(dto: CreateLeagueDto) {
    return this.prisma.league.create({ data: dto });
  }

  async upsertTeam(leagueId: string, dto: UpsertTeamDto) {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('Lig bulunamadı.');

    return this.prisma.team.upsert({
      where: {
        // Takım adı + lig kombinasyonu unique sayıyoruz
        id: dto.teamId ?? 'new',
      },
      create: { leagueId, ...dto },
      update: { ...dto },
    });
  }

  async updateTeam(teamId: string, data: Partial<UpsertTeamDto>) {
    return this.prisma.team.update({ where: { id: teamId }, data });
  }

  async deleteLeague(id: string) {
    return this.prisma.league.delete({ where: { id } });
  }
}
