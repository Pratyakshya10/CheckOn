import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getWatch } from "../../lib/db/watches";
import { putSubscription } from "../../lib/db/subscriptions";
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
  const userId = getUserId(event);
  const body = JSON.parse(event.body ?? "{}") as SubscribeRequest;

  if (!userId) {
    return { statusCode: 401, body: JSON.stringify({ error: "email required to subscribe" }) };
  }
  if (!body.watchId) {
    return { statusCode: 400, body: JSON.stringify({ error: "watchId is required" }) };
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

  await putSubscription(subscription);
  await incrementSubscriberCount(body.watchId);

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

/**
 * Signed-in users (Google, via apps/api) carry the checkon_session cookie —
 * verify that first. Zero-signup subscribers (§8.1) never had a session;
 * they just typed an email into the subscribe form, so fall back to that.
 */
function getUserId(event: APIGatewayProxyEventV2): string | undefined {
  const sessionUser = getAuthUser(event);
  if (sessionUser) return sessionUser.email;

  const body = JSON.parse(event.body ?? "{}") as { email?: string };
  return body.email;
}
