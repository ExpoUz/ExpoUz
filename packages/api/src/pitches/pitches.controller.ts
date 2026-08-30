import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PitchesService } from './pitches.service';
import { CreatePitchDto } from './dto/create-pitch.dto';
import { UpdatePitchDto } from './dto/update-pitch.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('pitches')
@Controller('pitches')
export class PitchesController {
  constructor(private readonly pitchesService: PitchesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all pitches with optional filters' })
  @ApiQuery({ name: 'sport', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'district', required: false })
  @ApiQuery({ name: 'isIndoor', required: false, type: Boolean })
  @ApiQuery({ name: 'surfaceType', required: false })
  @ApiQuery({ name: 'pitchSize', required: false })
  @ApiQuery({ name: 'isVerified', required: false, type: Boolean })
  findAll(
    @Query('sport') sport?: string,
    @Query('city') city?: string,
    @Query('district') district?: string,
    @Query('isIndoor') isIndoor?: string,
    @Query('surfaceType') surfaceType?: string,
    @Query('pitchSize') pitchSize?: string,
    @Query('isVerified') isVerified?: string,
  ) {
    return this.pitchesService.findAll({
      sport,
      city,
      district,
      isIndoor: isIndoor !== undefined ? isIndoor === 'true' : undefined,
      surfaceType,
      pitchSize,
      isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
    });
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Get pitches near a location' })
  @ApiQuery({ name: 'lat', type: Number })
  @ApiQuery({ name: 'lng', type: Number })
  @ApiQuery({ name: 'radius', required: false, type: Number })
  findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius = '5',
  ) {
    return this.pitchesService.findNearby(+lat, +lng, +radius);
  }

  // NOTE: must precede the ':id' route so it isn't captured as a pitch id.
  @Get('nearby/home')
  @ApiOperation({ summary: 'Home-feed venues: distance when located, else city/district + gamesToday' })
  @ApiQuery({ name: 'lat', required: false, type: Number })
  @ApiQuery({ name: 'lng', required: false, type: Number })
  @ApiQuery({ name: 'sport', required: false })
  @ApiQuery({ name: 'city', required: false })
  @ApiQuery({ name: 'district', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findNearbyForHome(
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('sport') sport?: string,
    @Query('city') city?: string,
    @Query('district') district?: string,
    @Query('limit') limit?: string,
  ) {
    return this.pitchesService.findNearbyForHome({
      lat: lat !== undefined ? +lat : undefined,
      lng: lng !== undefined ? +lng : undefined,
      sport,
      city,
      district,
      limit: limit ? +limit : 10,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pitch by ID' })
  findOne(@Param('id') id: string) {
    return this.pitchesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  // PART 3: only superadmin creates venues. Venue admins edit/delete assigned
  // venues but never create — the canonical create path is POST /admin/pitches.
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new pitch (SUPER_ADMIN only)' })
  create(@CurrentUser() user: any, @Body() dto: CreatePitchDto) {
    return this.pitchesService.create(user.id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update pitch details' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdatePitchDto,
  ) {
    return this.pitchesService.update(id, user.id, dto);
  }

  @Post(':id/photos')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: 'Upload pitch photos' })
  uploadPhotos(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.pitchesService.uploadPhotos(id, user.id, files);
  }

  @Post(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a pitch' })
  follow(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pitchesService.follow(id, user.id);
  }

  @Delete(':id/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a pitch' })
  unfollow(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pitchesService.unfollow(id, user.id);
  }

  @Patch(':id/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify or reject a pitch (SUPER_ADMIN)' })
  verify(
    @Param('id') id: string,
    @Body('approved') approved: boolean,
    @Body('reason') reason?: string,
  ) {
    return this.pitchesService.verify(id, approved, reason);
  }

  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PITCH_OWNER', 'ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pitch analytics' })
  getAnalytics(@Param('id') id: string, @CurrentUser() user: any) {
    return this.pitchesService.getAnalytics(id, user.id);
  }
}
