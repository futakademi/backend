import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PlayersService } from './players.service';
import { SearchPlayersDto } from './dto/search-players.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/public.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Reflector } from '@nestjs/core';

@Controller('players')
@UseGuards(JwtAuthGuard)
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Public()
  @Get()
  search(@Query() dto: SearchPlayersDto, @CurrentUser() user: any) {
    return this.playersService.search(dto, user?.role);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.playersService.findOne(id, user?.role);
  }
}
