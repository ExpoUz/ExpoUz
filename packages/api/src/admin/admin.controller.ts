import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users with filters' })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'isBanned', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getUsers(
    @Query('role') role?: string,
    @Query('isBanned') isBanned?: string,
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getUsers({
      role,
      isBanned: isBanned !== undefined ? isBanned === 'true' : undefined,
      search,
      page: +page,
      limit: +limit,
    });
  }

  @Patch('users/:id/role')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Change user role (SUPER_ADMIN only)' })
  changeUserRole(@Param('id') id: string, @Body('role') role: string) {
    return this.adminService.changeUserRole(id, role);
  }

  @Patch('users/:id/ban')
  @ApiOperation({ summary: 'Toggle user ban' })
  banUser(@Param('id') id: string, @Body('reason') reason: string) {
    return this.adminService.banUser(id, reason);
  }

  @Get('pitches/pending')
  @ApiOperation({ summary: 'Get pending pitch verifications' })
  getPendingPitches() {
    return this.adminService.getPendingPitches();
  }

  @Patch('pitches/:id/verify')
  @ApiOperation({ summary: 'Verify or reject a pitch' })
  verifyPitch(
    @Param('id') id: string,
    @Body('approved') approved: boolean,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.verifyPitch(id, approved, reason);
  }

  @Get('matches')
  @ApiOperation({ summary: 'Get all matches' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  getMatches(
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getMatches({ status, page: +page, limit: +limit });
  }

  @Delete('matches/:id')
  @ApiOperation({ summary: 'Cancel a match' })
  cancelMatch(@Param('id') id: string) {
    return this.adminService.cancelMatch(id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get all transactions' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  getTransactions(
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getTransactions({ status, page: +page, limit: +limit });
  }

  @Post('transactions/:id/release')
  @ApiOperation({ summary: 'Manually release a transaction' })
  manualRelease(@Param('id') id: string) {
    return this.adminService.manualRelease(id);
  }

  @Get('analytics/revenue')
  @ApiOperation({ summary: 'Get revenue analytics' })
  @ApiQuery({ name: 'period', enum: ['week', 'month', 'year'], required: false })
  getRevenueAnalytics(@Query('period') period: 'week' | 'month' | 'year' = 'month') {
    return this.adminService.getRevenueAnalytics(period);
  }

  @Patch('settings/commission')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update commission rate (SUPER_ADMIN only)' })
  updateCommission(@Body('rate') rate: number) {
    return this.adminService.updateCommission(rate);
  }

  @Post('announcements')
  @ApiOperation({ summary: 'Send announcement to users' })
  createAnnouncement(
    @Body() dto: { title: string; body: string; targetRole?: string; city?: string },
  ) {
    return this.adminService.createAnnouncement(dto);
  }
}
