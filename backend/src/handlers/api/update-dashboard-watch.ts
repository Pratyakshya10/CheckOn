import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { getAuthUser } from "../../lib/auth/get-user";
import { parseCondition } from "../../lib/bedrock/parse-condition";
import { getSubscription, putSubscription } from "../../lib/db/subscriptions";
import { updateWatchSettings } from "../../lib/db/watches";

type UpdateDashboardWatchRequest = {
  title?: string;
  conditionText?: string;
  checkIntervalMinutes?: number;
};

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const user = getAuthUser(event);
  if (!user) return json(401, { error: "authentication required" });

  const watchId = event.pathParameters?.watchId;
  if (!watchId) return json(400, { error: "watchId is required" });

  let body: UpdateDashboardWatchRequest;
  try {
    body = JSON.parse(event.body ?? "{}") as UpdateDashboardWatchRequest;
  } catch {
    return json(400, { error: "body must be valid JSON" });
  }

  const subscription = await getSubscription(user.email, watchId);
  if (!subscription) return json(404, { error: "watch subscription not found" });

  const title = body.title?.trim();
  if (body.title !== undefined && !title) return json(400, { error: "title must not be empty" });
  if (
    body.checkIntervalMinutes !== undefined &&
    (!Number.isInteger(body.checkIntervalMinutes) || body.checkIntervalMinutes < 15)
  ) {
    return json(400, { error: "checkIntervalMinutes must be an integer of at least 15" });
  }
  if (body.conditionText !== undefined && typeof body.conditionText !== "string") {
    return json(400, { error: "conditionText must be a string" });
  }
  if (
    title === undefined &&
    body.conditionText === undefined &&
    body.checkIntervalMinutes === undefined
  ) {
    return json(400, { error: "at least one editable field is required" });
  }

  const conditionRule =
    body.conditionText !== undefined ? await parseCondition(body.conditionText) : undefined;

  const watch = await updateWatchSettings(watchId, {
    title,
    checkIntervalMinutes: body.checkIntervalMinutes,
  });
  if (!watch) return json(404, { error: "watch not found" });

  let updatedSubscription = subscription;
  if (body.conditionText !== undefined) {
    updatedSubscription = {
      ...subscription,
      conditionText: body.conditionText,
      conditionRule: conditionRule!,
    };
    await putSubscription(updatedSubscription);
  }

  return json(200, { watch, subscription: updatedSubscription });
}

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
