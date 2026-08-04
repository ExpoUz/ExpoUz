import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshDto } from './dto/refresh.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminSetupDto } from './dto/admin-setup.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-otp')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Send OTP to phone number' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid phone number' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Post('verify-otp')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Verify OTP and get tokens' })
  @ApiResponse({ status: 200, description: 'Tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Post('register')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete user registration profile' })
  @ApiResponse({ status: 200, description: 'Profile updated' })
  register(@CurrentUser() user: any, @Body() dto: RegisterDto) {
    return this.authService.register(user.id, dto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'New tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  logout(@CurrentUser() user: any, @Body() dto: RefreshDto) {
    return this.authService.logout(user.id, dto.refreshToken);
  }

  @Post('telegram')
  @ApiOperation({ summary: 'Authenticate via Telegram Mini App initData' })
  @ApiResponse({ status: 200, description: 'Tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid Telegram data' })
  telegramAuth(@Body('initData') initData: string) {
    return this.authService.telegramAuth(initData);
  }

  @Post('telegram/admin')
  @ApiOperation({ summary: 'Authenticate an admin via @ExpoUzAdminBot Mini App' })
  @ApiResponse({ status: 200, description: 'Tokens returned' })
  @ApiResponse({ status: 403, description: 'Not an authorized admin' })
  telegramAdminAuth(@Body('initData') initData: string) {
    return this.authService.telegramAdminAuth(initData);
  }

  @Post('admin/login')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Admin email + password login (Super Admin panel)' })
  @ApiResponse({ status: 200, description: 'Tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }

  @Post('admin/setup')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({
    summary: 'Create/reset a SUPER_ADMIN (gated by ADMIN_SETUP_KEY env var)',
  })
  @ApiResponse({ status: 201, description: 'Super admin created or reset' })
  @ApiResponse({ status: 403, description: 'Setup disabled or invalid setup key' })
  adminSetup(@Body() dto: AdminSetupDto) {
    return this.authService.adminSetup(dto);
  }

  @Post('google')
  @ApiOperation({ summary: 'Sign in or register with Google ID token' })
  @ApiResponse({ status: 200, description: 'Tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid Google token' })
  googleAuth(@Body('credential') credential: string) {
    return this.authService.googleAuth(credential);
  }
}
