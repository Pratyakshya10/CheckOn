import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const client = new SESv2Client({});
const FROM_ADDRESS = process.env.SES_FROM_ADDRESS ?? "alerts@checkon.app";

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  await client.send(
    new SendEmailCommand({
      FromEmailAddress: FROM_ADDRESS,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: html, Charset: "UTF-8" },
            Text: { Data: text, Charset: "UTF-8" },
          },
        },
      },
    })
  );
}
