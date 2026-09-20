import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type Message,
} from "@aws-sdk/client-bedrock-runtime";
import type { DocumentType } from "@smithy/types";
import { SAFETY_SYSTEM_PREFIX } from "./untrusted";
import { SchemaError } from "./schemas";

const client = new BedrockRuntimeClient({});

const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-haiku-4-5-20251001-v1:0";
const MAX_RETRIES = 3;
const TOOL_NAME = "submit_result";

export class GuardrailBlockedError extends Error {
  constructor() {
    super("Request blocked by Bedrock Guardrails");
    this.name = "GuardrailBlockedError";
  }
}

export async function invokeForJson<T>(
  systemPrompt: string,
  userMessage: string,
  parse: (value: unknown) => T,
  toolSchema: DocumentType,
  maxTurns = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await runToolLoop(systemPrompt, userMessage, parse, toolSchema, maxTurns);
    } catch (err) {
      lastError = err;
      if (err instanceof GuardrailBlockedError || err instanceof SchemaError) throw err;
      const isThrottling = (err as { name?: string })?.name === "ThrottlingException";
      if (!isThrottling || attempt === MAX_RETRIES - 1) throw err;
      await sleep(2 ** attempt * 250);
    }
  }

  throw lastError;
}

async function runToolLoop<T>(
  systemPrompt: string,
  userMessage: string,
  parse: (value: unknown) => T,
  toolSchema: DocumentType,
  maxTurns: number,
): Promise<T> {
  const messages: Message[] = [{ role: "user", content: [{ text: userMessage }] }];
  let lastSchemaError: SchemaError | undefined;

  for (let turn = 0; turn < maxTurns; turn++) {
    const res = await client.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        system: [{ text: `${SAFETY_SYSTEM_PREFIX}\n\n${systemPrompt}` }],
        messages,
        inferenceConfig: { maxTokens: 1024, temperature: 0 },
        toolConfig: {
          tools: [
            {
              toolSpec: {
                name: TOOL_NAME,
                description: "Submit the structured JSON result for this CheckOn task.",
                inputSchema: { json: toolSchema },
              },
            },
          ],
          toolChoice: { tool: { name: TOOL_NAME } },
        },
        ...guardrailConfig(),
      }),
    );

    if (res.stopReason === "guardrail_intervened") {
      throw new GuardrailBlockedError();
    }

    const assistant = res.output?.message;
    if (!assistant?.content) {
      throw new SchemaError("model returned an empty message");
    }
    messages.push(assistant);

    const toolUse = findToolUse(assistant.content);
    if (!toolUse) {
      messages.push({
        role: "user",
        content: [{ text: `Call the ${TOOL_NAME} tool with valid JSON. Do not reply in prose.` }],
      });
      continue;
    }

    try {
      return parse(toolUse.input);
    } catch (err) {
      lastSchemaError = err instanceof SchemaError ? err : new SchemaError("invalid tool payload");
      messages.push({
        role: "user",
        content: [
          {
            toolResult: {
              toolUseId: toolUse.toolUseId,
              status: "error",
              content: [{ text: `Schema error: ${lastSchemaError.message}. Call ${TOOL_NAME} again with valid input.` }],
            },
          },
        ],
      });
    }
  }

  throw lastSchemaError ?? new SchemaError("model did not submit a valid result");
}

function findToolUse(content: ContentBlock[]): { toolUseId: string; input: unknown } | undefined {
  for (const block of content) {
    if (block.toolUse?.name === TOOL_NAME && block.toolUse.toolUseId) {
      return { toolUseId: block.toolUse.toolUseId, input: block.toolUse.input };
    }
  }
  return undefined;
}

function guardrailConfig() {
  const id = process.env.BEDROCK_GUARDRAIL_ID?.trim();
  const version = process.env.BEDROCK_GUARDRAIL_VERSION?.trim();
  if (!id || !version) return {};
  return {
    guardrailConfig: {
      guardrailIdentifier: id,
      guardrailVersion: version,
      trace: "enabled" as const,
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
