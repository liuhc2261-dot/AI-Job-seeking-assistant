import type { z } from "zod";

import { parseStructuredOutput } from "@/ai/parsers/structured-output";
import { env } from "@/lib/env";

type GenerateStructuredDataInput<T> = {
  taskType: string;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  temperature?: number;
  fallback?: () => Promise<T> | T;
};

type AiGenerationMeta = {
  provider: "openai" | "fallback";
  model: string;
  usedFallback: boolean;
};

export type AiGenerationResult<T> = {
  data: T;
  meta: AiGenerationMeta;
};

class AiService {
  async generateStructuredData<T>({
    taskType,
    systemPrompt,
    userPrompt,
    schema,
    temperature = 0.2,
    fallback,
  }: GenerateStructuredDataInput<T>): Promise<AiGenerationResult<T>> {
    if (!env.openAiApiKey) {
      return this.resolveFallback(fallback);
    }

    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const rawOutput = await this.requestOpenAi({
          systemPrompt,
          userPrompt,
          temperature,
        });

        return {
          data: parseStructuredOutput(rawOutput, schema),
          meta: {
            provider: "openai",
            model: env.openAiModel,
            usedFallback: false,
          },
        };
      } catch (error) {
        lastError = error;
      }
    }

    console.error(`[ai-service] ${taskType} failed`, {
      model: env.openAiModel,
      message: lastError instanceof Error ? lastError.message : "unknown_error",
    });

    return this.resolveFallback(fallback);
  }

  private async requestOpenAi(input: {
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
  }) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.openAiModel,
        temperature: input.temperature,
        response_format: {
          type: "json_object",
        },
        messages: [
          {
            role: "system",
            content: input.systemPrompt,
          },
          {
            role: "user",
            content: input.userPrompt,
          },
        ],
      }),
      signal: AbortSignal.timeout(35_000),
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(errorText || "OPENAI_REQUEST_FAILED");
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("OPENAI_EMPTY_OUTPUT");
    }

    return content;
  }

  private async resolveFallback<T>(fallback?: () => Promise<T> | T) {
    if (!fallback) {
      throw new Error("AI_FALLBACK_UNAVAILABLE");
    }

    return {
      data: await fallback(),
      meta: {
        provider: "fallback" as const,
        model: "local-template",
        usedFallback: true,
      },
    };
  }
}

export const aiService = new AiService();
