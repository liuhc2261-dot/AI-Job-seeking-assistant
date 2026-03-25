import type { z } from "zod";

import { parseStructuredOutput } from "@/ai/parsers/structured-output";
import { env } from "@/lib/env";
import { commercialAccessService } from "@/services/commercial-access-service";

type GenerateStructuredDataInput<T> = {
  userId?: string;
  taskType: string;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  temperature?: number;
  fallback?: () => Promise<T> | T;
  modelOverride?: string;
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
    userId,
    taskType,
    systemPrompt,
    userPrompt,
    schema,
    temperature = 0.2,
    fallback,
    modelOverride,
  }: GenerateStructuredDataInput<T>): Promise<AiGenerationResult<T>> {
    if (!env.openAiApiKey) {
      return this.resolveFallback(fallback);
    }

    const model =
      modelOverride?.trim() ||
      (userId ? await commercialAccessService.getAiModelForUser(userId) : env.openAiModel);
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const rawOutput = await this.requestOpenAi({
          model,
          systemPrompt,
          userPrompt,
          temperature,
        });

        return {
          data: parseStructuredOutput(rawOutput, schema),
          meta: {
            provider: "openai",
            model,
            usedFallback: false,
          },
        };
      } catch (error) {
        lastError = error;
      }
    }

    console.error(`[ai-service] ${taskType} failed`, {
      model,
      message: lastError instanceof Error ? lastError.message : "unknown_error",
    });

    return this.resolveFallback(fallback);
  }

  private async requestOpenAi(input: {
    model: string;
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
        model: input.model,
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
