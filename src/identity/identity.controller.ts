import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { IdentityService } from './identity.service';
import { VerifyIdentityDto } from './dto/verify-identity.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/public.decorator';

@Controller('identity')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IdentityController {
  constructor(private readonly identityService: IdentityService) {}

  @Post('verify')
  @Roles('premium')
  verify(@CurrentUser('id') userId: string, @Body() dto: VerifyIdentityDto) {
    return this.identityService.verifyIdentity(userId, dto);
  }
}
