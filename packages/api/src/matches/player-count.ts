import { Prisma } from '@prisma/client';

/**
 * The ONE and ONLY way `Match.currentPlayers` is ever written.
 *
 * A player occupies a slot iff a Booking row exists with status CONFIRMED or
 * PENDING_PAYMENT — host bookings and organizer-paid guest slots included.
 * `currentPlayers` is a derived cache of that count, recomputed from the real
 * bookings inside the same transaction that changed them, so the two can never
 * disagree. Never write `currentPlayers` anywhere else.
 *
 * Also reconciles the coarse OPEN/FULL status from the true count, while leaving
 * terminal/lifecycle states (CANCELLED, IN_PROGRESS, COMPLETED, CONFIRMED)
 * untouched.
 *
 * @returns the authoritative occupied-slot count.
 */
export async function syncPlayerCount(
  tx: Prisma.TransactionClient,
  matchId: string,
): Promise<number> {
  const count = await tx.booking.count({
    where: { matchId, status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } },
  });

  const match = await tx.match.findUniqueOrThrow({
    where: { id: matchId },
    select: { maxPlayers: true, status: true },
  });

  // Only the OPEN <-> FULL pair is derived from capacity; anything else is a
  // deliberate lifecycle state we must not stomp.
  let status = match.status;
  if (status === 'OPEN' || status === 'FULL') {
    status = count >= match.maxPlayers ? 'FULL' : 'OPEN';
  }

  await tx.match.update({
    where: { id: matchId },
    data: { currentPlayers: count, status },
  });

  return count;
}
