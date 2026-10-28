export interface ModelRate {
  inputPerMillion: number;
  outputPerMillion: number;
}

export const AI_MODEL_RATES: Record<string, ModelRate> = {
  // Gemini
  "gemini-flash-latest": { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  "gemini-1.5-flash": { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  "gemini-1.5-pro": { inputPerMillion: 1.25, outputPerMillion: 5.0 },
  "gemini-2.0-flash": { inputPerMillion: 0.1, outputPerMillion: 0.4 },

  // OpenAI
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10.0 },

  // Anthropic Claude
  "claude-3-5-sonnet-latest": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  "claude-3-5-sonnet-20241022": { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  "claude-3-5-haiku-latest": { inputPerMillion: 0.8, outputPerMillion: 4.0 },
  "claude-haiku-4-5-20251001": { inputPerMillion: 0.8, outputPerMillion: 4.0 },

  // Grok (xAI)
  "grok-2-latest": { inputPerMillion: 2.0, outputPerMillion: 10.0 },
  "grok-beta": { inputPerMillion: 5.0, outputPerMillion: 15.0 },
};

export function calculateAiCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const normalizedModel = (model || "").toLowerCase().trim();
  const matchedKey = Object.keys(AI_MODEL_RATES).find((k) =>
    normalizedModel.includes(k.toLowerCase()),
  );
  const rate = matchedKey
    ? AI_MODEL_RATES[matchedKey]
    : { inputPerMillion: 0.15, outputPerMillion: 0.6 }; // default sensible rate

  const inputCost = (promptTokens / 1_000_000) * rate.inputPerMillion;
  const outputCost = (completionTokens / 1_000_000) * rate.outputPerMillion;

  return Number((inputCost + outputCost).toFixed(6));
}
