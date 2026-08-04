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
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminAuditInterceptor } from './admin-audit.interceptor';
import { GeminiService } from '../gemini/gemini.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(AdminAuditInterceptor)
@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly geminiService: GeminiService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Patch('link-telegram')
  @ApiOperation({ summary: 'Link the current admin account to a Telegram ID (for admin Mini App)' })
  linkTelegram(@Body('telegramId') telegramId: string, @Req() req: any) {
    return this.adminService.linkTelegram(req.user.id, telegramId);
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

  @Post('users/:id/wallet')
  @ApiOperation({ summary: "Manually credit/adjust a user's wallet (ledgered)" })
  adjustWallet(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body('description') description: string,
    @Body('type') type?: 'TOPUP' | 'ADMIN_ADJUSTMENT',
  ) {
    return this.adminService.adjustWallet(id, Number(amount), description, type);
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
  @ApiQuery({ name: 'sport', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  getMatches(
    @Query('sport') sport?: string,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getMatches({ sport, status, page: +page, limit: +limit });
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

  @Get('analytics/padel')
  @ApiOperation({ summary: 'Padel level distribution + casual/competitive split' })
  getPadelAnalytics() {
    return this.adminService.getPadelAnalytics();
  }

  @Get('analytics/football')
  @ApiOperation({ summary: 'Football match count + fill rate per format' })
  getFootballAnalytics() {
    return this.adminService.getFootballAnalytics();
  }

  @Get('disputes')
  @ApiOperation({ summary: 'List disputed padel match results awaiting moderation' })
  getDisputes() {
    return this.adminService.getDisputedResults();
  }

  @Post('disputes/:matchId/resolve')
  @ApiOperation({ summary: 'Resolve a disputed result: confirm (applies levels) or dismiss' })
  resolveDispute(@Param('matchId') matchId: string, @Body('confirm') confirm: boolean) {
    return this.adminService.resolveDispute(matchId, !!confirm);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get platform settings' })
  getSettings() {
    return this.adminService.getSettings();
  }

  @Patch('settings')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update platform settings (SUPER_ADMIN only)' })
  updateSettings(
    @Body()
    dto: {
      commissionRate?: number;
      platformFeeRate?: number;
      cancellationFeeRate?: number;
      cancellationWindowHours?: number;
    },
  ) {
    return this.adminService.updateSettings(dto);
  }

  @Patch('settings/commission')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update commission rate (SUPER_ADMIN only)' })
  updateCommission(@Body('rate') rate: number) {
    return this.adminService.updateCommission(rate);
  }

  @Get('announcements')
  @ApiOperation({ summary: 'Announcement history' })
  getAnnouncements() {
    return this.adminService.getAnnouncements();
  }

  @Post('announcements')
  @ApiOperation({ summary: 'Send announcement to users' })
  createAnnouncement(
    @Body() dto: { title: string; body: string; targetRole?: string; city?: string },
  ) {
    return this.adminService.createAnnouncement(dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN — Pitch Admin Management
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('pitch-admins')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all pitch admins with online status and pitch metrics' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getPitchAdmins(
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getPitchAdmins({ search, city, page: +page, limit: +limit });
  }

  @Get('pitch-admins/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Full pitch admin profile with pitches, bookings, and activity log' })
  getPitchAdminById(@Param('id') id: string) {
    return this.adminService.getPitchAdminById(id);
  }

  @Post('pitch-admins')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new pitch admin account (or upgrade existing user)' })
  createPitchAdmin(
    @Body() dto: { phone: string; firstName: string; lastName: string; city: string; email?: string },
  ) {
    return this.adminService.createPitchAdmin(dto);
  }

  @Patch('pitch-admins/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update pitch admin profile or ban status' })
  updatePitchAdmin(
    @Param('id') id: string,
    @Body()
    dto: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      city?: string;
      email?: string;
      isBanned?: boolean;
      bannedReason?: string;
    },
  ) {
    return this.adminService.updatePitchAdmin(id, dto);
  }

  @Delete('pitch-admins/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Remove pitch admin (soft-delete, demotes to PLAYER)' })
  deletePitchAdmin(@Param('id') id: string) {
    return this.adminService.deletePitchAdmin(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN — Enhanced User Management
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('users/:id')
  @ApiOperation({ summary: 'Full user profile: bookings, transactions, activity log, online status' })
  getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Edit user attributes (name, phone, role, credit, skill)' })
  updateUser(
    @Param('id') id: string,
    @Body()
    dto: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      city?: string;
      email?: string;
      role?: string;
      credit?: number;
      skillLevel?: string;
    },
  ) {
    return this.adminService.updateUser(id, dto);
  }

  @Delete('users/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft-delete user account' })
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN — Location Management
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('locations')
  @ApiOperation({ summary: 'List all geographic locations' })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'search', required: false })
  getLocations(@Query('city') city?: string, @Query('search') search?: string) {
    return this.adminService.getLocations({ city, search });
  }

  @Post('locations')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a location zone' })
  createLocation(
    @Body() dto: { name: string; city: string; district?: string; lat?: number; lng?: number },
  ) {
    return this.adminService.createLocation(dto);
  }

  @Patch('locations/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a location zone' })
  updateLocation(
    @Param('id') id: string,
    @Body()
    dto: { name?: string; city?: string; district?: string; lat?: number; lng?: number; isActive?: boolean },
  ) {
    return this.adminService.updateLocation(id, dto);
  }

  @Delete('locations/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete a location (unlinks its pitches)' })
  deleteLocation(@Param('id') id: string) {
    return this.adminService.deleteLocation(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN — Full Pitch Management
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('pitches')
  @ApiOperation({ summary: 'Get all pitches with owner, location, and booking counts' })
  @ApiQuery({ name: 'sport', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'ownerId', required: false })
  @ApiQuery({ name: 'locationId', required: false })
  @ApiQuery({ name: 'isVerified', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getAllPitches(
    @Query('sport') sport?: string,
    @Query('city') city?: string,
    @Query('ownerId') ownerId?: string,
    @Query('locationId') locationId?: string,
    @Query('isVerified') isVerified?: string,
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getAllPitches({
      sport,
      city,
      ownerId,
      locationId,
      isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
      search,
      page: +page,
      limit: +limit,
    });
  }

  @Post('pitches')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create and pre-verify a pitch, assign to a pitch admin' })
  createPitch(
    @Body()
    dto: {
      ownerId: string;
      name: string;
      addressLine: string;
      district: string;
      city: string;
      lat: number;
      lng: number;
      hourlyRate: number;
      surfaceType?: string;
      pitchSize?: string;
      isIndoor?: boolean;
      locationId?: string;
      commission?: number;
      description?: string;
      photos?: string[];
    },
  ) {
    return this.adminService.createPitch(dto);
  }

  @Patch('pitches/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update any pitch attribute including owner reassignment' })
  updatePitch(
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string;
      addressLine?: string;
      district?: string;
      city?: string;
      lat?: number;
      lng?: number;
      hourlyRate?: number;
      isActive?: boolean;
      isVerified?: boolean;
      locationId?: string;
      ownerId?: string;
      commission?: number;
      description?: string;
    },
  ) {
    return this.adminService.updatePitch(id, dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUPER ADMIN — Activity Log & Online Status
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('activity-log')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Paginated platform activity log' })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'entityType', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getActivityLog(
    @Query('userId') userId?: string,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('category') category?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 30,
  ) {
    return this.adminService.getActivityLog({
      userId, entityType, action, category, from, to, page: +page, limit: +limit,
    });
  }

  @Get('online-status')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Real-time online status snapshot (active in last 5 min)' })
  getOnlineStatus() {
    return this.adminService.getOnlineStatus();
  }

  // ─── AI / Gemini Endpoints ────────────────────────────────────────────────

  @Get('ai/snapshot')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get raw system data snapshot for AI context' })
  getAiSnapshot() {
    return this.geminiService.getSystemSnapshot();
  }

  @Post('ai/analyze')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get AI analysis of the platform (one-shot)' })
  analyze(@Body() body: { prompt?: string }) {
    return this.geminiService.analyze(body.prompt);
  }

  @Post('ai/chat')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Chat with Gemini AI about system data (stateful per user)' })
  chat(@Req() req: any, @Body() body: { message: string }) {
    const sessionId = `admin:${req.user.id}`;
    return this.geminiService.chat(sessionId, body.message);
  }

  @Post('ai/reset')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Reset AI chat session' })
  resetChat(@Req() req: any) {
    this.geminiService.clearSession(`admin:${req.user.id}`);
    return { message: 'Chat session reset' };
  }
}
