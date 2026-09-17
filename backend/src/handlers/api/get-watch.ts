import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { getWatch } from "../../lib/db/watches";
import { listChangesForWatch } from "../../lib/db/changes";
import type { PublicWatchResponse } from "../../types/api";

/**
 * Backs the dashboard's live watch view and the diff viewer
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const watchId = event.pathParameters?.watchId;
  if (!watchId) return { statusCode: 400, body: JSON.stringify({ error: "watchId is required" }) };

  const watch = await getWatch(watchId);
  if (!watch) return { statusCode: 404, body: JSON.stringify({ error: "watch not found" }) };

  const changes = await listChangesForWatch(watchId, 50);

  const response: PublicWatchResponse = {
    watchId: watch.watchId,
    title: watch.title,
    url: watch.url,
    slug: watch.slug,
    subscriberCount: watch.subscriberCount,
    status: watch.status,
    timeline: changes.map((c) => ({
      detectedAt: c.detectedAt,
      summary: c.summary,
      isCosmetic: c.isCosmetic,
      changeFacts: c.changeFacts,
    })),
  };

  return { statusCode: 200, body: JSON.stringify(response) };
}
