import { sendEmail } from "../../lib/notify/ses";
import { digestEmail, type DigestLine } from "../../lib/notify/templates";
import { clearDigestItems, type DigestQueueItem } from "../../lib/db/digest-queue";

interface Input {
  userId: string; // email, for the zero-signup path
  items: DigestQueueItem[];
}

const SITE_URL = process.env.PUBLIC_SITE_URL ?? "https://checkon.app";

export async function handler(input: Input): Promise<void> {
  if (input.items.length === 0) return;

  const lines: DigestLine[] = input.items.map((item) => ({
    watchTitle: item.watchTitle,
    oneLineSummary: item.oneLineSummary,
    watchUrl: `${SITE_URL}/watch/${item.watchId}`,
  }));

  const { subject, html, text } = digestEmail(lines, []);
  await sendEmail(input.userId, subject, html, text);
  await clearDigestItems(input.items);
}
