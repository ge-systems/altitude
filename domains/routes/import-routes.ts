import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

import { parse } from 'csv-parse';
import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db';
import {
  aircraft,
  routeAircraft,
  routes,
  routesFlightNumbers,
} from '@/db/schema';
import { createRoute } from '@/domains/routes/create-route';
import { convertTimeToMinutes } from '@/lib/utils';

const csvRowSchema = z.object({
  departure_icao: z.string().length(4),
  arrival_icao: z.string().length(4),
  flight_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/, {
    message: 'Flight time must be in HH:MM format (00:00-23:59)',
  }),
  details: z.string().optional(),
  flight_numbers: z.string().optional(),
  aircraft: z.string().optional(),
});

export async function importRoutesFromCsv(
  file: File
): Promise<{ created: number; skipped: number; total: number }> {
  const parser = parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  const stream = Readable.fromWeb(
    file.stream() as unknown as WebReadableStream
  );
  const records = stream.pipe(parser);

  let createdCount = 0;
  let skippedCount = 0;
  let totalCount = 0;
  let batchCount = 0;
  for await (const record of records) {
    totalCount += 1;
    batchCount += 1;
    const row = csvRowSchema.parse(record);
    const flightNumbers = row.flight_numbers
      ? row.flight_numbers
          .split(';')
          .map((n) => n.trim().toUpperCase())
          .filter(Boolean)
      : [];
    // Parse aircraft column: "Name - Livery; Name - Livery"
    const combined = row.aircraft
      ? row.aircraft
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    let aircraftIds: string[] = [];
    if (combined.length > 0) {
      // Enforce entries like "Airbus A320 - Air France; Airbus A320 - Air Asia"
      const pairConds: ReturnType<typeof and>[] = [];
      const pairLabels: string[] = [];
      const invalid: string[] = [];

      for (const entry of combined) {
        // Prefer splitting on " - " to avoid breaking names with hyphens inside values
        const parts = entry.split(' - ');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const livery = parts.slice(1).join(' - ').trim();
          if (name && livery) {
            pairConds.push(
              and(eq(aircraft.name, name), eq(aircraft.livery, livery))
            );
            pairLabels.push(`${name} (${livery})`);
          } else {
            invalid.push(entry);
          }
        } else {
          invalid.push(entry);
        }
      }

      if (invalid.length > 0) {
        throw new Error(
          `Each aircraft must be in "Name - Livery" format. Invalid: ${invalid.join(
            ', '
          )}`
        );
      }

      if (pairConds.length > 0) {
        const pairRecords = await db
          .select({
            id: aircraft.id,
            name: aircraft.name,
            livery: aircraft.livery,
          })
          .from(aircraft)
          .where(or(...pairConds));

        const foundPairs = new Set(
          pairRecords.map((a) => `${a.name}\u0000${a.livery}`)
        );
        const missingPairs = pairLabels.filter((label) => {
          const open = label.indexOf('(');
          const close = label.lastIndexOf(')');
          if (open === -1 || close === -1) {
            return false;
          }
          const name = label.slice(0, open).trim();
          const livery = label.slice(open + 1, close).trim();
          return !foundPairs.has(`${name}\u0000${livery}`);
        });
        if (missingPairs.length > 0) {
          throw new Error(
            `Unknown aircraft/livery: ${missingPairs.join(', ')}`
          );
        }
        aircraftIds = Array.from(new Set(pairRecords.map((a) => a.id)));
      }
    }

    // Duplicate detection by dep/arr/time/details and exact sets of flight numbers and aircraft
    const departureIcao = row.departure_icao.toUpperCase();
    const arrivalIcao = row.arrival_icao.toUpperCase();
    const flightTime = convertTimeToMinutes(row.flight_time);
    if (flightTime === null) {
      throw new Error(`Invalid flight time format: ${row.flight_time}`);
    }
    const details = row.details ?? null;

    const candidateRoutes = await db
      .select({ id: routes.id, details: routes.details })
      .from(routes)
      .where(
        and(
          eq(routes.departureIcao, departureIcao),
          eq(routes.arrivalIcao, arrivalIcao),
          eq(routes.flightTime, flightTime)
        )
      );

    let isDuplicate = false;
    for (const cand of candidateRoutes) {
      // Details must match (null equals null)
      const candDetails = cand.details ?? null;
      if (candDetails !== details) {
        continue;
      }

      const existingFlightNumbers = await db
        .select({ flightNumber: routesFlightNumbers.flightNumber })
        .from(routesFlightNumbers)
        .where(eq(routesFlightNumbers.routeId, cand.id));
      const existingFnSet = new Set(
        existingFlightNumbers.map((r) => r.flightNumber.toUpperCase())
      );
      const desiredFnSet = new Set(flightNumbers);
      const sameFns =
        existingFnSet.size === desiredFnSet.size &&
        [...existingFnSet].every((v) => desiredFnSet.has(v));
      if (!sameFns) {
        continue;
      }

      const existingAircraft = await db
        .select({ aircraftId: routeAircraft.aircraftId })
        .from(routeAircraft)
        .where(eq(routeAircraft.routeId, cand.id));
      const existingAcSet = new Set(existingAircraft.map((r) => r.aircraftId));
      const desiredAcSet = new Set(aircraftIds);
      const sameAcs =
        existingAcSet.size === desiredAcSet.size &&
        [...existingAcSet].every((v) => desiredAcSet.has(v));

      if (sameAcs) {
        isDuplicate = true;
        break;
      }
    }

    if (isDuplicate) {
      // Ignore duplicate row silently
      skippedCount += 1;
      continue;
    }

    await createRoute({
      departureIcao,
      arrivalIcao,
      flightTime,
      details: row.details,
      aircraftIds,
      flightNumbers,
    });
    createdCount += 1;

    if (batchCount >= 200) {
      batchCount = 0;
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  return { created: createdCount, skipped: skippedCount, total: totalCount };
}
