import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { deleteSubscription, getSubscription } from "../../lib/db/subscriptions";
import { ddb, TABLE_WATCHES } from "../../lib/db/client";
import { getAuthUser } from "../../lib/auth/get-user";

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const userId = getAuthUser(event)?.email;
  const watchId = event.pathParameters?.watchId;

  if (!userId) return { statusCode: 401, body: JSON.stringify({ error: "unauthorized" }) };
  if (!watchId) return { statusCode: 400, body: JSON.stringify({ error: "watchId is required" }) };

  const existing = await getSubscription(userId, watchId);
  if (!existing) return { statusCode: 204, body: "" };

  await deleteSubscription(userId, watchId);
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE_WATCHES,
      Key: { watchId },
      UpdateExpression: "ADD subscriberCount :minusOne",
      ExpressionAttributeValues: { ":minusOne": -1 },
    })
  );

  return { statusCode: 204, body: "" };
}
