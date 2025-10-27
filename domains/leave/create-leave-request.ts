import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { airline, leaveRequests, users } from '@/db/schema';
import {
  type LeaveRequestData,
  sendLeaveRequestWebhook,
} from '@/lib/webhooks/leave';

export async function sendLeaveRequestWebhookNotification(
  leaveRequestId: string,
  reason: string,
  startDate: Date,
  endDate: Date,
  userId: string
): Promise<void> {
  try {
    const [userData, airlineData] = await Promise.all([
      db
        .select({
          name: users.name,
          callsign: users.callsign,
        })
        .from(users)
        .where(eq(users.id, userId))
        .get(),
      db
        .select({
          name: airline.name,
          callsign: airline.callsign,
          leaveRequestWebhookUrl: airline.leaveRequestWebhookUrl,
        })
        .from(airline)
        .limit(1)
        .get(),
    ]);

    if (!airlineData?.leaveRequestWebhookUrl || !userData) {
      return;
    }

    const webhookPayload: LeaveRequestData = {
      id: leaveRequestId,
      pilotName: userData.name,
      pilotCallsign: userData.callsign!.toString(),
      reason,
      startDate,
      endDate,
      submittedAt: new Date(),
    };

    await sendLeaveRequestWebhook(
      airlineData.leaveRequestWebhookUrl,
      webhookPayload,
      {
        airlineName: airlineData.name,
        airlineCallsign: airlineData.callsign,
        baseUrl: process.env.BETTER_AUTH_URL,
      }
    );
  } catch {
    // Silently fail,webhook is not critical
  }
}

export async function createLeaveRequest({
  reason,
  startDate,
  endDate,
  userId,
}: {
  reason: string;
  startDate: Date;
  endDate: Date;
  userId: string;
}) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (start < now) {
    throw new Error('Start date cannot be in the past');
  }

  if (end <= start) {
    throw new Error('End date must be after start date');
  }

  const leaveRequest = await db
    .insert(leaveRequests)
    .values({
      id: randomUUID(),
      userId: userId,
      reason: reason,
      startDate: start,
      endDate: end,
      status: 'pending',
    })
    .returning();

  return leaveRequest[0];
}
