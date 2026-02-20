import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { UpsertTeamDto } from './dto/upsert-team.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('leagues')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeaguesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  @Public()
  @Get()
  findAll() {
    return this.leaguesService.findAll();
  }

  @Public()
  @Get(':id/standings')
  getStandings(@Param('id') id: string) {
    return this.leaguesService.getStandings(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateLeagueDto) {
    return this.leaguesService.createLeague(dto);
  }

  @Post(':id/teams')
  @Roles('admin')
  upsertTeam(@Param('id') leagueId: string, @Body() dto: UpsertTeamDto) {
    return this.leaguesService.upsertTeam(leagueId, dto);
  }

  @Put('teams/:teamId')
  @Roles('admin')
  updateTeam(@Param('teamId') teamId: string, @Body() dto: UpsertTeamDto) {
    return this.leaguesService.updateTeam(teamId, dto);
  }

  @Delete(':id')
  @Roles('admin')
  delete(@Param('id') id: string) {
    return this.leaguesService.deleteLeague(id);
  }
}
