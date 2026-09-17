import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const client = new SNSClient({});

/** SMS — cut list item enabled only if email + digest ship early. */
export async function sendSms(phoneNumberE164: string, message: string): Promise<void> {
  await client.send(
    new PublishCommand({
      PhoneNumber: phoneNumberE164,
      Message: message,
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
      },
    })
  );
}
