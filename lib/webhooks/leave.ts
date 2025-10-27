import { formatFullCallsign } from '@/lib/utils';
import {
  createDiscordEmbed,
  type DiscordWebhookPayload,
  sendDiscordWebhook,
} from '@/lib/webhooks/index';
import type { LeaveRequestData, WebhookOptions } from '@/types/webhooks';

export type { LeaveRequestData };

export async function sendLeaveRequestWebhook(
  webhookUrl: string,
  leaveData: LeaveRequestData,
  options: WebhookOptions
): Promise<void> {
  const { airlineName, airlineCallsign } = options;
  const fullCallsign = formatFullCallsign(
    airlineCallsign,
    leaveData.pilotCallsign
  );
  const submittedTs = Math.floor(leaveData.submittedAt.getTime() / 1000);
  const startTs = Math.floor(leaveData.startDate.getTime() / 1000);
  const endTs = Math.floor(leaveData.endDate.getTime() / 1000);

  const lines = [
    `👨‍✈️ **Pilot:** ${leaveData.pilotName} (\`${fullCallsign}\`)`,
    `📅 **Duration:** <t:${startTs}:D> → <t:${endTs}:D>`,
    `📝 **Reason:** ${leaveData.reason}`,
    `⏰ **Submitted:** <t:${submittedTs}:R>`,
  ];

  lines.push(
    `[View Leave Request](${options.baseUrl}/admin/leave/${leaveData.id})`
  );

  const embed = createDiscordEmbed({
    title: '🏖️ New Leave Request',
    description: lines.join('\n\n'),
    color: 0x3498db,
    footer: { text: airlineName },
    timestamp: leaveData.submittedAt.toISOString(),
  });

  const payload: DiscordWebhookPayload = {
    embeds: [embed],
  };

  await sendDiscordWebhook({ url: webhookUrl, payload });
}
