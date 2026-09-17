import { USER_AGENT } from "./robots";

export interface FetchResult {
  html: string;
  statusCode: number;
}

/**
 * Plain HTTP fetch 
 */
export async function fetchStatic(url: string, timeoutMs = 10_000): Promise<FetchResult> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });

  return { html: await res.text(), statusCode: res.status };
}
