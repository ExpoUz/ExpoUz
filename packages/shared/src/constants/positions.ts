import { MatchPosition } from '../types';

// ─── Position metadata ────────────────────────────────────────────────────────

export type PositionCategory = 'goalkeeper' | 'defender' | 'midfielder' | 'forward';

export interface PositionMeta {
  label: string;
  abbreviation: string;
  category: PositionCategory;
}

export const POSITIONS: Record<MatchPosition, PositionMeta> = {
  [MatchPosition.GK]: { label: 'Goalkeeper', abbreviation: 'GK', category: 'goalkeeper' },
  [MatchPosition.LB]: { label: 'Left Back', abbreviation: 'LB', category: 'defender' },
  [MatchPosition.CB]: { label: 'Centre Back', abbreviation: 'CB', category: 'defender' },
  [MatchPosition.CB2]: { label: 'Centre Back 2', abbreviation: 'CB', category: 'defender' },
  [MatchPosition.RB]: { label: 'Right Back', abbreviation: 'RB', category: 'defender' },
  [MatchPosition.LWB]: { label: 'Left Wing Back', abbreviation: 'LWB', category: 'defender' },
  [MatchPosition.RWB]: { label: 'Right Wing Back', abbreviation: 'RWB', category: 'defender' },
  [MatchPosition.CDM]: { label: 'Defensive Midfielder', abbreviation: 'CDM', category: 'midfielder' },
  [MatchPosition.CM]: { label: 'Central Midfielder', abbreviation: 'CM', category: 'midfielder' },
  [MatchPosition.CM2]: { label: 'Central Midfielder 2', abbreviation: 'CM', category: 'midfielder' },
  [MatchPosition.CAM]: { label: 'Attacking Midfielder', abbreviation: 'CAM', category: 'midfielder' },
  [MatchPosition.LW]: { label: 'Left Winger', abbreviation: 'LW', category: 'forward' },
  [MatchPosition.RW]: { label: 'Right Winger', abbreviation: 'RW', category: 'forward' },
  [MatchPosition.CF]: { label: 'Centre Forward', abbreviation: 'CF', category: 'forward' },
  [MatchPosition.ST]: { label: 'Striker', abbreviation: 'ST', category: 'forward' },
};

export const POSITION_LIST: MatchPosition[] = Object.values(MatchPosition);

// ─── Formation definitions ────────────────────────────────────────────────────

export interface FormationSlot {
  position: MatchPosition;
  /** Normalised x position 0..1 (0 = left, 1 = right) from the home team's perspective */
  x: number;
  /** Normalised y position 0..1 (0 = own goal, 1 = opponent goal) from the home team's perspective */
  y: number;
  team: 'home' | 'away';
}

export interface FormationDef {
  name: string;
  positions: FormationSlot[];
}

/** Build mirrored away positions from home slots */
function mirrorAway(home: Omit<FormationSlot, 'team'>[]): FormationSlot[] {
  return home.map((s) => ({
    ...s,
    x: 1 - s.x,
    y: 1 - s.y,
    team: 'away' as const,
  }));
}

const f433Home: Omit<FormationSlot, 'team'>[] = [
  { position: MatchPosition.GK, x: 0.5, y: 0.04 },
  { position: MatchPosition.LB, x: 0.15, y: 0.22 },
  { position: MatchPosition.CB, x: 0.38, y: 0.18 },
  { position: MatchPosition.CB2, x: 0.62, y: 0.18 },
  { position: MatchPosition.RB, x: 0.85, y: 0.22 },
  { position: MatchPosition.CM, x: 0.25, y: 0.45 },
  { position: MatchPosition.CDM, x: 0.5, y: 0.38 },
  { position: MatchPosition.CM2, x: 0.75, y: 0.45 },
  { position: MatchPosition.LW, x: 0.18, y: 0.72 },
  { position: MatchPosition.ST, x: 0.5, y: 0.78 },
  { position: MatchPosition.RW, x: 0.82, y: 0.72 },
];

const f442Home: Omit<FormationSlot, 'team'>[] = [
  { position: MatchPosition.GK, x: 0.5, y: 0.04 },
  { position: MatchPosition.LB, x: 0.15, y: 0.22 },
  { position: MatchPosition.CB, x: 0.38, y: 0.18 },
  { position: MatchPosition.CB2, x: 0.62, y: 0.18 },
  { position: MatchPosition.RB, x: 0.85, y: 0.22 },
  { position: MatchPosition.LW, x: 0.15, y: 0.48 },
  { position: MatchPosition.CM, x: 0.38, y: 0.45 },
  { position: MatchPosition.CM2, x: 0.62, y: 0.45 },
  { position: MatchPosition.RW, x: 0.85, y: 0.48 },
  { position: MatchPosition.CF, x: 0.35, y: 0.74 },
  { position: MatchPosition.ST, x: 0.65, y: 0.74 },
];

const f352Home: Omit<FormationSlot, 'team'>[] = [
  { position: MatchPosition.GK, x: 0.5, y: 0.04 },
  { position: MatchPosition.CB, x: 0.25, y: 0.20 },
  { position: MatchPosition.CB2, x: 0.5, y: 0.18 },
  { position: MatchPosition.RB, x: 0.75, y: 0.20 },
  { position: MatchPosition.LWB, x: 0.1, y: 0.42 },
  { position: MatchPosition.CDM, x: 0.3, y: 0.40 },
  { position: MatchPosition.CM, x: 0.5, y: 0.44 },
  { position: MatchPosition.CM2, x: 0.7, y: 0.40 },
  { position: MatchPosition.RWB, x: 0.9, y: 0.42 },
  { position: MatchPosition.CF, x: 0.35, y: 0.74 },
  { position: MatchPosition.ST, x: 0.65, y: 0.74 },
];

const f532Home: Omit<FormationSlot, 'team'>[] = [
  { position: MatchPosition.GK, x: 0.5, y: 0.04 },
  { position: MatchPosition.LWB, x: 0.1, y: 0.26 },
  { position: MatchPosition.LB, x: 0.28, y: 0.20 },
  { position: MatchPosition.CB, x: 0.5, y: 0.17 },
  { position: MatchPosition.RB, x: 0.72, y: 0.20 },
  { position: MatchPosition.RWB, x: 0.9, y: 0.26 },
  { position: MatchPosition.CDM, x: 0.28, y: 0.46 },
  { position: MatchPosition.CM, x: 0.5, y: 0.44 },
  { position: MatchPosition.CM2, x: 0.72, y: 0.46 },
  { position: MatchPosition.CF, x: 0.35, y: 0.75 },
  { position: MatchPosition.ST, x: 0.65, y: 0.75 },
];

const f4231Home: Omit<FormationSlot, 'team'>[] = [
  { position: MatchPosition.GK, x: 0.5, y: 0.04 },
  { position: MatchPosition.LB, x: 0.15, y: 0.22 },
  { position: MatchPosition.CB, x: 0.38, y: 0.18 },
  { position: MatchPosition.CB2, x: 0.62, y: 0.18 },
  { position: MatchPosition.RB, x: 0.85, y: 0.22 },
  { position: MatchPosition.CDM, x: 0.38, y: 0.40 },
  { position: MatchPosition.CM, x: 0.62, y: 0.40 },
  { position: MatchPosition.LW, x: 0.18, y: 0.60 },
  { position: MatchPosition.CAM, x: 0.5, y: 0.60 },
  { position: MatchPosition.RW, x: 0.82, y: 0.60 },
  { position: MatchPosition.ST, x: 0.5, y: 0.80 },
];

const f541Home: Omit<FormationSlot, 'team'>[] = [
  { position: MatchPosition.GK, x: 0.5, y: 0.04 },
  { position: MatchPosition.LWB, x: 0.1, y: 0.26 },
  { position: MatchPosition.LB, x: 0.28, y: 0.20 },
  { position: MatchPosition.CB, x: 0.5, y: 0.17 },
  { position: MatchPosition.RB, x: 0.72, y: 0.20 },
  { position: MatchPosition.RWB, x: 0.9, y: 0.26 },
  { position: MatchPosition.LW, x: 0.15, y: 0.50 },
  { position: MatchPosition.CM, x: 0.38, y: 0.48 },
  { position: MatchPosition.CM2, x: 0.62, y: 0.48 },
  { position: MatchPosition.RW, x: 0.85, y: 0.50 },
  { position: MatchPosition.ST, x: 0.5, y: 0.80 },
];

function buildFormation(name: string, home: Omit<FormationSlot, 'team'>[]): FormationDef {
  return {
    name,
    positions: [
      ...home.map((s) => ({ ...s, team: 'home' as const })),
      ...mirrorAway(home),
    ],
  };
}

export const FORMATIONS: Record<string, FormationDef> = {
  '4-3-3': buildFormation('4-3-3', f433Home),
  '4-4-2': buildFormation('4-4-2', f442Home),
  '3-5-2': buildFormation('3-5-2', f352Home),
  '5-3-2': buildFormation('5-3-2', f532Home),
  '4-2-3-1': buildFormation('4-2-3-1', f4231Home),
  '5-4-1': buildFormation('5-4-1', f541Home),
};
