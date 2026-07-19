/**
 * Intentional, one-off demo-data cleanup.
 *
 * This does NOT wipe the database. It removes only the records the dev seed
 * (`prisma/seed.ts`) created — identified by their exact phone numbers and
 * pitch names — and leaves everything else (real users, real venues, the
 * super-admin account, AppSettings, and the entire wallet ledger) untouched.
 *
 * It is deliberately NOT wired into deploy. Run it by hand when you decide to:
 *   CONFIRM=cleanup pnpm --filter @expouz/api exec ts-node --transpile-only prisma/cleanup-demo.ts
 *
 * Safety:
 *   - Everything runs inside a single transaction (all-or-nothing rollback).
 *   - The wallet ledger is never deleted. If any demo user somehow has ledger
 *     entries, the script aborts so a human can investigate rather than
 *     destroying financial records.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Seed markers (mirror prisma/seed.ts) ──────────────────────────────────────
// The super admin (+998901111111) is intentionally KEPT.
const DEMO_USER_PHONES = [
  // venue owners
  '+998901222001',
  '+998901222002',
  // players
  '+998901234001',
  '+998901234002',
  '+998901234003',
  '+998901234004',
  '+998901234005',
  '+998901234006',
  '+998901234007',
  '+998901234008',
  '+998901234009',
  '+998901234010',
];

const DEMO_PITCH_NAMES = [
  'Padel Tashkent City',
  'Yunusabad Padel Club',
  'Mirzo Padel Arena',
  'Yashnabod Football Arena',
  'Bunyodkor Mini-Football',
];

async function main() {
  if (process.env.CONFIRM !== 'cleanup') {
    console.error(
      '✋ Refusing to run without confirmation.\n' +
        '   Re-run with:  CONFIRM=cleanup ts-node --transpile-only prisma/cleanup-demo.ts',
    );
    process.exit(1);
  }

  console.log('🧹 Cleaning up demo/seed data (real data is preserved)...');

  const demoUsers = await prisma.user.findMany({
    where: { phone: { in: DEMO_USER_PHONES }, role: { not: 'SUPER_ADMIN' } },
    select: { id: true, phone: true },
  });
  const userIds = demoUsers.map((u) => u.id);

  const demoPitches = await prisma.pitch.findMany({
    where: {
      OR: [{ ownerId: { in: userIds } }, { name: { in: DEMO_PITCH_NAMES } }],
    },
    select: { id: true },
  });
  const pitchIds = demoPitches.map((p) => p.id);

  const demoMatches = await prisma.match.findMany({
    where: {
      OR: [
        { hostId: { in: userIds } },
        { organizerId: { in: userIds } },
        { pitchId: { in: pitchIds } },
      ],
    },
    select: { id: true },
  });
  const matchIds = demoMatches.map((m) => m.id);

  const demoPitchBookings = await prisma.pitchBooking.findMany({
    where: { OR: [{ hostId: { in: userIds } }, { pitchId: { in: pitchIds } }] },
    select: { id: true },
  });
  const pitchBookingIds = demoPitchBookings.map((b) => b.id);

  const demoConvs = await prisma.conversation.findMany({
    where: {
      OR: [
        { members: { some: { userId: { in: userIds } } } },
        { matchId: { in: matchIds } },
        { pitchBookingId: { in: pitchBookingIds } },
      ],
    },
    select: { id: true },
  });
  const convIds = demoConvs.map((c) => c.id);

  // Guardrail: never delete wallet ledger / real financial records.
  const ledgerCount = await prisma.walletTransaction.count({
    where: { userId: { in: userIds } },
  });
  if (ledgerCount > 0) {
    console.error(
      `✋ Aborting: ${ledgerCount} wallet-ledger entries belong to demo users.\n` +
        '   The ledger is immutable financial data and will not be deleted.\n' +
        '   Investigate these users manually before cleaning up.',
    );
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    // Children of matches first.
    await tx.matchPosition.deleteMany({ where: { matchId: { in: matchIds } } });
    await tx.playerRating.deleteMany({
      where: {
        OR: [
          { matchId: { in: matchIds } },
          { raterId: { in: userIds } },
          { ratedId: { in: userIds } },
        ],
      },
    });
    await tx.transaction.deleteMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { pitchBookingId: { in: pitchBookingIds } },
        ],
      },
    });
    await tx.notification.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { matchId: { in: matchIds } }] },
    });
    await tx.booking.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { matchId: { in: matchIds } }] },
    });
    await tx.matchResult.deleteMany({ where: { matchId: { in: matchIds } } });
    await tx.match.deleteMany({ where: { id: { in: matchIds } } });

    // Direct pitch bookings.
    await tx.pitchBookingParticipant.deleteMany({
      where: {
        OR: [{ bookingId: { in: pitchBookingIds } }, { userId: { in: userIds } }],
      },
    });
    await tx.pitchBooking.deleteMany({ where: { id: { in: pitchBookingIds } } });

    // Conversations (cascades members + messages). Then any stray messages.
    await tx.conversation.deleteMany({ where: { id: { in: convIds } } });
    await tx.message.deleteMany({ where: { senderId: { in: userIds } } });

    // Audit log entries for demo users.
    await tx.activityLog.deleteMany({ where: { userId: { in: userIds } } });

    // Pitches (cascades amenities + followers).
    await tx.pitch.deleteMany({ where: { id: { in: pitchIds } } });

    // Finally the users (cascades level history, sessions, positions, tokens).
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });

  console.log('✅ Demo data removed.');
  console.log(`   - users:        ${userIds.length}`);
  console.log(`   - pitches:      ${pitchIds.length}`);
  console.log(`   - matches:      ${matchIds.length}`);
  console.log(`   - conversations:${convIds.length}`);
  console.log('   Kept: super admin, AppSettings, wallet ledger, and all real data.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
