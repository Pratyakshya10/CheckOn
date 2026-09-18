import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { listSubscriptionsForUser } from "../../lib/db/subscriptions";
import { getWatch } from "../../lib/db/watches";
import { listChangesForWatch } from "../../lib/db/changes";
import { getAuthUser } from "../../lib/auth/get-user";

/* Dashboard's core view  */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const user = getAuthUser(event);
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: "unauthorized" }) };
  const userId = user.email;

  const subscriptions = await listSubscriptionsForUser(userId);

  const rows = await Promise.all(
    subscriptions.map(async (sub) => {
      const [watch, recentChanges] = await Promise.all([
        getWatch(sub.watchId),
        listChangesForWatch(sub.watchId, 1),
      ]);
      return {
        subscription: sub,
        watch,
        latestChange: recentChanges[0] ?? null,
      };
    })
  );

  return { statusCode: 200, body: JSON.stringify(rows.filter((r) => r.watch)) };
}
