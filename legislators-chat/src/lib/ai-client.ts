/**
 * AI Client Abstraction Layer
 *
 * Provides a unified interface for AI providers (Maple AI and OpenAI).
 * The provider is selected via the AI_PROVIDER environment variable.
 */

export type AIProvider = "maple" | "openai";

/**
 * Reasoning effort levels for OpenAI models that support reasoning
 */
export type ReasoningEffort = "low" | "medium" | "high";

export interface AIConfig {
  provider: AIProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  reasoningEffort: ReasoningEffort;
}

/**
 * Default models for each provider
 */
const DEFAULT_MODELS: Record<AIProvider, string> = {
  maple: "llama-3.3-70b",
  openai: "gpt-5.2",
};

/**
 * Models that support the reasoning parameter
 */
const REASONING_CAPABLE_MODELS = ["o1", "o1-mini", "o1-pro", "o3", "o3-mini", "gpt-5", "gpt-5.2"];

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
  const reasoningEffort = (process.env.OPENAI_REASONING_EFFORT as ReasoningEffort) || "medium";

  if (provider === "openai") {
    return {
      provider: "openai",
      baseUrl: process.env.OPENAI_BASE_URL || BASE_URLS.openai,
      apiKey: process.env.OPENAI_API_KEY || "",
      model: process.env.OPENAI_MODEL || DEFAULT_MODELS.openai,
      reasoningEffort,
    };
  }

  // Default to Maple
  return {
    provider: "maple",
    baseUrl: process.env.MAPLE_PROXY_URL || BASE_URLS.maple,
    apiKey: process.env.MAPLE_API_KEY || "",
    model: process.env.MAPLE_MODEL || DEFAULT_MODELS.maple,
    reasoningEffort, // Not used for Maple but included for consistency
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
 * Check if a model supports the reasoning parameter
 */
export function supportsReasoning(model: string): boolean {
  return REASONING_CAPABLE_MODELS.some(
    (m) => model.toLowerCase().startsWith(m.toLowerCase())
  );
}

/**
 * Build request body with provider-specific parameters.
 *
 * OpenAI's newer models (gpt-4o, o1, etc.) use `max_completion_tokens`
 * instead of `max_tokens`. This function handles that difference.
 *
 * For reasoning-capable models (o1, o3, gpt-5.2), we add the reasoning
 * parameter while still using the standard messages format for chat/completions.
 */
export function buildRequestBody(params: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: ReasoningEffort;
}): Record<string, unknown> {
  const config = getAIConfig();
  const useReasoning = config.provider === "openai" && supportsReasoning(params.model);
  const reasoningEffort = params.reasoningEffort || config.reasoningEffort;

  // Standard Chat Completions API format - works for all models
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
  };

  // Add reasoning parameter for capable models (optional parameter)
  if (useReasoning) {
    body.reasoning_effort = reasoningEffort;
  }

  if (params.stream !== undefined) {
    body.stream = params.stream;
  }

  // Only set temperature for non-reasoning models (o1/o3 don't support it)
  if (params.temperature !== undefined && !useReasoning) {
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
