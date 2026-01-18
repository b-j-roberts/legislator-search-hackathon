import { NextRequest, NextResponse } from "next/server";

/**
 * Orchestrated Chat API Route
 *
 * Non-streaming endpoint for the search orchestration flow.
 * Used by useSearchOrchestration hook for multi-step conversations.
 */

const MAPLE_PROXY_URL = process.env.MAPLE_PROXY_URL || "http://localhost:8080/v1";
const MAPLE_API_KEY = process.env.MAPLE_API_KEY || "";
const MAPLE_MODEL = process.env.MAPLE_MODEL || "llama-3.3-70b";

/** Default system prompt (used when search prompt is not provided) */
const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant for researching US legislators, congressional hearings, voting records, and legislative documents. Your goal is to help citizens identify and contact legislators on issues they care about.

When responding:
- Provide accurate, factual information about legislators and their positions
- Include relevant voting records and public statements when available
- Offer contact information when asked
- Be nonpartisan and present multiple perspectives
- Cite sources when possible

If you don't have specific information, say so clearly rather than making assumptions.`;

interface OrchestratedChatRequest {
  message: string;
  context?: {
    previousMessages?: Array<{ role: string; content: string }>;
    systemPrompt?: string;
  };
}

interface OrchestratedChatResponse {
  content: string;
}

interface OrchestratedChatError {
  error: {
    code: string;
    message: string;
  };
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<OrchestratedChatResponse | OrchestratedChatError>> {
  try {
    const body = (await request.json()) as OrchestratedChatRequest;

    if (!body.message || typeof body.message !== "string") {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Message is required" } },
        { status: 400 }
      );
    }

    if (!MAPLE_API_KEY) {
      return NextResponse.json(
        { error: { code: "CONFIG_ERROR", message: "Maple API key not configured" } },
        { status: 500 }
      );
    }

    // Build messages array with conversation history if provided
    const systemPrompt = body.context?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    if (body.context?.previousMessages) {
      for (const msg of body.context.previousMessages) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: "user", content: body.message });

    // Call Maple Proxy (non-streaming for orchestration)
    const mapleResponse = await fetch(`${MAPLE_PROXY_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MAPLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: MAPLE_MODEL,
        messages,
        stream: false,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!mapleResponse.ok) {
      const errorText = await mapleResponse.text();
      console.error("Maple API error:", mapleResponse.status, errorText);
      return NextResponse.json(
        {
          error: {
            code: "MAPLE_ERROR",
            message: `Maple API error: ${mapleResponse.status}`,
          },
        },
        { status: mapleResponse.status }
      );
    }

    const data = await mapleResponse.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        {
          error: {
            code: "EMPTY_RESPONSE",
            message: "AI returned an empty response",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Orchestrated chat API error:", error);
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
