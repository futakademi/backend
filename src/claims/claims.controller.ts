import { Controller, Post, Get, Body, Param, Put, UseGuards } from '@nestjs/common';
import { ClaimsService } from './claims.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/public.decorator';
import { StartClaimDto } from './dto/start-claim.dto';
import { UpdateCustomDataDto } from './dto/update-custom-data.dto';

@Controller('claims')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Post()
  @Roles('premium')
  startClaim(@CurrentUser('id') userId: string, @Body() dto: StartClaimDto) {
    return this.claimsService.startClaim(userId, dto.playerId);
  }

  @Get('me')
  @Roles('premium')
  getMyClaim(@CurrentUser('id') userId: string) {
    return this.claimsService.getMyClaim(userId);
  }

  @Put('players/:playerId/custom-data')
  @Roles('premium')
  updateCustomData(
    @CurrentUser('id') userId: string,
    @Param('playerId') playerId: string,
    @Body() dto: UpdateCustomDataDto,
  ) {
    return this.claimsService.updateCustomData(userId, playerId, dto);
  }
}
