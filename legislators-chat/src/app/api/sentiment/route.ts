import { NextRequest, NextResponse } from "next/server";
import {
  buildSentimentAnalysisPrompt,
  parseSentimentResponse,
  aggregateSpeakerStatements,
} from "@/lib/sentiment";
import type { SearchResultData, SpeakerSentimentMap } from "@/lib/types";
import {
  getAIConfig,
  getChatCompletionsUrl,
  getAuthHeaders,
  isAIConfigured,
  getProviderName,
} from "@/lib/ai-client";

/**
 * Sentiment Analysis API Route
 *
 * Analyzes speaker sentiment from search results using AI.
 * Implements exponential backoff retries for parsing failures.
 */

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 500;

interface SentimentAnalysisRequest {
  topic: string;
  speakerIds: string[];
  searchResults: SearchResultData[];
}

interface SentimentAnalysisResponse {
  sentiments: SpeakerSentimentMap;
}

interface SentimentAnalysisError {
  error: {
    code: string;
    message: string;
  };
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call AI provider with the sentiment analysis prompt
 */
async function callAIForSentiment(prompt: string): Promise<string> {
  const aiConfig = getAIConfig();

  const response = await fetch(getChatCompletionsUrl(), {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      model: aiConfig.model,
      messages: [
        {
          role: "system",
          content:
            "You are a sentiment analysis assistant. You analyze congressional statements and return sentiment scores as JSON. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      stream: false,
      temperature: 0.3, // Lower temperature for more consistent JSON output
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${getProviderName()} API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<SentimentAnalysisResponse | SentimentAnalysisError>> {
  try {
    const body = (await request.json()) as SentimentAnalysisRequest;

    // Validate request
    if (!body.topic || typeof body.topic !== "string") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Topic is required" } },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.speakerIds) || body.speakerIds.length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Speaker IDs are required" } },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.searchResults) || body.searchResults.length === 0) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Search results are required" } },
        { status: 400 }
      );
    }

    if (!isAIConfigured()) {
      return NextResponse.json(
        { error: { code: "CONFIG_ERROR", message: `${getProviderName()} API key not configured` } },
        { status: 500 }
      );
    }

    // Aggregate speaker statements from search results
    const speakerStatements = aggregateSpeakerStatements(body.searchResults, body.speakerIds);

    if (speakerStatements.length === 0) {
      // No statements found for the requested speakers
      return NextResponse.json({ sentiments: {} });
    }

    // Build the sentiment analysis prompt
    const prompt = buildSentimentAnalysisPrompt(body.topic, speakerStatements);

    // Attempt to get and parse sentiment with exponential backoff retries
    let lastError: Error | null = null;
    let backoffMs = INITIAL_BACKOFF_MS;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await callAIForSentiment(prompt);
        const sentiments = parseSentimentResponse(response);

        if (sentiments) {
          return NextResponse.json({ sentiments });
        }

        // Parsing failed, will retry
        lastError = new Error("Failed to parse sentiment response");
        console.warn(
          `Sentiment parse attempt ${attempt + 1}/${MAX_RETRIES} failed. Response:`,
          response.slice(0, 200)
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        console.error(`Sentiment API attempt ${attempt + 1}/${MAX_RETRIES} failed:`, error);
      }

      // Don't sleep after the last attempt
      if (attempt < MAX_RETRIES - 1) {
        await sleep(backoffMs);
        backoffMs *= 2; // Exponential backoff
      }
    }

    // All retries exhausted
    console.error("All sentiment analysis retries exhausted:", lastError);
    return NextResponse.json(
      {
        error: {
          code: "SENTIMENT_ANALYSIS_FAILED",
          message: "Failed to analyze sentiment after multiple attempts",
        },
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("Sentiment API error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "An error occurred",
        },
      },
      { status: 500 }
    );
  }
}
