import {
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  findMe(@CurrentUser() user: any) {
    return this.usersService.findMe(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  updateMe(@CurrentUser() user: any, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload avatar image' })
  uploadAvatar(@CurrentUser() user: any, @UploadedFile() file: Express.Multer.File) {
    return this.usersService.uploadAvatar(user.id, file);
  }

  @Get('me/bookings')
  @ApiOperation({ summary: 'Get my bookings' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMyBookings(
    @CurrentUser() user: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.usersService.getMyBookings(user.id, +page, +limit);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get my statistics' })
  getMyStats(@CurrentUser() user: any) {
    return this.usersService.getMyStats(user.id);
  }

  @Get('me/notifications')
  @ApiOperation({ summary: 'Get my notifications' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  getMyNotifications(@CurrentUser() user: any, @Query('page') page = 1) {
    return this.usersService.getMyNotifications(user.id, +page);
  }

  @Patch('me/notifications/:id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  markNotificationRead(@CurrentUser() user: any, @Param('id') id: string) {
    return this.usersService.markNotificationRead(user.id, id);
  }

  @Put('me/positions')
  @ApiOperation({ summary: 'Set preferred positions' })
  setPreferredPositions(
    @CurrentUser() user: any,
    @Body() body: { positions: { position: string; isPrimary: boolean }[] },
  ) {
    return this.usersService.setPreferredPositions(user.id, body.positions);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get public user profile' })
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }

  @Post('me/referral')
  @ApiOperation({ summary: 'Apply referral code' })
  applyReferral(@CurrentUser() user: any, @Body('code') code: string) {
    return this.usersService.applyReferral(user.id, code);
  }
}
