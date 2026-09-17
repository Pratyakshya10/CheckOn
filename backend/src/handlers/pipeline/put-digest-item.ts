import { putDigestItem } from "../../lib/db/digest-queue";

interface Input {
  userId: string;
  watchId: string;
  watchTitle: string;
  detectedAt: string;
  summary: string;
  digestHour: number;
}

export async function handler(input: Input) {
  await putDigestItem({
    userId: input.userId,
    sortKey: `${input.detectedAt}#${input.watchId}`,
    watchId: input.watchId,
    watchTitle: input.watchTitle,
    changeId: `${input.watchId}#${input.detectedAt}`,
    oneLineSummary: input.summary,
    digestHour: input.digestHour,
  });
}
