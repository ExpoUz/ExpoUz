import { PrismaClient, PlayerLevel } from '@prisma/client';

const prisma = new PrismaClient();

function levelFor(games: number): PlayerLevel {
  if (games >= 61) return 'ELITE';
  if (games >= 31) return 'VETERAN';
  if (games >= 16) return 'EXPERIENCED';
  if (games >= 6) return 'REGULAR';
  if (games >= 1) return 'ROOKIE';
  return 'NEW';
}

const PADEL_PHOTOS = [
  'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800',
  'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800',
  'https://images.unsplash.com/photo-1591491653056-4313b9e1f9c2?w=800',
];
const FOOTBALL_PHOTOS = [
  'https://images.unsplash.com/photo-1486286701208-1d58e9338013?w=800',
  'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800',
];

// Hard caps per sport+format (mirrors api/src/matches/format-caps.ts).
const CAP: Record<string, number> = { '5v5': 10, '6v6': 12, '1v1': 2, '2v2': 4 };

async function main() {
  console.log('🌱 Seeding dual-sport (football + padel) database...');

  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: { id: 'singleton', commissionRate: 0.1, platformFeeRate: 0.05, cancellationFeeRate: 0.5, cancellationWindowHours: 5 },
  });

  // ── Super admin (phone login: +998901111111) ──
  const superAdmin = await prisma.user.upsert({
    where: { phone: '+998901111111' },
    update: { role: 'SUPER_ADMIN' },
    create: {
      phone: '+998901111111', firstName: 'Admin', lastName: 'Superuser', role: 'SUPER_ADMIN',
      skillLevel: 'PRO', eloRating: 1500, padelLevel: 5.0, padelReliability: 80, padelInitialSet: true,
      city: 'Tashkent', isVerified: true,
    },
  });

  // ── Venue owners ──
  const owner1 = await prisma.user.upsert({
    where: { phone: '+998901222001' }, update: { role: 'PITCH_OWNER' },
    create: { phone: '+998901222001', firstName: 'Jasur', lastName: 'Karimov', role: 'PITCH_OWNER', city: 'Tashkent', isVerified: true },
  });
  const owner2 = await prisma.user.upsert({
    where: { phone: '+998901222002' }, update: { role: 'PITCH_OWNER' },
    create: { phone: '+998901222002', firstName: 'Dilshod', lastName: 'Rashidov', role: 'PITCH_OWNER', city: 'Tashkent', isVerified: true },
  });

  // ── Players — each has an independent football track (elo/skill/games) and
  //    padel track (padelLevel/reliability), spread across the 0–7 level bands. ──
  const playerData = [
    { phone: '+998901234001', firstName: 'Alisher', lastName: 'Toshmatov', elo: 1400, games: 72, district: 'Mirzo-Ulugbek', padel: 5.5, pr: 82, pP: 44, pW: 30 },
    { phone: '+998901234002', firstName: 'Sardor', lastName: 'Mirzayev', elo: 1350, games: 45, district: 'Yunusabad', padel: 4.8, pr: 74, pP: 33, pW: 19 },
    { phone: '+998901234003', firstName: 'Otabek', lastName: 'Salimov', elo: 1280, games: 28, district: 'Chilanzar', padel: 4.2, pr: 68, pP: 26, pW: 14 },
    { phone: '+998901234004', firstName: 'Akbar', lastName: 'Nazarov', elo: 1200, games: 19, district: 'Mirzo-Ulugbek', padel: 3.6, pr: 60, pP: 20, pW: 11 },
    { phone: '+998901234005', firstName: 'Sherzod', lastName: 'Umarov', elo: 1150, games: 12, district: 'Yunusabad', padel: 3.1, pr: 52, pP: 15, pW: 8 },
    { phone: '+998901234006', firstName: 'Nodir', lastName: 'Xolmatov', elo: 1100, games: 8, district: 'Chilanzar', padel: 2.7, pr: 44, pP: 11, pW: 5 },
    { phone: '+998901234007', firstName: 'Temur', lastName: 'Qodirov', elo: 1050, games: 4, district: 'Yunusabad', padel: 2.3, pr: 36, pP: 7, pW: 3 },
    { phone: '+998901234008', firstName: 'Bekzod', lastName: 'Abdullayev', elo: 1000, games: 2, district: 'Mirzo-Ulugbek', padel: 1.8, pr: 28, pP: 4, pW: 2 },
    { phone: '+998901234009', firstName: 'Eldor', lastName: 'Tursunov', elo: 950, games: 1, district: 'Chilanzar', padel: 1.2, pr: 20, pP: 2, pW: 1 },
    { phone: '+998901234010', firstName: 'Ulugbek', lastName: 'Ismoilov', elo: 900, games: 0, district: 'Yunusabad', padel: 0.0, pr: 0, pP: 0, pW: 0 },
  ];

  const players = [];
  for (const pd of playerData) {
    const assessed = pd.padel > 0;
    const data = {
      firstName: pd.firstName, lastName: pd.lastName, role: 'PLAYER' as const,
      skillLevel: (pd.elo >= 1250 ? 'PRO' : pd.elo >= 1050 ? 'AMATEUR' : 'BEGINNER') as 'PRO' | 'AMATEUR' | 'BEGINNER',
      eloRating: pd.elo, gamesAttended: pd.games, gamesThisMonth: Math.min(pd.games, 3), playerLevel: levelFor(pd.games),
      reliabilityScore: 80 + (pd.elo % 17),
      padelLevel: pd.padel, padelReliability: pd.pr, padelInitialSet: assessed,
      padelMatchesPlayed: pd.pP, padelMatchesWon: pd.pW, padelMatchesLost: pd.pP - pd.pW,
      city: 'Tashkent', district: pd.district, credit: 300000,
    };
    const p = await prisma.user.upsert({
      where: { phone: pd.phone },
      update: data,
      create: { phone: pd.phone, ...data },
    });
    players.push(p);

    // Seed a little padel level history for the chart on assessed players.
    if (assessed) {
      await prisma.levelHistory.create({
        data: { userId: p.id, level: Math.max(0, pd.padel - 0.3), reliability: Math.max(0, pd.pr - 10), change: pd.padel - 0.3, reason: 'Initial assessment' },
      });
      await prisma.levelHistory.create({
        data: { userId: p.id, level: pd.padel, reliability: pd.pr, change: 0.3, reason: 'Won competitive match' },
      });
    }
  }

  // ── Padel courts (sport = PADEL) ──
  const padelClubs = await Promise.all([
    prisma.pitch.create({
      data: {
        ownerId: owner1.id, name: 'Padel Tashkent City', description: 'Premium panoramic padel courts in the city centre',
        addressLine: 'Amir Temur 108', district: 'Mirzo-Ulugbek', city: 'Tashkent', lat: 41.33, lng: 69.345,
        hourlyRate: 200000, photos: [PADEL_PHOTOS[0]], sport: 'PADEL', courtType: 'PANORAMIC', isCovered: true, isVerified: true,
        amenities: { create: [{ type: 'CHANGING_ROOM' }, { type: 'PARKING' }, { type: 'CAFE' }, { type: 'LIGHTS' }] },
      },
    }),
    prisma.pitch.create({
      data: {
        ownerId: owner1.id, name: 'Yunusabad Padel Club', description: 'Friendly club with classic and singles courts',
        addressLine: 'Yunusabad 12-kvartal', district: 'Yunusabad', city: 'Tashkent', lat: 41.3555, lng: 69.2913,
        hourlyRate: 160000, photos: [PADEL_PHOTOS[1]], sport: 'PADEL', courtType: 'CLASSIC', isCovered: false, isVerified: true,
        amenities: { create: [{ type: 'CHANGING_ROOM' }, { type: 'PARKING' }, { type: 'WATER_FOUNTAIN' }] },
      },
    }),
    prisma.pitch.create({
      data: {
        ownerId: owner2.id, name: 'Mirzo Padel Arena', description: 'Indoor padel arena, open late',
        addressLine: 'Chilanzar 9-kvartal', district: 'Chilanzar', city: 'Tashkent', lat: 41.275, lng: 69.203,
        hourlyRate: 180000, photos: [PADEL_PHOTOS[2]], sport: 'PADEL', courtType: 'PANORAMIC', isCovered: true, isVerified: true,
        amenities: { create: [{ type: 'CHANGING_ROOM' }, { type: 'CAFE' }, { type: 'LIGHTS' }, { type: 'SECURITY' }] },
      },
    }),
  ]);

  // ── Football pitches (sport = FOOTBALL) ──
  const footballPitches = await Promise.all([
    prisma.pitch.create({
      data: {
        ownerId: owner2.id, name: 'Yashnabod Football Arena', description: 'Indoor 5-a-side turf with floodlights',
        addressLine: 'Yashnabod 4-kvartal', district: 'Yashnabod', city: 'Tashkent', lat: 41.29, lng: 69.36,
        hourlyRate: 280000, photos: [FOOTBALL_PHOTOS[0]], sport: 'FOOTBALL', surfaceType: 'INDOOR_TURF', pitchSize: 'FIVE_A_SIDE', isIndoor: true, isVerified: true,
        amenities: { create: [{ type: 'CHANGING_ROOM' }, { type: 'PARKING' }, { type: 'LIGHTS' }, { type: 'SECURITY' }] },
      },
    }),
    prisma.pitch.create({
      data: {
        ownerId: owner1.id, name: 'Bunyodkor Mini-Football', description: 'Outdoor artificial pitch, 6v6 friendly',
        addressLine: 'Chilanzar Bunyodkor 5', district: 'Chilanzar', city: 'Tashkent', lat: 41.285, lng: 69.205,
        hourlyRate: 240000, photos: [FOOTBALL_PHOTOS[1]], sport: 'FOOTBALL', surfaceType: 'ARTIFICIAL', pitchSize: 'SEVEN_A_SIDE', isIndoor: false, isVerified: true,
        amenities: { create: [{ type: 'CHANGING_ROOM' }, { type: 'PARKING' }, { type: 'WATER_FOUNTAIN' }] },
      },
    }),
  ]);

  // ── Matches (football 5v5/6v6 + padel 1v1/2v2) ──
  const now = Date.now();
  const H = 3600 * 1000;
  type MSpec = {
    sport: 'FOOTBALL' | 'PADEL'; venue: any; host: number; format: string; inH: number; price: number; fill: number;
    matchType?: 'CASUAL' | 'COMPETITIVE'; minLevel?: number; maxLevel?: number;
  };
  const matchSpecs: MSpec[] = [
    // Padel
    { sport: 'PADEL', venue: padelClubs[0], host: 0, format: '2v2', inH: 6, price: 60000, fill: 3, matchType: 'COMPETITIVE', minLevel: 4.0, maxLevel: 6.0 },
    { sport: 'PADEL', venue: padelClubs[1], host: 1, format: '2v2', inH: 24, price: 50000, fill: 2, matchType: 'CASUAL' },
    { sport: 'PADEL', venue: padelClubs[2], host: 2, format: '2v2', inH: 30, price: 55000, fill: 1, matchType: 'COMPETITIVE', minLevel: 2.5, maxLevel: 4.5 },
    { sport: 'PADEL', venue: padelClubs[0], host: 3, format: '1v1', inH: 48, price: 70000, fill: 1, matchType: 'COMPETITIVE' },
    { sport: 'PADEL', venue: padelClubs[1], host: 4, format: '1v1', inH: 72, price: 65000, fill: 0, matchType: 'CASUAL' },
    // Football
    { sport: 'FOOTBALL', venue: footballPitches[0], host: 0, format: '5v5', inH: 8, price: 40000, fill: 7 },
    { sport: 'FOOTBALL', venue: footballPitches[1], host: 2, format: '6v6', inH: 26, price: 35000, fill: 9 },
    { sport: 'FOOTBALL', venue: footballPitches[0], host: 5, format: '5v5', inH: 50, price: 45000, fill: 10 },
    { sport: 'FOOTBALL', venue: footballPitches[1], host: 6, format: '6v6', inH: 74, price: 30000, fill: 0 },
  ];

  let matchCount = 0;
  let bookingCount = 0;
  for (const s of matchSpecs) {
    const host = players[s.host];
    const cap = CAP[s.format] ?? 4;
    const start = new Date(now + s.inH * H);
    const shareCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const fill = Math.min(s.fill, cap);

    const match = await prisma.match.create({
      data: {
        pitchId: s.venue.id, hostId: host.id, organizerId: host.id,
        title: `${s.format} ${s.sport === 'PADEL' ? 'Padel' : 'Football'} at ${s.venue.name}`,
        sport: s.sport, format: s.format, startTime: start, durationMinutes: s.sport === 'PADEL' ? 90 : 60,
        maxPlayers: cap, minPlayers: Math.max(2, Math.floor(cap * 0.7)), currentPlayers: fill, pricePerPlayer: s.price,
        bookingType: 'OPEN_EVENT', status: fill >= cap ? 'FULL' : 'OPEN', isCoEd: true,
        matchType: s.matchType ?? 'COMPETITIVE', minLevel: s.minLevel ?? null, maxLevel: s.maxLevel ?? null,
        shareCode, telegramShareLink: `https://t.me/ExpoScoreBot?start=join_${shareCode}`,
      },
    });
    matchCount++;

    const seated = [host, ...players.filter((p) => p.id !== host.id)].slice(0, fill);
    let i = 0;
    for (const u of seated) {
      await prisma.booking.create({
        data: { userId: u.id, matchId: match.id, status: 'CONFIRMED', teamSide: i % 2 === 0 ? 'HOME' : 'AWAY' },
      });
      bookingCount++;
      i++;
    }
  }

  // ── A completed, confirmed competitive padel result (level-affecting) ──
  const pastStart = new Date(now - 24 * H);
  const finishedMatch = await prisma.match.create({
    data: {
      pitchId: padelClubs[0].id, hostId: players[0].id, organizerId: players[0].id,
      title: '2v2 Padel at Padel Tashkent City', sport: 'PADEL', format: '2v2', startTime: pastStart,
      durationMinutes: 90, maxPlayers: 4, minPlayers: 4, currentPlayers: 4, pricePerPlayer: 60000,
      bookingType: 'OPEN_EVENT', status: 'COMPLETED', isCoEd: true, matchType: 'COMPETITIVE', resultSubmitted: true,
    },
  });
  const resultPlayers = players.slice(0, 4);
  let j = 0;
  for (const u of resultPlayers) {
    await prisma.booking.create({
      data: { userId: u.id, matchId: finishedMatch.id, status: 'COMPLETED', teamSide: j % 2 === 0 ? 'HOME' : 'AWAY' },
    });
    j++;
  }
  await prisma.matchResult.create({
    data: {
      matchId: finishedMatch.id, team1Set1: 6, team2Set1: 3, team1Set2: 6, team2Set2: 4, winningTeam: 1,
      submittedById: players[0].id, confirmedBy: [players[0].id, players[1].id], isConfirmed: true,
      players: { connect: resultPlayers.map((p) => ({ id: p.id })) },
    },
  });

  // ── A welcome support conversation ──
  await prisma.conversation.create({
    data: {
      type: 'SUPPORT',
      members: { create: [{ userId: players[0].id }, { userId: superAdmin.id, isAdmin: true }] },
      messages: { create: { senderId: superAdmin.id, content: 'Welcome to ExpoUz! ⚽🎾 Switch sports at the top and tap a game to join.', readBy: [superAdmin.id] } },
    },
  });

  console.log('✅ Dual-sport seed complete!');
  console.log(`   - 1 super admin (+998901111111)`);
  console.log(`   - 2 venue owners`);
  console.log(`   - ${players.length} players (football ELO + padel levels)`);
  console.log(`   - ${padelClubs.length} padel courts + ${footballPitches.length} football pitches`);
  console.log(`   - ${matchCount + 1} matches (incl. 1 completed padel result)`);
  console.log(`   - ${bookingCount + resultPlayers.length} bookings`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
