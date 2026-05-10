const DEFAULT_PLATFORM_FEE_PERCENT = 5;
const DEFAULT_COMMISSION_PERCENT = 10;

/**
 * Formats an amount in Uzbek Sum using a space as the thousands separator.
 * Example: 50000 → "50 000 UZS"
 */
export function formatUZS(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return `${formatted} UZS`;
}

/**
 * Calculates the platform fee amount.
 * Default fee: 5% of the transaction amount.
 */
export function calculatePlatformFee(amount: number, feePercent: number = DEFAULT_PLATFORM_FEE_PERCENT): number {
  return Math.round((amount * feePercent) / 100);
}

/**
 * Calculates the commission owed to the platform on a pitch rental.
 * Default commission: 10% of the pitch rental amount.
 */
export function calculatePitchCommission(pitchRental: number, commissionPercent: number = DEFAULT_COMMISSION_PERCENT): number {
  return Math.round((pitchRental * commissionPercent) / 100);
}

export interface PriceBreakdown {
  /** Amount each player pays before platform fee */
  basePerPlayer: number;
  /** Platform fee charged per player */
  platformFee: number;
  /** Total each player pays (base + fee) */
  totalPerPlayer: number;
  /** Amount the pitch owner receives per player slot */
  pitchOwnerReceives: number;
  /** Platform profit per player slot */
  platformProfit: number;
}

/**
 * Calculates how the cost is distributed per player for a match booking.
 *
 * @param pitchHourlyRate  - Hourly rental rate of the pitch in UZS
 * @param durationHours    - Duration of the match in hours
 * @param playerCount      - Total number of players in the match
 */
export function calculatePricePerPlayer(
  pitchHourlyRate: number,
  durationHours: number,
  playerCount: number,
): PriceBreakdown {
  if (playerCount <= 0) throw new Error('playerCount must be greater than 0');

  const totalPitchCost = pitchHourlyRate * durationHours;
  const basePerPlayer = Math.ceil(totalPitchCost / playerCount);
  const platformFee = calculatePlatformFee(basePerPlayer);
  const totalPerPlayer = basePerPlayer + platformFee;
  const pitchOwnerReceives = basePerPlayer - calculatePitchCommission(basePerPlayer);
  const platformProfit = platformFee + calculatePitchCommission(basePerPlayer);

  return {
    basePerPlayer,
    platformFee,
    totalPerPlayer,
    pitchOwnerReceives,
    platformProfit,
  };
}

export type CancellationPolicy = 'FULL_REFUND' | 'HALF_REFUND' | 'NO_REFUND';

export interface CancellationResult {
  refundAmount: number;
  penaltyAmount: number;
  policy: CancellationPolicy;
}

/**
 * Calculates the refund amount based on how far in advance the cancellation occurs.
 *
 * Policy:
 *   ≥ 24 hours before  → FULL_REFUND  (100%)
 *   6–23 hours before  → HALF_REFUND  (50%)
 *   < 6 hours before   → NO_REFUND    (0%)
 */
export function calculateCancellationRefund(amount: number, hoursBeforeMatch: number): CancellationResult {
  let policy: CancellationPolicy;
  let refundPercent: number;

  if (hoursBeforeMatch >= 24) {
    policy = 'FULL_REFUND';
    refundPercent = 100;
  } else if (hoursBeforeMatch >= 6) {
    policy = 'HALF_REFUND';
    refundPercent = 50;
  } else {
    policy = 'NO_REFUND';
    refundPercent = 0;
  }

  const refundAmount = Math.round((amount * refundPercent) / 100);
  const penaltyAmount = amount - refundAmount;

  return { refundAmount, penaltyAmount, policy };
}
