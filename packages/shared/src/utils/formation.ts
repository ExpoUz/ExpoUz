import { FORMATIONS } from '../constants/positions';

export interface ProjectedPoint {
  x: number;
  y: number;
  scale: number;
}

/**
 * Applies a simple perspective projection to a normalised field coordinate.
 *
 * @param x       - Normalised x coordinate (0..1)
 * @param y       - Normalised y coordinate (0..1, 0 = near, 1 = far)
 * @param fieldW  - Logical field width in the coordinate system
 * @param fieldH  - Logical field height in the coordinate system
 * @param screenW - Output screen width in pixels
 * @param screenH - Output screen height in pixels
 */
export function perspectiveProject(
  x: number,
  y: number,
  fieldW: number,
  fieldH: number,
  screenW: number,
  screenH: number,
): ProjectedPoint {
  // Vanishing point is at 50% horizontal, 40% up the screen
  const vpX = screenW * 0.5;
  const vpY = screenH * 0.4;

  // Bottom of pitch maps to full screen height
  const bottomY = screenH;

  // Interpolation factor: 0 at top (far), 1 at bottom (near)
  const t = y;

  // Horizontal spread increases as we move toward the viewer
  const nearSpread = screenW;
  const farSpread = screenW * 0.45;
  const currentSpread = farSpread + (nearSpread - farSpread) * t;

  const projX = vpX + (x - 0.5) * currentSpread;
  const projY = vpY + (bottomY - vpY) * t;

  // Scale objects relative to their depth
  const scale = 0.55 + 0.65 * t;

  // Clamp to output bounds
  const clampedX = Math.max(0, Math.min(screenW, projX));
  const clampedY = Math.max(0, Math.min(screenH, projY));

  void fieldW;
  void fieldH;

  return { x: clampedX, y: clampedY, scale };
}

export interface FormationSlotFlat {
  position: string;
  x: number;
  y: number;
}

/**
 * Returns a flat list of formation positions for a single team half.
 * If the requested formation is not found, falls back to '4-3-3'.
 *
 * @param formation - Formation string, e.g. '4-3-3'
 * @param teamSize  - Number of outfield players + goalkeeper (e.g. 11)
 */
export function getFormationPositions(
  formation: string,
  teamSize: number,
): FormationSlotFlat[] {
  const def = FORMATIONS[formation] ?? FORMATIONS['4-3-3'];

  // Only return home-side positions, trimmed to teamSize
  const homeSlots = def.positions
    .filter((p) => p.team === 'home')
    .slice(0, teamSize);

  return homeSlots.map((s) => ({
    position: s.position,
    x: s.x,
    y: s.y,
  }));
}
