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

async function main() {
  console.log('🌱 Seeding padel database...');

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
      phone: '+998901111111',
      firstName: 'Admin',
      lastName: 'Superuser',
      role: 'SUPER_ADMIN',
      skillLevel: 'PRO',
      eloRating: 1500,
      city: 'Tashkent',
      isVerified: true,
    },
  });

  // ── Pitch (club) owners ──
  const owner1 = await prisma.user.upsert({
    where: { phone: '+998901222001' },
    update: { role: 'PITCH_OWNER' },
    create: { phone: '+998901222001', firstName: 'Jasur', lastName: 'Karimov', role: 'PITCH_OWNER', city: 'Tashkent', isVerified: true },
  });
  const owner2 = await prisma.user.upsert({
    where: { phone: '+998901222002' },
    update: { role: 'PITCH_OWNER' },
    create: { phone: '+998901222002', firstName: 'Dilshod', lastName: 'Rashidov', role: 'PITCH_OWNER', city: 'Tashkent', isVerified: true },
  });

  // ── Players (with games-attended → level for the leaderboard) ──
  const playerData = [
    { phone: '+998901234001', firstName: 'Alisher', lastName: 'Toshmatov', elo: 1400, games: 72, district: 'Mirzo-Ulugbek' },
    { phone: '+998901234002', firstName: 'Sardor', lastName: 'Mirzayev', elo: 1350, games: 45, district: 'Yunusabad' },
    { phone: '+998901234003', firstName: 'Otabek', lastName: 'Salimov', elo: 1280, games: 28, district: 'Chilanzar' },
    { phone: '+998901234004', firstName: 'Akbar', lastName: 'Nazarov', elo: 1200, games: 19, district: 'Mirzo-Ulugbek' },
    { phone: '+998901234005', firstName: 'Sherzod', lastName: 'Umarov', elo: 1150, games: 12, district: 'Yunusabad' },
    { phone: '+998901234006', firstName: 'Nodir', lastName: 'Xolmatov', elo: 1100, games: 8, district: 'Chilanzar' },
    { phone: '+998901234007', firstName: 'Temur', lastName: 'Qodirov', elo: 1050, games: 4, district: 'Yunusabad' },
    { phone: '+998901234008', firstName: 'Bekzod', lastName: 'Abdullayev', elo: 1000, games: 2, district: 'Mirzo-Ulugbek' },
    { phone: '+998901234009', firstName: 'Eldor', lastName: 'Tursunov', elo: 950, games: 1, district: 'Chilanzar' },
    { phone: '+998901234010', firstName: 'Ulugbek', lastName: 'Ismoilov', elo: 900, games: 0, district: 'Yunusabad' },
  ];

  const players = [];
  for (const pd of playerData) {
    const p = await prisma.user.upsert({
      where: { phone: pd.phone },
      update: { gamesAttended: pd.games, playerLevel: levelFor(pd.games) },
      create: {
        phone: pd.phone,
        firstName: pd.firstName,
        lastName: pd.lastName,
        role: 'PLAYER',
        skillLevel: pd.elo >= 1250 ? 'PRO' : pd.elo >= 1050 ? 'AMATEUR' : 'BEGINNER',
        eloRating: pd.elo,
        gamesAttended: pd.games,
        gamesThisMonth: Math.min(pd.games, 3),
        playerLevel: levelFor(pd.games),
        reliabilityScore: 80 + Math.floor(Math.random() * 20),
        city: 'Tashkent',
        district: pd.district,
        credit: 300000,
      },
    });
    players.push(p);
  }

  // ── Padel clubs ──
  const clubs = await Promise.all([
    prisma.pitch.create({
      data: {
        ownerId: owner1.id, name: 'Padel Tashkent City', description: 'Premium panoramic padel courts in the city centre',
        addressLine: 'Amir Temur 108', district: 'Mirzo-Ulugbek', city: 'Tashkent', lat: 41.33, lng: 69.345,
        hourlyRate: 200000, photos: [PADEL_PHOTOS[0]], courtType: 'PANORAMIC', isCovered: true, isVerified: true,
        amenities: { create: [{ type: 'CHANGING_ROOM' }, { type: 'PARKING' }, { type: 'CAFE' }, { type: 'LIGHTS' }] },
      },
    }),
    prisma.pitch.create({
      data: {
        ownerId: owner1.id, name: 'Yunusabad Padel Club', description: 'Friendly club with classic and singles courts',
        addressLine: 'Yunusabad 12-kvartal', district: 'Yunusabad', city: 'Tashkent', lat: 41.3555, lng: 69.2913,
        hourlyRate: 160000, photos: [PADEL_PHOTOS[1]], courtType: 'CLASSIC', isCovered: false, isVerified: true,
        amenities: { create: [{ type: 'CHANGING_ROOM' }, { type: 'PARKING' }, { type: 'WATER_FOUNTAIN' }] },
      },
    }),
    prisma.pitch.create({
      data: {
        ownerId: owner2.id, name: 'Mirzo Padel Arena', description: 'Indoor padel arena, open late',
        addressLine: 'Chilanzar 9-kvartal', district: 'Chilanzar', city: 'Tashkent', lat: 41.275, lng: 69.203,
        hourlyRate: 180000, photos: [PADEL_PHOTOS[2]], courtType: 'PANORAMIC', isCovered: true, isVerified: true,
        amenities: { create: [{ type: 'CHANGING_ROOM' }, { type: 'CAFE' }, { type: 'LIGHTS' }, { type: 'SECURITY' }] },
      },
    }),
  ]);

  // ── Matches (2v2 doubles + 1v1 singles) ──
  const now = Date.now();
  const H = 3600 * 1000;
  type MSpec = { club: number; host: number; format: '1v1' | '2v2'; inH: number; price: number; fill: number };
  const matchSpecs: MSpec[] = [
    { club: 0, host: 0, format: '2v2', inH: 6, price: 60000, fill: 3 },   // almost full doubles
    { club: 1, host: 1, format: '2v2', inH: 24, price: 50000, fill: 2 },  // half doubles
    { club: 2, host: 2, format: '2v2', inH: 30, price: 55000, fill: 1 },  // open doubles
    { club: 0, host: 3, format: '1v1', inH: 48, price: 70000, fill: 1 },  // open singles
    { club: 1, host: 4, format: '2v2', inH: 52, price: 45000, fill: 4 },  // full doubles
    { club: 2, host: 0, format: '1v1', inH: 72, price: 65000, fill: 0 },  // empty singles
  ];

  let matchCount = 0;
  let bookingCount = 0;
  for (const s of matchSpecs) {
    const club = clubs[s.club];
    const host = players[s.host];
    const cap = s.format === '1v1' ? 2 : 4;
    const start = new Date(now + s.inH * H);
    const shareCode = Math.random().toString(36).slice(2, 8).toUpperCase();
    const fill = Math.min(s.fill, cap);

    const match = await prisma.match.create({
      data: {
        pitchId: club.id, hostId: host.id, organizerId: host.id,
        title: `${s.format} Padel at ${club.name}`,
        sport: 'PADEL', format: s.format, startTime: start, durationMinutes: 90,
        maxPlayers: cap, minPlayers: cap, currentPlayers: fill, pricePerPlayer: s.price,
        bookingType: 'OPEN_EVENT', status: fill >= cap ? 'FULL' : 'OPEN', isCoEd: true,
        shareCode, telegramShareLink: `https://t.me/ExpoScoreBot?start=join_${shareCode}`,
      },
    });
    matchCount++;

    // Seat `fill` distinct players (host first) as confirmed.
    const seated = [host, ...players.filter((p) => p.id !== host.id)].slice(0, fill);
    for (const u of seated) {
      await prisma.booking.create({
        data: { userId: u.id, matchId: match.id, status: 'CONFIRMED', teamSide: bookingCount % 2 === 0 ? 'HOME' : 'AWAY' },
      });
      bookingCount++;
    }
  }

  // ── A welcome support conversation ──
  await prisma.conversation.create({
    data: {
      type: 'SUPPORT',
      members: { create: [{ userId: players[0].id }, { userId: superAdmin.id, isAdmin: true }] },
      messages: { create: { senderId: superAdmin.id, content: 'Welcome to ExpoUz Padel! 🎾 Tap a game to join.', readBy: [superAdmin.id] } },
    },
  });

  console.log('✅ Padel seed complete!');
  console.log(`   - 1 super admin (+998901111111)`);
  console.log(`   - 2 club owners`);
  console.log(`   - ${players.length} players`);
  console.log(`   - ${clubs.length} padel clubs`);
  console.log(`   - ${matchCount} matches`);
  console.log(`   - ${bookingCount} bookings`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
