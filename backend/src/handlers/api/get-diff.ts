import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { diffArtifactKey, getDiffArtifact } from "../../lib/diff/diff-storage";

/**
 * Backs the diff viewer (§8.3). The key is deterministic from watchId +
 * detectedAt, so this reads straight from S3 with no DynamoDB lookup.
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const watchId = event.pathParameters?.watchId;
  const detectedAt = event.pathParameters?.detectedAt;
  if (!watchId || !detectedAt) {
    return { statusCode: 400, body: JSON.stringify({ error: "watchId and detectedAt are required" }) };
  }

  try {
    const blocks = await getDiffArtifact(diffArtifactKey(watchId, decodeURIComponent(detectedAt)));
    return { statusCode: 200, body: JSON.stringify({ blocks }) };
  } catch {
    return { statusCode: 404, body: JSON.stringify({ error: "diff not found" }) };
  }
}
