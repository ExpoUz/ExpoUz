/**
 * Repair historical player-count desync — run once, on purpose, NOT on deploy.
 *
 * Before bookings became the single source of truth, matches were created with
 * a `currentPlayers` integer and no Booking rows behind it (host missing, group
 * seats missing). This reconciles existing data:
 *
 *   1. Count real bookings (CONFIRMED / PENDING_PAYMENT) per match.
 *   2. If the host has no booking (and it isn't a pure FULL_BOOKING), create the
 *      host's booking (isHostBooking) so the host appears in a slot.
 *   3. For GROUP_BOOKING, create any missing organizer-paid guest slots so the
 *      number of seats matches organizerPlayerCount.
 *   4. Set currentPlayers = real booking count and recompute OPEN/FULL status.
 *
 * It NEVER fabricates wallet transactions — historical money is left untouched
 * and simply noted in the report.
 *
 * Usage (dry-run is the default; nothing is written without --apply):
 *   railway run npx ts-node --transpile-only scripts/repair-player-counts.ts
 *   railway run npx ts-node --transpile-only scripts/repair-player-counts.ts --apply
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

const APPLY = process.argv.includes('--apply');
const ACTIVE_STATUSES: Prisma.BookingWhereInput['status'] = {
  in: ['CONFIRMED', 'PENDING_PAYMENT'],
};

type Row = {
  matchId: string;
  title: string;
  bookingType: string;
  before: number;
  after: number;
  createdHost: boolean;
  createdGuests: number;
  note?: string;
};

async function main() {
  const matches = await prisma.match.findMany({
    where: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
    select: {
      id: true,
      title: true,
      bookingType: true,
      hostId: true,
      maxPlayers: true,
      currentPlayers: true,
      status: true,
      organizerPlayerCount: true,
      pricePerPlayer: true,
    },
  });

  const report: Row[] = [];

  for (const m of matches) {
    const activeBookings = await prisma.booking.findMany({
      where: { matchId: m.id, status: ACTIVE_STATUSES },
      select: { id: true, userId: true, isHostBooking: true, isGuestSlot: true },
    });

    let createdHost = false;
    let createdGuests = 0;
    const before = m.currentPlayers;

    const hostHasBooking = activeBookings.some(
      (b) => b.userId === m.hostId && !b.isGuestSlot,
    );
    const isFullBooking = m.bookingType === 'FULL_BOOKING';

    // 2. Host missing a slot on a match they created (except pure venue rentals).
    if (!hostHasBooking && !isFullBooking) {
      if (APPLY) {
        await prisma.booking.create({
          data: {
            userId: m.hostId,
            matchId: m.id,
            status: 'CONFIRMED',
            teamSide: 'HOME',
            isHostBooking: true,
            qrCode: `${m.id}_host_${randomBytes(4).toString('hex')}`,
          },
        });
      }
      createdHost = true;
    }

    // 3. GROUP_BOOKING missing organizer-paid guest slots.
    if (m.bookingType === 'GROUP_BOOKING' && m.organizerPlayerCount) {
      const hostSeats = (!hostHasBooking && !isFullBooking) || hostHasBooking ? 1 : 0;
      const existingGuestSlots = activeBookings.filter((b) => b.isGuestSlot).length;
      const wantGuests = Math.max(0, m.organizerPlayerCount - hostSeats);
      const missing = Math.max(0, wantGuests - existingGuestSlots);
      for (let i = 0; i < missing; i++) {
        if (APPLY) {
          await prisma.booking.create({
            data: {
              userId: m.hostId,
              matchId: m.id,
              status: 'CONFIRMED',
              teamSide: 'HOME',
              isGuestSlot: true,
              guestLabel: `Guest ${existingGuestSlots + i + 1}`,
              qrCode: `${m.id}_guest_${randomBytes(4).toString('hex')}`,
            },
          });
        }
        createdGuests++;
      }
    }

    // 4. Recompute the derived count + status from the real bookings.
    const after = activeBookings.length + (createdHost ? 1 : 0) + createdGuests;
    let status = m.status;
    if (status === 'OPEN' || status === 'FULL') {
      status = after >= m.maxPlayers ? 'FULL' : 'OPEN';
    }
    if (APPLY) {
      await prisma.match.update({
        where: { id: m.id },
        data: { currentPlayers: after, status },
      });
    }

    if (before !== after || createdHost || createdGuests > 0) {
      report.push({
        matchId: m.id,
        title: m.title,
        bookingType: m.bookingType,
        before,
        after,
        createdHost,
        createdGuests,
        note:
          Number(m.pricePerPlayer) > 0 && (createdHost || createdGuests > 0)
            ? 'historical seats created WITHOUT wallet charge (financials untouched)'
            : undefined,
      });
    }
  }

  console.log(`\n${APPLY ? 'APPLIED' : 'DRY-RUN'} — ${matches.length} matches scanned, ${report.length} changed\n`);
  for (const r of report) {
    console.log(
      `• ${r.matchId} [${r.bookingType}] "${r.title}"\n` +
        `    currentPlayers ${r.before} → ${r.after}` +
        (r.createdHost ? ' · +host slot' : '') +
        (r.createdGuests ? ` · +${r.createdGuests} guest slot(s)` : '') +
        (r.note ? `\n    ⚠ ${r.note}` : ''),
    );
  }
  if (!APPLY) {
    console.log('\nNo changes written. Re-run with --apply after reviewing the above.\n');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
