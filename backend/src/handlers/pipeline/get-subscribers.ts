import { listSubscribersForWatch } from "../../lib/db/subscriptions";

interface Input {
  watchId: string;
  [key: string]: unknown;
}

export async function handler(input: Input) {
  const subscribers = await listSubscribersForWatch(input.watchId);
  return { ...input, subscribers };
}
