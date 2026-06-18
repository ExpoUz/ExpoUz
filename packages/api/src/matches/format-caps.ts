import { BadRequestException } from '@nestjs/common';

/**
 * Hard player caps per sport + format. The cap is the maximum number of players
 * a match of that format may ever hold — enforced on create and on join.
 *
 *   Football: 5v5 -> 10, 6v6 -> 12
 *   Padel:    1v1 -> 2,  2v2 -> 4  (never more than 4)
 */
export const SPORT_FORMATS: Record<string, Record<string, number>> = {
  FOOTBALL: {
    '5v5': 10,
    '6v6': 12,
  },
  PADEL: {
    '1v1': 2,
    '2v2': 4,
  },
};

/**
 * Resolve the hard player cap for a sport + format pair. Throws a 400 if the
 * sport is unknown or the format is not allowed for that sport.
 */
export function getMaxPlayers(sport: string, format: string): number {
  const sportFormats = SPORT_FORMATS[sport];
  if (!sportFormats) {
    // Sports without an explicit cap table fall back to the generic NvN rule.
    const cap = genericFormatCap(format);
    if (cap == null) {
      throw new BadRequestException(`Unknown sport: ${sport}`);
    }
    return cap;
  }
  const cap = sportFormats[format];
  if (cap == null) {
    const valid = Object.keys(sportFormats).join(', ');
    throw new BadRequestException(
      `Invalid format "${format}" for ${sport}. Allowed: ${valid}.`,
    );
  }
  return cap;
}

export function getAllowedFormats(sport: string): string[] {
  return Object.keys(SPORT_FORMATS[sport] || {});
}

/** Derive a cap from an "NvN" string (per side × 2) for sports without a table. */
function genericFormatCap(format: string): number | null {
  const m = format?.match(/^(\d+)v(\d+)$/);
  if (!m) return null;
  return parseInt(m[1], 10) + parseInt(m[2], 10);
}
