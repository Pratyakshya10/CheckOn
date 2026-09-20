import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getWatch } from "../../lib/db/watches";
import { getSubscription, putSubscription } from "../../lib/db/subscriptions";
import { parseCondition } from "../../lib/bedrock/parse-condition";
import { localHourToUtcHour } from "../../lib/timezone";
import { ddb, TABLE_WATCHES } from "../../lib/db/client";
import { getAuthUser } from "../../lib/auth/get-user";
import type { Subscription } from "../../types/subscription";
import type { SubscribeRequest } from "../../types/api";

/**
 Condition parsing 
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  let body: SubscribeRequest & { email?: string };
  try {
    body = JSON.parse(event.body ?? "{}") as SubscribeRequest & { email?: string };
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "body must be valid JSON" }) };
  }
  const sessionUser = getAuthUser(event);
  const userId = sessionUser?.email ?? body.email;

  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ error: "email required to subscribe" }) };
  }
  if (!sessionUser && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userId)) {
    return { statusCode: 400, body: JSON.stringify({ error: "email must be valid" }) };
  }
  if (!body.watchId) {
    return { statusCode: 400, body: JSON.stringify({ error: "watchId is required" }) };
  }
  if (typeof body.conditionText !== "string") {
    return { statusCode: 400, body: JSON.stringify({ error: "conditionText must be a string" }) };
  }
  if (body.deliveryMode !== "instant" && body.deliveryMode !== "digest") {
    return { statusCode: 400, body: JSON.stringify({ error: "deliveryMode must be instant or digest" }) };
  }

  const watch = await getWatch(body.watchId);
  if (!watch) {
    return { statusCode: 404, body: JSON.stringify({ error: "watch not found" }) };
  }

  const conditionRule = await parseCondition(body.conditionText ?? "");
  const timezone = body.timezone ?? "UTC";
  const digestHour = localHourToUtcHour(body.digestHour ?? 8, timezone);

  const subscription: Subscription = {
    userId,
    watchId: body.watchId,
    conditionText: body.conditionText ?? "",
    conditionRule,
    deliveryMode: body.deliveryMode ?? "instant",
    language: body.language ?? "en",
    sensitivity: "medium",
    muted: false,
    createdAt: new Date().toISOString(),
    lastNotifiedAt: null,
    digestHour,
    timezone,
  };

  const existing = await getSubscription(userId, body.watchId);
  await putSubscription(subscription);
  if (!existing) await incrementSubscriberCount(body.watchId);

  return { statusCode: 201, body: JSON.stringify(subscription) };
}

async function incrementSubscriberCount(watchId: string): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_WATCHES,
      Key: { watchId },
      UpdateExpression: "ADD subscriberCount :one",
      ExpressionAttributeValues: { ":one": 1 },
    })
  );
}
