import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { getAuthUser } from "../../lib/auth/get-user";
import { getSubscription } from "../../lib/db/subscriptions";
import { reserveManualCheck } from "../../lib/db/watches";

const sqs = new SQSClient({});
const FETCH_QUEUE_URL = process.env.FETCH_QUEUE_URL ?? "";

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const user = getAuthUser(event);
  if (!user) return json(401, { error: "authentication required" });

  const watchId = event.pathParameters?.watchId;
  if (!watchId) return json(400, { error: "watchId is required" });

  const subscription = await getSubscription(user.email, watchId);
  if (!subscription) return json(404, { error: "watch subscription not found" });
  if (!(await reserveManualCheck(watchId))) {
    return json(429, { error: "Please wait a minute before checking this watch again" });
  }

  await sqs.send(
    new SendMessageCommand({
      QueueUrl: FETCH_QUEUE_URL,
      MessageBody: JSON.stringify({ watchId }),
    })
  );

  return json(202, { enqueued: true, watchId });
}

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
