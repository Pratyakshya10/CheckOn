import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { getWatch, putWatch } from "../../lib/db/watches";
import { hashUrl, shardFor } from "../../lib/hash";
import { slugify } from "../../lib/slug";
import type { Watch } from "../../types/watch";
import type { CreateWatchRequest } from "../../types/api";

const DEFAULT_INTERVAL_MINUTES = 15; 


export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const body = JSON.parse(event.body ?? "{}") as CreateWatchRequest;

  if (!body.url || !isHttpUrl(body.url)) {
    return { statusCode: 400, body: JSON.stringify({ error: "url must be a valid http(s) URL" }) };
  }

  const normalizedUrl = normalizeUrl(body.url);
  const watchId = hashUrl(normalizedUrl);

  const existing = await getWatch(watchId);
  if (existing) {
    return { statusCode: 200, body: JSON.stringify(existing) };
  }

  const title = new URL(normalizedUrl).hostname;
  const slug = `${slugify(title)}-${watchId.slice(2, 8)}`;
  const checkIntervalMinutes = Math.max(body.checkIntervalMinutes ?? DEFAULT_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES);

  const watch: Watch = {
    watchId,
    url: body.url,
    normalizedUrl,
    title,
    slug,
    isPublic: true,
    subscriberCount: 0,
    checkIntervalMinutes,
    nextCheckAt: new Date().toISOString(),
    lastCheckedAt: null,
    lastContentHash: null,
    lastSnapshotKey: null,
    fetchMode: "static",
    robotsAllowed: true,
    status: "active",
    consecutiveFailures: 0,
    shardId: shardFor(watchId),
  };

  await putWatch(watch);
  return { statusCode: 201, body: JSON.stringify(watch) };
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return `${parsed.hostname}${parsed.pathname}${parsed.search}`.replace(/\/$/, "");
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
