import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { isAllowedByRobots } from "../../lib/fetcher/robots";
import { fetchStatic } from "../../lib/fetcher/static";
import { normalizeHtml } from "../../lib/fetcher/normalize";
import { trialCheck } from "../../lib/bedrock/trial-check";
import type { TrialCheckRequest, TrialCheckResponse } from "../../types/api";
import { parseCondition } from "../../lib/bedrock/parse-condition";

/**
 * Zero-signup trial
 */
export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const body = JSON.parse(event.body ?? "{}") as TrialCheckRequest;

  if (!body.url || !isHttpUrl(body.url)) {
    return { statusCode: 400, body: JSON.stringify({ error: "url must be a valid http(s) URL" }) };
  }

  const allowed = await isAllowedByRobots(body.url);
  if (!allowed) {
    return { statusCode: 422, body: JSON.stringify({ error: "This page's robots.txt disallows automated checks." }) };
  }

  const { html } = await fetchStatic(body.url);
  const normalized = normalizeHtml(html);

  const [conditionRule, outcome] = await Promise.all([
    parseCondition(body.conditionText),
    trialCheck(normalized, body.conditionText),
  ]);

  const response: TrialCheckResponse = {
    url: body.url,
    conditionText: body.conditionText,
    conditionRule,
    ...outcome,
  };

  return { statusCode: 200, body: JSON.stringify(response) };
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
