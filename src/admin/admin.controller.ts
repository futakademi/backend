import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/public.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('claims/pending')
  getPendingClaims() {
    return this.adminService.getPendingClaims();
  }

  @Put('claims/:id/approve')
  approveClaim(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    return this.adminService.approveClaim(id, adminId);
  }

  @Put('claims/:id/reject')
  rejectClaim(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.rejectClaim(id, adminId, reason);
  }

  @Get('users')
  getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: string,
  ) {
    return this.adminService.getUsers(page, limit, role);
  }

  @Put('users/:id/role')
  setUserRole(
    @Param('id') userId: string,
    @Body('role') role: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.setUserRole(userId, role, adminId);
  }

  @Post('import/players')
  importPlayers(@Body() body: { players: any[] }, @CurrentUser('id') adminId: string) {
    return this.adminService.importPlayers(body.players, adminId);
  }

  @Delete('players/:id')
  deletePlayer(@Param('id') id: string, @CurrentUser('id') adminId: string) {
    return this.adminService.deletePlayer(id, adminId);
  }

  @Get('audit-logs')
  getAuditLogs(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.adminService.getAuditLogs(page, limit);
  }
}
