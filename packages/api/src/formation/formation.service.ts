import { Injectable, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Position =
  | 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM'
  | 'LM' | 'RM' | 'LW' | 'RW' | 'ST' | 'CF' | 'SS' | 'ANY';

interface PositionEntry {
  position: Position;
  jersey: number;
}

interface FormationDef {
  home: PositionEntry[];
  away: PositionEntry[];
}

const FORMATIONS: Record<string, FormationDef> = {
  '3-3-1': {
    home: [
      { position: 'GK', jersey: 1 },
      { position: 'CB', jersey: 2 },
      { position: 'CB', jersey: 3 },
      { position: 'CB', jersey: 4 },
      { position: 'CM', jersey: 5 },
      { position: 'CM', jersey: 6 },
      { position: 'CM', jersey: 7 },
      { position: 'ST', jersey: 8 },
    ],
    away: [
      { position: 'GK', jersey: 1 },
      { position: 'CB', jersey: 2 },
      { position: 'CB', jersey: 3 },
      { position: 'CB', jersey: 4 },
      { position: 'CM', jersey: 5 },
      { position: 'CM', jersey: 6 },
      { position: 'CM', jersey: 7 },
      { position: 'ST', jersey: 8 },
    ],
  },
  '2-3-1': {
    home: [
      { position: 'GK', jersey: 1 },
      { position: 'CB', jersey: 2 },
      { position: 'CB', jersey: 3 },
      { position: 'CM', jersey: 4 },
      { position: 'CM', jersey: 5 },
      { position: 'CM', jersey: 6 },
      { position: 'ST', jersey: 7 },
    ],
    away: [
      { position: 'GK', jersey: 1 },
      { position: 'CB', jersey: 2 },
      { position: 'CB', jersey: 3 },
      { position: 'CM', jersey: 4 },
      { position: 'CM', jersey: 5 },
      { position: 'CM', jersey: 6 },
      { position: 'ST', jersey: 7 },
    ],
  },
  '4-3-3': {
    home: [
      { position: 'GK', jersey: 1 },
      { position: 'LB', jersey: 2 },
      { position: 'CB', jersey: 3 },
      { position: 'CB', jersey: 4 },
      { position: 'RB', jersey: 5 },
      { position: 'CM', jersey: 6 },
      { position: 'CM', jersey: 7 },
      { position: 'CM', jersey: 8 },
      { position: 'LW', jersey: 9 },
      { position: 'ST', jersey: 10 },
      { position: 'RW', jersey: 11 },
    ],
    away: [
      { position: 'GK', jersey: 1 },
      { position: 'LB', jersey: 2 },
      { position: 'CB', jersey: 3 },
      { position: 'CB', jersey: 4 },
      { position: 'RB', jersey: 5 },
      { position: 'CM', jersey: 6 },
      { position: 'CM', jersey: 7 },
      { position: 'CM', jersey: 8 },
      { position: 'LW', jersey: 9 },
      { position: 'ST', jersey: 10 },
      { position: 'RW', jersey: 11 },
    ],
  },
  '4-4-2': {
    home: [
      { position: 'GK', jersey: 1 },
      { position: 'LB', jersey: 2 },
      { position: 'CB', jersey: 3 },
      { position: 'CB', jersey: 4 },
      { position: 'RB', jersey: 5 },
      { position: 'LM', jersey: 6 },
      { position: 'CM', jersey: 7 },
      { position: 'CM', jersey: 8 },
      { position: 'RM', jersey: 9 },
      { position: 'ST', jersey: 10 },
      { position: 'ST', jersey: 11 },
    ],
    away: [
      { position: 'GK', jersey: 1 },
      { position: 'LB', jersey: 2 },
      { position: 'CB', jersey: 3 },
      { position: 'CB', jersey: 4 },
      { position: 'RB', jersey: 5 },
      { position: 'LM', jersey: 6 },
      { position: 'CM', jersey: 7 },
      { position: 'CM', jersey: 8 },
      { position: 'RM', jersey: 9 },
      { position: 'ST', jersey: 10 },
      { position: 'ST', jersey: 11 },
    ],
  },
};

@Injectable()
export class FormationService {
  constructor(private prisma: PrismaService) {}

  async generatePositions(matchId: string, formation: string, format: string): Promise<void> {
    const formationDef = FORMATIONS[formation];
    if (!formationDef) return;

    await this.prisma.matchPosition.deleteMany({ where: { matchId } });

    const positions: any[] = [];

    for (const pos of formationDef.home) {
      positions.push({
        matchId,
        teamSide: 'HOME',
        position: pos.position,
        jerseyNumber: pos.jersey,
      });
    }

    for (const pos of formationDef.away) {
      positions.push({
        matchId,
        teamSide: 'AWAY',
        position: pos.position,
        jerseyNumber: pos.jersey + 100,
      });
    }

    await this.prisma.matchPosition.createMany({ data: positions });
  }

  async updateFormation(matchId: string, formation: string, hostId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new ConflictException('Match not found');
    if (match.hostId !== hostId) throw new ForbiddenException('Not the host');

    const lockedPositions = await this.prisma.matchPosition.count({
      where: { matchId, isLocked: true },
    });

    if (lockedPositions > 0) {
      throw new ConflictException(
        'Cannot change formation: some positions are already taken',
      );
    }

    await this.generatePositions(matchId, formation, match.format);

    await this.prisma.match.update({
      where: { id: matchId },
      data: { formation },
    });
  }

  getAvailableFormations(): string[] {
    return Object.keys(FORMATIONS);
  }
}
