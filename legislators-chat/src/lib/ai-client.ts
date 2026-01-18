/**
 * AI Client Abstraction Layer
 *
 * Provides a unified interface for AI providers (Maple AI and OpenAI).
 * The provider is selected via the AI_PROVIDER environment variable.
 */

export type AIProvider = "maple" | "openai";

export interface AIConfig {
  provider: AIProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

/**
 * Default models for each provider
 */
const DEFAULT_MODELS: Record<AIProvider, string> = {
  maple: "llama-3.3-70b",
  openai: "gpt-4o",
};

/**
 * Base URLs for each provider
 */
const BASE_URLS: Record<AIProvider, string> = {
  maple: "https://enclave.trymaple.ai/v1",
  openai: "https://api.openai.com/v1",
};

/**
 * Get the current AI provider configuration.
 *
 * Environment variables:
 * - AI_PROVIDER: "maple" (default) or "openai"
 *
 * For Maple:
 * - MAPLE_API_KEY: API key
 * - MAPLE_PROXY_URL: Optional custom URL (defaults to Maple cloud)
 * - MAPLE_MODEL: Optional model override
 *
 * For OpenAI:
 * - OPENAI_API_KEY: API key
 * - OPENAI_BASE_URL: Optional custom URL (for Azure, proxies, etc.)
 * - OPENAI_MODEL: Optional model override
 */
export function getAIConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER as AIProvider) || "maple";

  if (provider === "openai") {
    return {
      provider: "openai",
      baseUrl: process.env.OPENAI_BASE_URL || BASE_URLS.openai,
      apiKey: process.env.OPENAI_API_KEY || "",
      model: process.env.OPENAI_MODEL || DEFAULT_MODELS.openai,
    };
  }

  // Default to Maple
  return {
    provider: "maple",
    baseUrl: process.env.MAPLE_PROXY_URL || BASE_URLS.maple,
    apiKey: process.env.MAPLE_API_KEY || "",
    model: process.env.MAPLE_MODEL || DEFAULT_MODELS.maple,
  };
}

/**
 * Get the chat completions URL for the current provider
 */
export function getChatCompletionsUrl(): string {
  const config = getAIConfig();
  return `${config.baseUrl}/chat/completions`;
}

/**
 * Get the authorization header for the current provider
 */
export function getAuthHeaders(): Record<string, string> {
  const config = getAIConfig();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };
}

/**
 * Check if the AI provider is properly configured
 */
export function isAIConfigured(): boolean {
  const config = getAIConfig();
  return !!config.apiKey;
}

/**
 * Get a human-readable provider name for error messages
 */
export function getProviderName(): string {
  const config = getAIConfig();
  return config.provider === "openai" ? "OpenAI" : "Maple AI";
}

/**
 * Build request body with provider-specific parameters.
 *
 * OpenAI's newer models (gpt-4o, o1, etc.) use `max_completion_tokens`
 * instead of `max_tokens`. This function handles that difference.
 */
export function buildRequestBody(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Record<string, unknown> {
  const config = getAIConfig();
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
  };

  if (params.stream !== undefined) {
    body.stream = params.stream;
  }

  if (params.temperature !== undefined) {
    body.temperature = params.temperature;
  }

  if (params.maxTokens !== undefined) {
    // OpenAI's newer models use max_completion_tokens instead of max_tokens
    if (config.provider === "openai") {
      body.max_completion_tokens = params.maxTokens;
    } else {
      body.max_tokens = params.maxTokens;
    }
  }

  return body;
}
