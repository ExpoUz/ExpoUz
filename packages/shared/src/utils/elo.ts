import { SkillLevel } from '../types';

const DEFAULT_ELO = 1000;
const DEFAULT_K_FACTOR = 32;

/**
 * Calculates Elo rating changes after a match outcome.
 * Returns new ratings for winner and loser.
 */
export function calculateEloChange(
  winnerRating: number,
  loserRating: number,
  kFactor: number = DEFAULT_K_FACTOR,
): { winnerNewRating: number; loserNewRating: number } {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400));
  const expectedLoser = 1 - expectedWinner;

  const winnerNewRating = Math.round(winnerRating + kFactor * (1 - expectedWinner));
  const loserNewRating = Math.round(loserRating + kFactor * (0 - expectedLoser));

  return { winnerNewRating, loserNewRating };
}

/**
 * Maps an Elo rating to a SkillLevel enum value.
 * BEGINNER: < 900
 * AMATEUR:  900 – 1200
 * PRO:      > 1200
 */
export function getSkillLevelFromElo(elo: number): SkillLevel {
  if (elo < 900) return SkillLevel.BEGINNER;
  if (elo <= 1200) return SkillLevel.AMATEUR;
  return SkillLevel.PRO;
}

export { DEFAULT_ELO };
