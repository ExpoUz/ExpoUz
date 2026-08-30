import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SlotsService } from './slots.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OrgGuard } from '../org/org.guard';
import { OrgRoles } from '../org/decorators/org-roles.decorator';

/**
 * Admin slot management. Access = org membership (OrgGuard) with OWNER/MANAGER
 * role for editing; the service further scopes every action to the caller's
 * assigned venues via assertCanManagePitch. Mounted under the partner panel.
 */
@ApiTags('slots-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrgGuard)
@OrgRoles('OWNER', 'MANAGER')
@Controller('pitch-admin/slots')
export class SlotAdminController {
  constructor(private readonly slots: SlotsService) {}

  @Get()
  @ApiOperation({ summary: 'List slots for a venue in a date range (grid)' })
  @ApiQuery({ name: 'pitchId', required: true })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  list(
    @CurrentUser() user: any,
    @Query('pitchId') pitchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.slots.listForPitch(user.id, pitchId, from, to);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate AVAILABLE slots from opening hours for a date range' })
  generate(
    @CurrentUser() user: any,
    @Body() body: { pitchId: string; from: string; to: string; price?: number },
  ) {
    return this.slots.generate(user.id, body.pitchId, { from: body.from, to: body.to, price: body.price });
  }

  @Patch('bulk')
  @ApiOperation({ summary: 'Bulk price change / block-unblock (skips BOOKED)' })
  bulkUpdate(
    @CurrentUser() user: any,
    @Body() body: { slotIds: string[]; price?: number; status?: 'AVAILABLE' | 'BLOCKED'; blockReason?: string },
  ) {
    return this.slots.bulkUpdate(user.id, body);
  }

  @Delete('bulk')
  @ApiOperation({ summary: 'Bulk-delete unbooked slots in a date range' })
  bulkDelete(
    @CurrentUser() user: any,
    @Query('pitchId') pitchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.slots.bulkDelete(user.id, pitchId, from, to);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit one slot: price, block/unblock' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { price?: number; status?: 'AVAILABLE' | 'BLOCKED'; blockReason?: string },
  ) {
    return this.slots.updateSlot(user.id, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete one slot (AVAILABLE/BLOCKED only)' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.slots.deleteSlot(user.id, id);
  }
}

/**
 * Player-facing read: AVAILABLE, future slots to book into. Prices are set by
 * admins; users never set them.
 */
@ApiTags('slots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('slots')
export class SlotPublicController {
  constructor(private readonly slots: SlotsService) {}

  @Get('available')
  @ApiOperation({ summary: 'Available slots to book, grouped by venue' })
  @ApiQuery({ name: 'pitchId', required: false })
  @ApiQuery({ name: 'sport', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  available(
    @Query('pitchId') pitchId?: string,
    @Query('sport') sport?: string,
    @Query('city') city?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.slots.available({ pitchId, sport, city, from, to, limit: limit ? +limit : undefined });
  }
}
