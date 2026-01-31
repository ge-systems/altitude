import { db } from '../db';
import * as schema from '../db/schema';
import { seed } from 'drizzle-seed';
import { ne, asc } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { logger } from '@/lib/logger';

logger.info('🌱 Seeding database...');

async function importAirports() {
  logger.info('  - Importing airport data from CSV...');
  const csvPath = path.join(process.cwd(), 'resources', 'world-airports.csv');

  if (!fs.existsSync(csvPath)) {
    logger.warn('⚠️  world-airports.csv not found, skipping airport seeding.');
    return [];
  }

  const csv = fs.readFileSync(csvPath, 'utf8');

  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
  }) as Record<string, string>[];

  const keepTypes = ['large_airport', 'medium_airport', 'small_airport'];

  const filtered = records.filter((r) => {
    if (!keepTypes.includes(r.type)) return false;
    if (!r.ident.match(/^[A-Z]{3,4}$/)) return false;
    return true;
  });

  const toInsert: (typeof schema.airports.$inferInsert)[] = filtered.map(
    (r) => ({
      id: r.id,
      icao: r.ident,
      iata: r.iata_code || null,
      name: r.name,
      country: r.iso_country,
      continent: r.continent,
      latitude: parseFloat(r.latitude_deg),
      longitude: parseFloat(r.longitude_deg),
      elevation: r.elevation_ft ? parseInt(r.elevation_ft, 10) : null,
      type: r.type,
    })
  );

  const varsPerRow = Object.keys(toInsert[0]).length;
  const MAX_SQLITE_VARS = 999;
  const chunkSize = Math.floor(MAX_SQLITE_VARS / varsPerRow);

  let importedCount = 0;

  await db.transaction(async (tx) => {
    for (let i = 0; i < toInsert.length; i += chunkSize) {
      const batch = toInsert.slice(i, i + chunkSize);
      await tx.insert(schema.airports).values(batch);
      importedCount += batch.length;
    }
  });

  logger.info(`  - Imported ${importedCount} airports.`);

  return toInsert;
}

async function selectiveReset() {
  logger.info('🗑️  Selectively resetting database tables...');

  const [firstUser] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .orderBy(asc(schema.users.createdAt))
    .limit(1);

  if (firstUser) {
    logger.info(
      `  - Preserving initial user (ID: ${firstUser.id}) and deleting others.`
    );
    await db.delete(schema.users).where(ne(schema.users.id, firstUser.id));
  }

  const [firstAccount] = await db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .orderBy(asc(schema.accounts.createdAt))
    .limit(1);

  if (firstAccount) {
    logger.info(`  - Preserving initial account and deleting others.`);
    await db
      .delete(schema.accounts)
      .where(ne(schema.accounts.id, firstAccount.id));
  }

  const [firstSession] = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .orderBy(asc(schema.sessions.createdAt))
    .limit(1);

  if (firstSession) {
    logger.info(`  - Preserving initial session and deleting others.`);
    await db
      .delete(schema.sessions)
      .where(ne(schema.sessions.id, firstSession.id));
  }

  const tablesToClear = [
    schema.pirepEvents,
    schema.rankAircraft,
    schema.routeAircraft,
    schema.routesFlightNumbers,
    schema.leaveRequests,
    schema.pireps,
    schema.verifications,
    schema.routes,
    schema.ranks,
    schema.aircraft,
    schema.multipliers,
    schema.airports,
  ];

  for (const table of tablesToClear) {
    const tableName = Object.keys(schema).find(
      (key) => schema[key as keyof typeof schema] === table
    );
    logger.info(`  - Clearing ${tableName}`);
    await db.delete(table);
  }

  logger.info('✅ Selective reset complete.');
}

const main = async () => {
  await selectiveReset();

  logger.info('✈️  Fetching core airline data...');

  const [airline] = await db.select().from(schema.airline).limit(1);

  if (!airline) {
    logger.error(
      '❌ No airline found. Please complete the initial setup via the website before seeding.'
    );
    process.exit(1);
  }
  logger.info(`  - Found airline: "${airline.name}"`);

  const ranksData: (typeof schema.ranks.$inferInsert)[] = [
    {
      id: 'rank_cadet',
      name: 'Cadet',
      minimumFlightTime: 0,
      maximumFlightTime: 50,
      allowAllAircraft: false,
    },
    {
      id: 'rank_first_officer',
      name: 'First Officer',
      minimumFlightTime: 50,
      maximumFlightTime: 200,
      allowAllAircraft: false,
    },
    {
      id: 'rank_captain',
      name: 'Captain',
      minimumFlightTime: 200,
      maximumFlightTime: null,
      allowAllAircraft: true,
    },
  ];
  const ranks = await db.insert(schema.ranks).values(ranksData).returning();

  const importedAirports = await importAirports();

  if (importedAirports.length === 0) {
    logger.error(
      '❌ Airport data is empty. Cannot proceed with seeding routes and PIREPs.'
    );
    process.exit(1);
  }
  const airportIcaos = importedAirports.map((a) => a.icao);

  const flightNumbers: string[] = [];
  const airlineCode = airline.callsign;
  for (let i = 0; i < 50; i++) {
    flightNumbers.push(`${airlineCode}${1000 + i}`);
  }

  logger.info('🚀 Starting to seed dynamic data...');
  const nowMs = Date.now();
  const daysToMs = (days: number) => days * 24 * 60 * 60 * 1000;
  await seed(
    db,
    {
      aircraft: schema.aircraft,
      users: schema.users,
      accounts: schema.accounts,
      sessions: schema.sessions,
      routes: schema.routes,
      routesFlightNumbers: schema.routesFlightNumbers,
      pireps: schema.pireps,
    },
    {
      seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
    }
  ).refine((f) => ({
    aircraft: {
      count: 4,
      columns: {
        id: f.uuid(),
        name: f.valuesFromArray({
          values: [
            'Airbus A320neo',
            'Boeing 737-800',
            'Boeing 777-300ER',
            'Bombardier CRJ-700',
          ],
          isUnique: true,
        }),
        livery: f.default({ defaultValue: `${airline.name} Livery` }),
      },
    },

    users: {
      count: 50,
      columns: {
        id: f.uuid(),
        name: f.fullName(),
        email: f.email(),
        image: f.default({ defaultValue: null }),
        emailVerified: f.default({ defaultValue: true }),
        verified: f.default({ defaultValue: true }),
        callsign: f.int({
          minValue: airline.callsignMinRange,
          maxValue: airline.callsignMaxRange,
          isUnique: true,
        }),
        discordUsername: f.firstName({ isUnique: true }),
        discourseUsername: f.weightedRandom([
          { weight: 0.7, value: f.default({ defaultValue: null }) },
          { weight: 0.3, value: f.lastName({ isUnique: true }) },
        ]),
        infiniteFlightId: f.weightedRandom([
          { weight: 0.8, value: f.default({ defaultValue: null }) },
          { weight: 0.2, value: f.uuid() },
        ]),
        role: f.weightedRandom([
          { weight: 0.95, value: f.default({ defaultValue: null }) },
          { weight: 0.05, value: f.default({ defaultValue: 'admin' }) },
        ]),
        createdAt: f.date({
          minDate: new Date(nowMs - daysToMs(120)),
          maxDate: new Date(nowMs),
        }),
      },
      with: {
        accounts: 1,
        sessions: [{ weight: 1, count: [1, 2] }],
        pireps: [{ weight: 1, count: [5, 20] }],
      },
    },

    accounts: {
      columns: {
        id: f.uuid(),
        accountId: f.uuid(),
        providerId: f.default({ defaultValue: 'credentials' }),
        createdAt: f.date({
          minDate: new Date(nowMs - daysToMs(120)),
          maxDate: new Date(nowMs),
        }),
      },
    },

    sessions: {
      columns: {
        id: f.uuid(),
        token: f.uuid(),
        expiresAt: f.date({
          minDate: new Date(),
          maxDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }), // Expires within 30 days
        ipAddress: f.valuesFromArray({
          values: [
            '192.168.1.101',
            '172.16.0.42',
            '203.0.113.88',
            '98.138.219.231',
          ],
        }),

        userAgent: f.valuesFromArray({
          values: [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0',
          ],
        }),
        createdAt: f.default({
          defaultValue: new Date(nowMs),
        }),
      },
    },

    routes: {
      count: 100,
      columns: {
        id: f.uuid(),
        departureIcao: f.valuesFromArray({ values: airportIcaos }),
        arrivalIcao: f.valuesFromArray({ values: airportIcaos }),
        flightTime: f.int({ minValue: 60 * 60, maxValue: 15 * 60 * 60 }), // 1hr to 15hrs in seconds
      },
      with: {
        routesFlightNumbers: [{ weight: 1, count: [1, 3] }], // Each route has 1 to 3 flight numbers
      },
    },

    routesFlightNumbers: {
      columns: {
        id: f.uuid(),
        flightNumber: f.valuesFromArray({ values: flightNumbers }),
      },
    },

    pireps: {
      columns: {
        id: f.uuid(),
        flightNumber: f.valuesFromArray({ values: flightNumbers }),
        date: f.date({
          minDate: new Date(nowMs - daysToMs(45)),
          maxDate: new Date(nowMs),
        }), // Sometime in the last ~45 days
        departureIcao: f.valuesFromArray({ values: airportIcaos }),
        arrivalIcao: f.valuesFromArray({ values: airportIcaos }),
        flightTime: f.int({ minValue: 60, maxValue: 15 * 60 }),
        cargo: f.int({ minValue: 1000, maxValue: 50000 }),
        fuelBurned: f.int({ minValue: 5000, maxValue: 150000 }),
        status: f.weightedRandom([
          { weight: 0.8, value: f.default({ defaultValue: 'approved' }) },
          { weight: 0.15, value: f.default({ defaultValue: 'pending' }) },
          { weight: 0.05, value: f.default({ defaultValue: 'denied' }) },
        ]),
      },
    },
  }));

  logger.info('🔗 Linking ranks to aircraft (many-to-many)...');
  const allAircraft = await db
    .select({ id: schema.aircraft.id, name: schema.aircraft.name })
    .from(schema.aircraft);
  const smallAircraft = allAircraft
    .filter((a) => a.name.includes('CRJ'))
    .map((a) => a.id);
  const mediumAircraft = allAircraft
    .filter((a) => a.name.includes('A320') || a.name.includes('737'))
    .map((a) => a.id);

  const rankAircraftLinks: (typeof schema.rankAircraft.$inferInsert)[] = [];

  const cadetRank = ranks.find((r) => r.name === 'Cadet')!;
  for (const aircraftId of smallAircraft) {
    rankAircraftLinks.push({
      id: `cadet_ac_${aircraftId}`,
      rankId: cadetRank.id,
      aircraftId,
    });
  }

  const foRank = ranks.find((r) => r.name === 'First Officer')!;
  for (const aircraftId of [...smallAircraft, ...mediumAircraft]) {
    rankAircraftLinks.push({
      id: `fo_ac_${aircraftId}`,
      rankId: foRank.id,
      aircraftId,
    });
  }

  if (rankAircraftLinks.length > 0) {
    await db.insert(schema.rankAircraft).values(rankAircraftLinks);
  }

  logger.info('Linking routes to aircraft (many-to-many)...');
  const allRoutes = await db
    .select({ id: schema.routes.id })
    .from(schema.routes);

  const routeAircraftLinks: (typeof schema.routeAircraft.$inferInsert)[] = [];

  for (const route of allRoutes) {
    const numAircraft = Math.floor(Math.random() * 3) + 1;
    const selectedAircraft = allAircraft
      .sort(() => Math.random() - 0.5)
      .slice(0, numAircraft);

    for (const aircraft of selectedAircraft) {
      routeAircraftLinks.push({
        id: `${route.id}_${aircraft.id}`,
        routeId: route.id,
        aircraftId: aircraft.id,
      });
    }
  }

  if (routeAircraftLinks.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < routeAircraftLinks.length; i += chunkSize) {
      const batch = routeAircraftLinks.slice(i, i + chunkSize);
      await db.insert(schema.routeAircraft).values(batch);
    }
    logger.info(
      `  - Linked ${routeAircraftLinks.length} route-aircraft pairs.`
    );
  }
};

main()
  .catch((err) => {
    console.error('Seeding failed:', err);
    logger.error({ error: err }, '❌ Seeding failed:');
    process.exit(1);
  })
  .finally(async () => {
    logger.info('✅ Seeding complete.');
    process.exit(0);
  });
