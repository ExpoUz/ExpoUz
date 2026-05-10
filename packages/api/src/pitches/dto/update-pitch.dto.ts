import { PartialType } from '@nestjs/swagger';
import { CreatePitchDto } from './create-pitch.dto';

export class UpdatePitchDto extends PartialType(CreatePitchDto) {}
