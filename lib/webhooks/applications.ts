import { formatFullCallsign } from '@/lib/utils';
import {
  createDiscordEmbed,
  type DiscordWebhookPayload,
  sendDiscordWebhook,
} from '@/lib/webhooks/index';
import type { ApplicationData, WebhookOptions } from '@/types/webhooks';

export async function sendApplicationWebhook(
  webhookUrl: string,
  applicationData: ApplicationData,
  options: WebhookOptions
): Promise<void> {
  const { airlineName, airlineCallsign } = options;
  const ts = Math.floor(applicationData.submittedAt.getTime() / 1000);
  const fullCallsign = formatFullCallsign(
    airlineCallsign,
    applicationData.callsign ?? ''
  );

  const lines = [
    `**Email:** ${applicationData.email}`,
    `**Name:** ${applicationData.name}`,
    `**Discord:** ${applicationData.discordUsername}`,
  ];

  if (applicationData.callsign) {
    lines.push(`**Callsign:** \`${fullCallsign}\``);
  }

  lines.push(`📅 **Submitted:** <t:${ts}:R>`);

  lines.push(
    `[View Application](${options.baseUrl}/admin/users/${applicationData.userId})`
  );

  const embed = createDiscordEmbed({
    title: '📝 New Pilot Application',
    description: lines.join('\n\n'),
    color: 0x3498db,
    footer: { text: airlineName },
    timestamp: applicationData.submittedAt.toISOString(),
  });

  const payload: DiscordWebhookPayload = {
    embeds: [embed],
  };

  await sendDiscordWebhook({ url: webhookUrl, payload });
}
