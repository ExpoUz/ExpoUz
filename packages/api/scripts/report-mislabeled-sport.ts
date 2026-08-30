/**
 * PART 1 — Report pitches whose `sport` looks wrong.
 *
 * The old `Pitch.sport @default(PADEL)` silently mislabelled football venues
 * created without an explicit sport. This script scans existing rows and reports
 * likely mismatches for HUMAN confirmation.
 *
 * It is REPORT-ONLY by design — it NEVER flips a sport. A venue name is a hint,
 * not proof; a human decides. To correct a row, do it deliberately in the admin
 * panel or with a targeted update after reviewing this output.
 *
 * Usage:
 *   railway run npx ts-node --transpile-only scripts/report-mislabeled-sport.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Keyword heuristics on name + description. Kept deliberately conservative.
const FOOTBALL_HINTS = /футбол|football|futbol|mini[-\s]?football|5-a-side|7-a-side|11-a-side|turf|soccer|arena/i;
const PADEL_HINTS = /падел|padel|court|panoramic/i;
const TENNIS_HINTS = /теннис|tennis/i;

type Suspect = {
  id: string;
  name: string;
  sport: string;
  looksLike: string;
  matched: string;
};

async function main() {
  const pitches = await prisma.pitch.findMany({
    select: { id: true, name: true, description: true, sport: true },
    orderBy: { createdAt: 'asc' },
  });

  const suspects: Suspect[] = [];

  for (const p of pitches) {
    const hay = `${p.name} ${p.description ?? ''}`;
    // "arena" is a weak football hint, so require it not also match padel/tennis.
    const looksFootball = FOOTBALL_HINTS.test(hay) && !PADEL_HINTS.test(hay) && !TENNIS_HINTS.test(hay);
    const looksPadel = PADEL_HINTS.test(hay) && !FOOTBALL_HINTS.test(hay);
    const looksTennis = TENNIS_HINTS.test(hay) && !FOOTBALL_HINTS.test(hay) && !PADEL_HINTS.test(hay);

    if (looksFootball && p.sport !== 'FOOTBALL') {
      suspects.push({ id: p.id, name: p.name, sport: p.sport, looksLike: 'FOOTBALL', matched: (hay.match(FOOTBALL_HINTS) ?? [''])[0] });
    } else if (looksPadel && p.sport !== 'PADEL') {
      suspects.push({ id: p.id, name: p.name, sport: p.sport, looksLike: 'PADEL', matched: (hay.match(PADEL_HINTS) ?? [''])[0] });
    } else if (looksTennis && p.sport !== 'TENNIS') {
      suspects.push({ id: p.id, name: p.name, sport: p.sport, looksLike: 'TENNIS', matched: (hay.match(TENNIS_HINTS) ?? [''])[0] });
    }
  }

  console.log(`\nScanned ${pitches.length} pitches — ${suspects.length} possible mislabel(s):\n`);
  for (const s of suspects) {
    console.log(
      `• ${s.id}  "${s.name}"\n` +
        `    stored sport: ${s.sport}  →  looks like: ${s.looksLike}  (matched "${s.matched}")`,
    );
  }
  if (suspects.length === 0) {
    console.log('  none found.\n');
  } else {
    console.log('\n⚠ REPORT ONLY — nothing was changed. Confirm each with a human before correcting.\n');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
