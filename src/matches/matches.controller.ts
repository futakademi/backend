import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { MatchesService, CreateMatchDto, UpdateMatchDto, GenerateFixturesDto } from './matches.service';
import { JwtAuthGuard }  from '../common/guards/jwt-auth.guard';
import { RolesGuard }    from '../common/guards/roles.guard';
import { Roles }         from '../common/decorators/roles.decorator';
import { Public }        from '../common/decorators/public.decorator';

@Controller('leagues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  // ── PUBLIC ──────────────────────────────────────────────────────
  /** GET /api/v1/leagues/:id/weeks → [1, 2, 3, ...] */
  @Public()
  @Get(':id/weeks')
  getWeeks(@Param('id') leagueId: string) {
    return this.matchesService.getWeeks(leagueId);
  }

  /** GET /api/v1/leagues/:id/weeks/:week → { matches, standings, lastPlayedWeek } */
  @Public()
  @Get(':id/weeks/:week')
  getWeekData(
    @Param('id')                       leagueId: string,
    @Param('week', ParseIntPipe) week: number,
  ) {
    return this.matchesService.getWeekData(leagueId, week);
  }

  // ── ADMIN ────────────────────────────────────────────────────────
  /** POST /api/v1/leagues/:id/matches → maç ekle */
  @Post(':id/matches')
  @Roles('admin')
  createMatch(
    @Param('id')    leagueId: string,
    @Body()         dto: CreateMatchDto,
  ) {
    return this.matchesService.createMatch(leagueId, dto);
  }

  /** PUT /api/v1/leagues/matches/:matchId → skor/tarih güncelle */
  @Put('matches/:matchId')
  @Roles('admin')
  updateMatch(
    @Param('matchId') matchId: string,
    @Body()           dto: UpdateMatchDto,
  ) {
    return this.matchesService.updateMatch(matchId, dto);
  }

  /** DELETE /api/v1/leagues/matches/:matchId → maç sil */
  @Delete('matches/:matchId')
  @Roles('admin')
  deleteMatch(@Param('matchId') matchId: string) {
    return this.matchesService.deleteMatch(matchId);
  }

  /** POST /api/v1/leagues/:id/generate-fixtures → round-robin fikstür */
  @Post(':id/generate-fixtures')
  @Roles('admin')
  generateFixtures(
    @Param('id') leagueId: string,
    @Body()      dto: GenerateFixturesDto,
  ) {
    return this.matchesService.generateFixtures(leagueId, dto);
  }
}
