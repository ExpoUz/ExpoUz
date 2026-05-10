import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ============ App Settings ============
  await prisma.appSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      commissionRate: 0.10,
      platformFeeRate: 0.05,
    },
  });

  // ============ Super Admin ============
  const superAdmin = await prisma.user.upsert({
    where: { phone: '+998901111111' },
    update: {},
    create: {
      phone: '+998901111111',
      firstName: 'Admin',
      lastName: 'Superuser',
      role: 'SUPER_ADMIN',
      skillLevel: 'PRO',
      eloRating: 1500,
      reliabilityScore: 100,
      city: 'Tashkent',
      isVerified: true,
    },
  });

  // ============ Pitch Owners ============
  const pitchOwner1 = await prisma.user.upsert({
    where: { phone: '+998902222221' },
    update: {},
    create: {
      phone: '+998902222221',
      firstName: 'Bobur',
      lastName: 'Yusupov',
      role: 'PITCH_OWNER',
      skillLevel: 'AMATEUR',
      eloRating: 1050,
      reliabilityScore: 95,
      city: 'Tashkent',
    },
  });

  const pitchOwner2 = await prisma.user.upsert({
    where: { phone: '+998902222222' },
    update: {},
    create: {
      phone: '+998902222222',
      firstName: 'Jasur',
      lastName: 'Karimov',
      role: 'PITCH_OWNER',
      skillLevel: 'AMATEUR',
      eloRating: 980,
      reliabilityScore: 92,
      city: 'Tashkent',
    },
  });

  const pitchOwner3 = await prisma.user.upsert({
    where: { phone: '+998902222223' },
    update: {},
    create: {
      phone: '+998902222223',
      firstName: 'Dilnoza',
      lastName: 'Rakhimova',
      role: 'PITCH_OWNER',
      skillLevel: 'BEGINNER',
      eloRating: 920,
      reliabilityScore: 88,
      city: 'Tashkent',
      gender: 'FEMALE',
    },
  });

  // ============ Players ============
  const playerData = [
    { phone: '+998901234001', firstName: 'Alisher', lastName: 'Toshmatov', elo: 1400, skill: 'PRO' },
    { phone: '+998901234002', firstName: 'Sardor', lastName: 'Mirzayev', elo: 1350, skill: 'PRO' },
    { phone: '+998901234003', firstName: 'Otabek', lastName: 'Salimov', elo: 1280, skill: 'PRO' },
    { phone: '+998901234004', firstName: 'Akbar', lastName: 'Nazarov', elo: 1200, skill: 'AMATEUR' },
    { phone: '+998901234005', firstName: 'Sherzod', lastName: 'Umarov', elo: 1150, skill: 'AMATEUR' },
    { phone: '+998901234006', firstName: 'Nodir', lastName: 'Xolmatov', elo: 1100, skill: 'AMATEUR' },
    { phone: '+998901234007', firstName: 'Temur', lastName: 'Qodirov', elo: 1050, skill: 'AMATEUR' },
    { phone: '+998901234008', firstName: 'Bekzod', lastName: 'Abdullayev', elo: 1000, skill: 'AMATEUR' },
    { phone: '+998901234009', firstName: 'Eldor', lastName: 'Tursunov', elo: 950, skill: 'AMATEUR' },
    { phone: '+998901234010', firstName: 'Ulugbek', lastName: 'Ismoilov', elo: 900, skill: 'BEGINNER' },
    { phone: '+998901234011', firstName: 'Zafar', lastName: 'Normatov', elo: 880, skill: 'BEGINNER' },
    { phone: '+998901234012', firstName: 'Islom', lastName: 'Hamidov', elo: 860, skill: 'BEGINNER' },
    { phone: '+998901234013', firstName: 'Ravshan', lastName: 'Yodgorov', elo: 840, skill: 'BEGINNER' },
    { phone: '+998901234014', firstName: 'Firdavs', lastName: 'Eshmatov', elo: 820, skill: 'BEGINNER' },
    { phone: '+998901234015', firstName: 'Doniyor', lastName: 'Sultonov', elo: 800, skill: 'BEGINNER' },
  ];

  const players = [];
  for (const pd of playerData) {
    const player = await prisma.user.upsert({
      where: { phone: pd.phone },
      update: {},
      create: {
        phone: pd.phone,
        firstName: pd.firstName,
        lastName: pd.lastName,
        role: 'PLAYER',
        skillLevel: pd.skill as any,
        eloRating: pd.elo,
        reliabilityScore: 80 + Math.random() * 20,
        city: 'Tashkent',
      },
    });
    players.push(player);
  }

  // ============ Pitches ============
  const pitch1 = await prisma.pitch.create({
    data: {
      ownerId: pitchOwner1.id,
      name: 'Yunusabad Sport Complex',
      description: 'Professional football pitch in Yunusabad district',
      addressLine: 'Yunusabad 12-kvartal, 5-uy',
      district: 'Yunusabad',
      city: 'Tashkent',
      lat: 41.3555,
      lng: 69.2913,
      hourlyRate: 150000,
      photos: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
      surfaceType: 'ARTIFICIAL',
      pitchSize: 'SEVEN_A_SIDE',
      isIndoor: false,
      isVerified: true,
      commission: 0.10,
      amenities: {
        create: [
          { type: 'BATHROOM' },
          { type: 'PARKING' },
          { type: 'CHANGING_ROOM' },
          { type: 'LIGHTS' },
        ],
      },
    },
  });

  const pitch2 = await prisma.pitch.create({
    data: {
      ownerId: pitchOwner1.id,
      name: 'Yunusabad Indoor Arena',
      description: 'Indoor futsal pitch with modern facilities',
      addressLine: 'Yunusabad 17-kvartal, 8-uy',
      district: 'Yunusabad',
      city: 'Tashkent',
      lat: 41.3620,
      lng: 69.2950,
      hourlyRate: 200000,
      photos: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
      surfaceType: 'FUTSAL',
      pitchSize: 'FIVE_A_SIDE',
      isIndoor: true,
      isVerified: true,
      commission: 0.10,
      amenities: {
        create: [
          { type: 'BATHROOM' },
          { type: 'CHANGING_ROOM' },
          { type: 'WATER_FOUNTAIN' },
          { type: 'SECURITY' },
        ],
      },
    },
  });

  const pitch3 = await prisma.pitch.create({
    data: {
      ownerId: pitchOwner2.id,
      name: 'Chilanzar Football Club',
      description: 'Community football pitch in Chilanzar',
      addressLine: 'Chilanzar 9-kvartal, 15-uy',
      district: 'Chilanzar',
      city: 'Tashkent',
      lat: 41.2995,
      lng: 69.2143,
      hourlyRate: 120000,
      photos: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
      surfaceType: 'ARTIFICIAL',
      pitchSize: 'SEVEN_A_SIDE',
      isIndoor: false,
      isVerified: true,
      commission: 0.10,
      amenities: {
        create: [
          { type: 'BATHROOM' },
          { type: 'PARKING' },
          { type: 'LIGHTS' },
        ],
      },
    },
  });

  const pitch4 = await prisma.pitch.create({
    data: {
      ownerId: pitchOwner2.id,
      name: 'Chilanzar Pro Pitch',
      description: 'Professional-grade pitch with natural turf',
      addressLine: 'Chilanzar 19-kvartal, 3-uy',
      district: 'Chilanzar',
      city: 'Tashkent',
      lat: 41.3050,
      lng: 69.2200,
      hourlyRate: 180000,
      photos: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
      surfaceType: 'NATURAL',
      pitchSize: 'ELEVEN_A_SIDE',
      isIndoor: false,
      isVerified: false,
      commission: 0.10,
      amenities: {
        create: [
          { type: 'BATHROOM' },
          { type: 'PARKING' },
          { type: 'CHANGING_ROOM' },
          { type: 'CAFE' },
        ],
      },
    },
  });

  const pitch5 = await prisma.pitch.create({
    data: {
      ownerId: pitchOwner3.id,
      name: 'Mirzo Ulugbek Sports Center',
      description: 'Modern sports complex in Mirzo Ulugbek district',
      addressLine: 'Mirzo Ulugbek, Bogʻishamol 234',
      district: 'Mirzo-Ulugbek',
      city: 'Tashkent',
      lat: 41.3300,
      lng: 69.3450,
      hourlyRate: 160000,
      photos: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
      surfaceType: 'ARTIFICIAL',
      pitchSize: 'SEVEN_A_SIDE',
      isIndoor: false,
      isVerified: true,
      commission: 0.10,
      amenities: {
        create: [
          { type: 'BATHROOM' },
          { type: 'PARKING' },
          { type: 'WATER_FOUNTAIN' },
          { type: 'LIGHTS' },
          { type: 'SECURITY' },
        ],
      },
    },
  });

  const pitch6 = await prisma.pitch.create({
    data: {
      ownerId: pitchOwner3.id,
      name: 'Mirzo Ulugbek Mini Arena',
      description: 'Compact futsal arena perfect for quick games',
      addressLine: 'Mirzo Ulugbek, Shayxontohur 12',
      district: 'Mirzo-Ulugbek',
      city: 'Tashkent',
      lat: 41.3250,
      lng: 69.3400,
      hourlyRate: 100000,
      photos: ['https://res.cloudinary.com/demo/image/upload/sample.jpg'],
      surfaceType: 'FUTSAL',
      pitchSize: 'FIVE_A_SIDE',
      isIndoor: true,
      isVerified: true,
      commission: 0.10,
      amenities: {
        create: [
          { type: 'BATHROOM' },
          { type: 'WATER_FOUNTAIN' },
        ],
      },
    },
  });

  // ============ Matches ============
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const threeDays = new Date(now.getTime() + 72 * 60 * 60 * 1000);

  function matchTime(base: Date, hour: number): Date {
    const d = new Date(base);
    d.setHours(hour, 0, 0, 0);
    return d;
  }

  const match1 = await prisma.match.create({
    data: {
      pitchId: pitch1.id,
      hostId: players[0].id,
      title: 'Football at Yunusabad Sport Complex - Morning 7v7',
      sport: 'FOOTBALL',
      format: '7v7',
      startTime: matchTime(tomorrow, 9),
      durationMinutes: 90,
      maxPlayers: 14,
      minPlayers: 10,
      pricePerPlayer: 30000,
      status: 'OPEN',
      isCoEd: true,
      skillFilter: 'AMATEUR',
      formation: '3-3-1',
    },
  });

  const match2 = await prisma.match.create({
    data: {
      pitchId: pitch2.id,
      hostId: players[1].id,
      title: 'Indoor Futsal - Chilanzar Evening',
      sport: 'FOOTBALL',
      format: '5v5',
      startTime: matchTime(tomorrow, 19),
      durationMinutes: 60,
      maxPlayers: 10,
      minPlayers: 6,
      pricePerPlayer: 25000,
      status: 'FULL',
      isCoEd: false,
      currentPlayers: 10,
    },
  });

  const match3 = await prisma.match.create({
    data: {
      pitchId: pitch3.id,
      hostId: players[2].id,
      title: 'Chilanzar Football Club - 7v7 Match',
      sport: 'FOOTBALL',
      format: '7v7',
      startTime: matchTime(dayAfter, 17),
      durationMinutes: 90,
      maxPlayers: 14,
      minPlayers: 10,
      pricePerPlayer: 22000,
      status: 'OPEN',
      isCoEd: true,
    },
  });

  const match4 = await prisma.match.create({
    data: {
      pitchId: pitch5.id,
      hostId: players[3].id,
      title: 'Mirzo Ulugbek Sports - Beginners Welcome',
      sport: 'FOOTBALL',
      format: '7v7',
      startTime: matchTime(dayAfter, 15),
      durationMinutes: 60,
      maxPlayers: 14,
      minPlayers: 8,
      pricePerPlayer: 20000,
      status: 'OPEN',
      isCoEd: true,
      skillFilter: 'BEGINNER',
      currentPlayers: 6,
    },
  });

  const match5 = await prisma.match.create({
    data: {
      pitchId: pitch1.id,
      hostId: players[4].id,
      title: 'Pro Level Football - Yunusabad',
      sport: 'FOOTBALL',
      format: '11v11',
      startTime: matchTime(threeDays, 18),
      durationMinutes: 90,
      maxPlayers: 22,
      minPlayers: 16,
      pricePerPlayer: 35000,
      status: 'OPEN',
      isCoEd: false,
      skillFilter: 'PRO',
      currentPlayers: 8,
    },
  });

  const completedMatch = await prisma.match.create({
    data: {
      pitchId: pitch3.id,
      hostId: players[0].id,
      title: 'Completed Match - Chilanzar',
      sport: 'FOOTBALL',
      format: '7v7',
      startTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      durationMinutes: 90,
      maxPlayers: 14,
      minPlayers: 10,
      pricePerPlayer: 25000,
      status: 'COMPLETED',
      isCoEd: true,
      currentPlayers: 12,
    },
  });

  const match7 = await prisma.match.create({
    data: {
      pitchId: pitch6.id,
      hostId: players[5].id,
      title: 'Basketball Match - Mirzo Ulugbek',
      sport: 'BASKETBALL',
      format: '5v5',
      startTime: matchTime(tomorrow, 20),
      durationMinutes: 60,
      maxPlayers: 10,
      minPlayers: 6,
      pricePerPlayer: 18000,
      status: 'OPEN',
      isCoEd: true,
      currentPlayers: 4,
    },
  });

  const match8 = await prisma.match.create({
    data: {
      pitchId: pitch2.id,
      hostId: players[6].id,
      title: 'Futsals Friday Night Special',
      sport: 'FOOTBALL',
      format: '5v5',
      startTime: matchTime(dayAfter, 21),
      durationMinutes: 90,
      maxPlayers: 10,
      minPlayers: 6,
      pricePerPlayer: 28000,
      status: 'OPEN',
      isCoEd: true,
      currentPlayers: 3,
    },
  });

  // ============ Bookings ============
  const bookingPairs = [
    { user: players[7], match: completedMatch, status: 'COMPLETED', transactionStatus: 'RELEASED' },
    { user: players[8], match: completedMatch, status: 'COMPLETED', transactionStatus: 'RELEASED' },
    { user: players[9], match: completedMatch, status: 'COMPLETED', transactionStatus: 'RELEASED' },
    { user: players[10], match: completedMatch, status: 'COMPLETED', transactionStatus: 'RELEASED' },
    { user: players[0], match: match2, status: 'CONFIRMED', transactionStatus: 'HELD' },
    { user: players[1], match: match2, status: 'CONFIRMED', transactionStatus: 'HELD' },
    { user: players[2], match: match2, status: 'CONFIRMED', transactionStatus: 'HELD' },
    { user: players[3], match: match2, status: 'CONFIRMED', transactionStatus: 'HELD' },
    { user: players[4], match: match2, status: 'CONFIRMED', transactionStatus: 'HELD' },
    { user: players[5], match: match1, status: 'CONFIRMED', transactionStatus: 'HELD' },
    { user: players[11], match: match1, status: 'CANCELLED_REFUND', transactionStatus: 'REFUNDED' },
  ];

  for (const bp of bookingPairs) {
    const booking = await prisma.booking.create({
      data: {
        userId: bp.user.id,
        matchId: bp.match.id,
        status: bp.status as any,
        qrCode: `${bp.match.id}_${bp.user.id}_${Date.now()}_${Math.random()}`,
        checkedIn: bp.status === 'COMPLETED',
      },
    });

    await prisma.transaction.create({
      data: {
        userId: bp.user.id,
        bookingId: booking.id,
        amount: Number(bp.match.pricePerPlayer),
        platformFee: Number(bp.match.pricePerPlayer) * 0.05,
        gateway: 'UZUM_PAY',
        status: bp.transactionStatus as any,
        heldAt: bp.transactionStatus !== 'PENDING' ? new Date() : null,
        releasedAt: bp.transactionStatus === 'RELEASED' ? new Date() : null,
        refundedAt: bp.transactionStatus === 'REFUNDED' ? new Date() : null,
      },
    });
  }

  // ============ Player Ratings ============
  const ratingPairs = [
    { matchId: completedMatch.id, raterId: players[7].id, ratedId: players[8].id, thumbsUp: true },
    { matchId: completedMatch.id, raterId: players[7].id, ratedId: players[9].id, thumbsUp: true },
    { matchId: completedMatch.id, raterId: players[8].id, ratedId: players[7].id, thumbsUp: false, comment: 'Late arrival' },
    { matchId: completedMatch.id, raterId: players[9].id, ratedId: players[7].id, thumbsUp: true },
    { matchId: completedMatch.id, raterId: players[10].id, ratedId: players[9].id, thumbsUp: true },
    { matchId: completedMatch.id, raterId: players[0].id, ratedId: players[8].id, thumbsUp: true, comment: 'Great teamwork!' },
  ];

  for (const rp of ratingPairs) {
    await prisma.playerRating.upsert({
      where: {
        matchId_raterId_ratedId: {
          matchId: rp.matchId,
          raterId: rp.raterId,
          ratedId: rp.ratedId,
        },
      },
      update: {},
      create: {
        matchId: rp.matchId,
        raterId: rp.raterId,
        ratedId: rp.ratedId,
        thumbsUp: rp.thumbsUp,
        comment: rp.comment,
      },
    });
  }

  console.log('✅ Seeding complete!');
  console.log(`   - 1 super admin`);
  console.log(`   - 3 pitch owners`);
  console.log(`   - 15 players`);
  console.log(`   - 6 pitches`);
  console.log(`   - 8 matches`);
  console.log(`   - ${bookingPairs.length} bookings`);
  console.log(`   - ${ratingPairs.length} ratings`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
