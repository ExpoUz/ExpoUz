/**
 * Launch-baseline venues — REAL data, run once, on purpose.
 *
 * Unlike prisma/seed.ts (dev demo data), this inserts a small set of real,
 * presentable venues so the app isn't empty on day one. It creates NO fake
 * users, matches, bookings, or ratings — just venues attached to a real owner.
 *
 * Fill in the VENUES array below with venues you have confirmed are real, then:
 *   CONFIRM=launch pnpm --filter @expouz/api exec ts-node --transpile-only prisma/seed-launch.ts
 *
 * Idempotent: re-running updates existing venues matched by name (no duplicates).
 * Not wired into deploy — run it intentionally.
 */
import { PrismaClient, Sport } from '@prisma/client';

const prisma = new PrismaClient();

// The venue owner account these launch venues are attached to. Defaults to the
// super admin seeded in prisma/seed.ts; change to a real PITCH_OWNER phone if
// you have one.
const OWNER_PHONE = '+998901111111';

type LaunchVenue = {
  name: string;
  sport: Sport; // 'PADEL' | 'FOOTBALL'
  description: string;
  addressLine: string;
  district: string;
  city: string;
  lat: number;
  lng: number;
  hourlyRate: number; // UZS
  photos?: string[]; // real venue photo URLs (optional)
  // Padel-only
  courtType?: 'PANORAMIC' | 'CLASSIC' | 'SINGLE';
  isCovered?: boolean;
  // Football-only
  surfaceType?: 'NATURAL' | 'ARTIFICIAL' | 'FUTSAL' | 'INDOOR_TURF';
  pitchSize?: 'FIVE_A_SIDE' | 'SEVEN_A_SIDE' | 'ELEVEN_A_SIDE' | 'SINGLES' | 'DOUBLES';
  isIndoor?: boolean;
  amenities?: Array<
    'BATHROOM' | 'PARKING' | 'WATER_FOUNTAIN' | 'CHANGING_ROOM' | 'CAFE' | 'SECURITY' | 'LIGHTS'
  >;
};

// ──────────────────────────────────────────────────────────────────────────────
// REPLACE the examples below with the real venues you confirmed. Keep the list
// small (3–6 is plenty for launch).
// ──────────────────────────────────────────────────────────────────────────────
const VENUES: LaunchVenue[] = [
  // {
  //   name: 'Real Padel Club Name',
  //   sport: 'PADEL',
  //   description: 'Short, accurate description.',
  //   addressLine: 'Street, building',
  //   district: 'Mirzo-Ulugbek',
  //   city: 'Tashkent',
  //   lat: 41.33,
  //   lng: 69.34,
  //   hourlyRate: 180000,
  //   courtType: 'PANORAMIC',
  //   isCovered: true,
  //   amenities: ['CHANGING_ROOM', 'PARKING', 'LIGHTS'],
  // },
];

async function main() {
  if (process.env.CONFIRM !== 'launch') {
    console.error(
      '✋ Refusing to run without confirmation.\n' +
        '   Re-run with:  CONFIRM=launch ts-node --transpile-only prisma/seed-launch.ts',
    );
    process.exit(1);
  }
  if (VENUES.length === 0) {
    console.error('✋ VENUES is empty — fill in real venues in prisma/seed-launch.ts first.');
    process.exit(1);
  }

  const owner = await prisma.user.findUnique({ where: { phone: OWNER_PHONE } });
  if (!owner) {
    console.error(`✋ Owner account ${OWNER_PHONE} not found. Set OWNER_PHONE to a real user.`);
    process.exit(1);
  }

  for (const v of VENUES) {
    const existing = await prisma.pitch.findFirst({ where: { name: v.name } });
    const data = {
      ownerId: owner.id,
      name: v.name,
      description: v.description,
      addressLine: v.addressLine,
      district: v.district,
      city: v.city,
      lat: v.lat,
      lng: v.lng,
      hourlyRate: v.hourlyRate,
      photos: v.photos ?? [],
      sport: v.sport,
      isVerified: true,
      isActive: true,
      ...(v.sport === 'PADEL'
        ? { courtType: v.courtType ?? 'PANORAMIC', isCovered: v.isCovered ?? false }
        : {
            surfaceType: v.surfaceType ?? 'ARTIFICIAL',
            pitchSize: v.pitchSize ?? 'FIVE_A_SIDE',
            isIndoor: v.isIndoor ?? false,
          }),
    };

    if (existing) {
      await prisma.pitch.update({ where: { id: existing.id }, data });
      console.log(`↻ updated ${v.name}`);
    } else {
      const created = await prisma.pitch.create({ data });
      if (v.amenities?.length) {
        await prisma.amenity.createMany({
          data: v.amenities.map((type) => ({ pitchId: created.id, type })),
        });
      }
      console.log(`＋ created ${v.name}`);
    }
  }

  console.log(`✅ Launch baseline ready: ${VENUES.length} real venue(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
