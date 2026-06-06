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

  // ============ Locations ============
  const locYunusabad = await prisma.location.upsert({
    where: { id: 'loc-yunusabad' },
    update: {},
    create: {
      id: 'loc-yunusabad',
      name: 'Yunusabad Sports Zone',
      city: 'Tashkent',
      district: 'Yunusabad',
      lat: 41.3555,
      lng: 69.2913,
      isActive: true,
    },
  });

  const locChilanzar = await prisma.location.upsert({
    where: { id: 'loc-chilanzar' },
    update: {},
    create: {
      id: 'loc-chilanzar',
      name: 'Chilanzar Sports Hub',
      city: 'Tashkent',
      district: 'Chilanzar',
      lat: 41.2995,
      lng: 69.2143,
      isActive: true,
    },
  });

  const locMirzo = await prisma.location.upsert({
    where: { id: 'loc-mirzo' },
    update: {},
    create: {
      id: 'loc-mirzo',
      name: 'Mirzo-Ulugbek Arena District',
      city: 'Tashkent',
      district: 'Mirzo-Ulugbek',
      lat: 41.3300,
      lng: 69.3450,
      isActive: true,
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
      locationId: locYunusabad.id,
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
      locationId: locYunusabad.id,
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
      locationId: locChilanzar.id,
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
      locationId: locChilanzar.id,
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
      locationId: locMirzo.id,
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
      locationId: locMirzo.id,
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
      title: 'Padel Match - Mirzo Ulugbek',
      sport: 'PADEL',
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

  // ============ Pitch Bookings ============
  const now2 = new Date();

  // Completed pitch hire (2 days ago)
  const pb1 = await prisma.pitchBooking.create({
    data: {
      pitchId: pitch1.id,
      hostId: players[0].id,
      title: 'Corporate Team Outing - Morning Hire',
      type: 'GROUP_HIRE',
      startTime: new Date(now2.getTime() - 2 * 24 * 60 * 60 * 1000),
      durationHours: 2,
      totalPrice: 300000,
      status: 'COMPLETED',
      notes: 'Full pitch hire for a corporate event.',
    },
  });
  await prisma.transaction.create({
    data: {
      userId: players[0].id,
      pitchBookingId: pb1.id,
      amount: 300000,
      platformFee: 15000,
      gateway: 'PAYME',
      status: 'RELEASED',
      heldAt: new Date(now2.getTime() - 2 * 24 * 60 * 60 * 1000 - 60000),
      releasedAt: new Date(now2.getTime() - 2 * 24 * 60 * 60 * 1000 + 3600000),
    },
  });
  await prisma.pitchBookingParticipant.createMany({
    data: [
      { bookingId: pb1.id, userId: players[1].id, paidAmount: 60000 },
      { bookingId: pb1.id, userId: players[2].id, paidAmount: 60000 },
      { bookingId: pb1.id, userId: players[3].id, paidAmount: 60000 },
    ],
    skipDuplicates: true,
  });

  // Confirmed pitch hire (tomorrow)
  const pb2 = await prisma.pitchBooking.create({
    data: {
      pitchId: pitch3.id,
      hostId: players[4].id,
      title: 'Friends Reunion Match - Chilanzar',
      type: 'GROUP_HIRE',
      startTime: new Date(now2.getTime() + 24 * 60 * 60 * 1000),
      durationHours: 1,
      totalPrice: 120000,
      status: 'CONFIRMED',
      notes: 'We need access to both locker rooms.',
    },
  });
  await prisma.transaction.create({
    data: {
      userId: players[4].id,
      pitchBookingId: pb2.id,
      amount: 120000,
      platformFee: 6000,
      gateway: 'CLICK',
      status: 'HELD',
      heldAt: new Date(),
    },
  });

  // Open-join pitch hire (day after tomorrow)
  const pb3 = await prisma.pitchBooking.create({
    data: {
      pitchId: pitch5.id,
      hostId: players[5].id,
      title: 'Open Join - Mirzo Ulugbek Weekend Kick',
      type: 'OPEN_JOIN',
      startTime: new Date(now2.getTime() + 48 * 60 * 60 * 1000),
      durationHours: 2,
      totalPrice: 320000,
      pricePerParticipant: 40000,
      maxParticipants: 8,
      status: 'CONFIRMED',
    },
  });
  await prisma.transaction.create({
    data: {
      userId: players[5].id,
      pitchBookingId: pb3.id,
      amount: 320000,
      platformFee: 16000,
      gateway: 'UZUM_PAY',
      status: 'HELD',
      heldAt: new Date(),
    },
  });
  await prisma.pitchBookingParticipant.createMany({
    data: [
      { bookingId: pb3.id, userId: players[6].id, paidAmount: 40000 },
      { bookingId: pb3.id, userId: players[7].id, paidAmount: 40000 },
    ],
    skipDuplicates: true,
  });

  // Pending pitch hire
  const pb4 = await prisma.pitchBooking.create({
    data: {
      pitchId: pitch2.id,
      hostId: players[8].id,
      title: 'Indoor Futsal Friday Night',
      type: 'GROUP_HIRE',
      startTime: new Date(now2.getTime() + 72 * 60 * 60 * 1000),
      durationHours: 1,
      totalPrice: 200000,
      status: 'PENDING_PAYMENT',
    },
  });
  await prisma.transaction.create({
    data: {
      userId: players[8].id,
      pitchBookingId: pb4.id,
      amount: 200000,
      platformFee: 10000,
      gateway: 'WALLET',
      status: 'PENDING',
    },
  });

  // Cancelled pitch hire
  const pb5 = await prisma.pitchBooking.create({
    data: {
      pitchId: pitch6.id,
      hostId: players[9].id,
      title: 'Mini Arena Sunday Hire',
      type: 'GROUP_HIRE',
      startTime: new Date(now2.getTime() - 24 * 60 * 60 * 1000),
      durationHours: 1,
      totalPrice: 100000,
      status: 'CANCELLED_REFUND',
    },
  });
  await prisma.transaction.create({
    data: {
      userId: players[9].id,
      pitchBookingId: pb5.id,
      amount: 100000,
      platformFee: 5000,
      gateway: 'PAYME',
      status: 'REFUNDED',
      heldAt: new Date(now2.getTime() - 25 * 60 * 60 * 1000),
      refundedAt: new Date(now2.getTime() - 24 * 60 * 60 * 1000),
    },
  });

  // ============ User Sessions (online status) ============
  const sessionUsers = [superAdmin, pitchOwner1, pitchOwner2, players[0], players[1], players[2]];
  for (const u of sessionUsers) {
    await prisma.userSession.upsert({
      where: { userId: u.id },
      update: { lastSeenAt: new Date(now2.getTime() - Math.floor(Math.random() * 4 * 60 * 1000)) },
      create: {
        userId: u.id,
        lastSeenAt: new Date(now2.getTime() - Math.floor(Math.random() * 4 * 60 * 1000)),
        deviceInfo: 'iPhone 15 Pro / iOS 17',
        ipAddress: `10.0.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
    });
  }
  // A few offline ones (last seen > 5 min ago)
  for (const u of [players[3], players[4], pitchOwner3]) {
    await prisma.userSession.upsert({
      where: { userId: u.id },
      update: { lastSeenAt: new Date(now2.getTime() - 15 * 60 * 1000) },
      create: {
        userId: u.id,
        lastSeenAt: new Date(now2.getTime() - 15 * 60 * 1000),
        deviceInfo: 'Samsung Galaxy S24 / Android 14',
        ipAddress: `192.168.1.${Math.floor(Math.random() * 200) + 10}`,
      },
    });
  }

  // ============ Activity Logs ============
  const activityData = [
    { user: superAdmin, action: 'VERIFY_PITCH', entityType: 'Pitch', entityId: pitch1.id, meta: { pitchName: pitch1.name } },
    { user: superAdmin, action: 'VERIFY_PITCH', entityType: 'Pitch', entityId: pitch3.id, meta: { pitchName: pitch3.name } },
    { user: superAdmin, action: 'CREATE_LOCATION', entityType: 'Location', entityId: locYunusabad.id, meta: { name: locYunusabad.name } },
    { user: superAdmin, action: 'CREATE_LOCATION', entityType: 'Location', entityId: locChilanzar.id, meta: { name: locChilanzar.name } },
    { user: superAdmin, action: 'CREATE_LOCATION', entityType: 'Location', entityId: locMirzo.id, meta: { name: locMirzo.name } },
    { user: pitchOwner1, action: 'UPDATE_PITCH_AVAILABILITY', entityType: 'Pitch', entityId: pitch1.id, meta: { isActive: true } },
    { user: pitchOwner2, action: 'CANCEL_MATCH', entityType: 'Match', entityId: match3.id, meta: { reason: 'Pitch maintenance' } },
    { user: superAdmin, action: 'BAN_USER', entityType: 'User', entityId: players[14].id, meta: { reason: 'Repeated no-show' } },
    { user: superAdmin, action: 'UNBAN_USER', entityType: 'User', entityId: players[14].id, meta: { reason: 'Appeal accepted' } },
    { user: pitchOwner3, action: 'CANCEL_PITCH_BOOKING', entityType: 'PitchBooking', entityId: pb5.id, meta: { reason: 'Host request' } },
  ];

  for (let i = 0; i < activityData.length; i++) {
    const a = activityData[i];
    await prisma.activityLog.create({
      data: {
        userId: a.user.id,
        action: a.action,
        entityType: a.entityType,
        entityId: a.entityId,
        meta: a.meta,
        ipAddress: `10.10.0.${i + 1}`,
        createdAt: new Date(now2.getTime() - (activityData.length - i) * 30 * 60 * 1000),
      },
    });
  }

  // ============ Pitch Followers ============
  const followerPairs = [
    { pitchId: pitch1.id, userId: players[3].id },
    { pitchId: pitch1.id, userId: players[4].id },
    { pitchId: pitch1.id, userId: players[5].id },
    { pitchId: pitch2.id, userId: players[0].id },
    { pitchId: pitch3.id, userId: players[6].id },
    { pitchId: pitch5.id, userId: players[7].id },
    { pitchId: pitch5.id, userId: players[8].id },
  ];
  for (const fp of followerPairs) {
    await prisma.pitchFollower.upsert({
      where: { pitchId_userId: { pitchId: fp.pitchId, userId: fp.userId } },
      update: {},
      create: fp,
    });
  }

  // ============ Wallet credits for testing ============
  const walletUsers = [players[0], players[1], players[2], players[3], players[4]];
  for (const wu of walletUsers) {
    await prisma.user.update({
      where: { id: wu.id },
      data: { credit: 500000 + Math.floor(Math.random() * 500000) },
    });
  }

  console.log('✅ Seeding complete!');
  console.log(`   - 1 super admin`);
  console.log(`   - 3 pitch owners`);
  console.log(`   - 15 players`);
  console.log(`   - 3 locations`);
  console.log(`   - 6 pitches`);
  console.log(`   - 8 matches`);
  console.log(`   - ${bookingPairs.length} match bookings`);
  console.log(`   - ${ratingPairs.length} ratings`);
  console.log(`   - 5 pitch bookings`);
  console.log(`   - 9 user sessions`);
  console.log(`   - ${activityData.length} activity logs`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
