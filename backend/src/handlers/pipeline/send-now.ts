import { sendEmail } from "../../lib/notify/ses";
import { instantAlertEmail } from "../../lib/notify/templates";

interface Input {
  watchTitle: string;
  slug: string;
  summary: string;
  reason: string;
  userId: string; // for the zero-signup path, userId IS the subscriber's email
}

const SITE_URL = process.env.PUBLIC_SITE_URL ?? "https://checkon.app";

export async function handler(input: Input) {
  const { subject, html, text } = instantAlertEmail(
    input.watchTitle,
    input.summary,
    input.reason,
    `${SITE_URL}/w/${input.slug}`
  );
  await sendEmail(input.userId, subject, html, text);
}
