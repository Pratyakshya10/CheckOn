import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({});

// Haiku, not Sonnet/Opus: both call sites (condition parsing, change summarisation)
// are short, structured-output tasks, not open-ended reasoning. Haiku is
// materially cheaper and faster, and both calls are on the critical path of
// "how quickly does a subscriber get told" — latency here is a UX cost, not
// just a bill line. Override via env if a specific page's condition needs more.
const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-haiku-4-5-20251001-v1:0";

const MAX_RETRIES = 3;

/** JSON-in, JSON-out. Retries with backoff on throttling per §5 resilience notes. */
export async function invokeForJson<T>(systemPrompt: string, userMessage: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await client.send(
        new ConverseCommand({
          modelId: MODEL_ID,
          system: [{ text: systemPrompt }],
          messages: [{ role: "user", content: [{ text: userMessage }] }],
          inferenceConfig: { maxTokens: 1024, temperature: 0 },
        })
      );

      const text = res.output?.message?.content?.[0]?.text ?? "{}";
      return JSON.parse(extractJson(text)) as T;
    } catch (err) {
      lastError = err;
      const isThrottling = (err as { name?: string })?.name === "ThrottlingException";
      if (!isThrottling || attempt === MAX_RETRIES - 1) throw err;
      await sleep(2 ** attempt * 250);
    }
  }

  throw lastError;
}

function extractJson(text: string): string {
  // Models sometimes wrap JSON in prose or a code fence despite instructions — grab the object.
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
