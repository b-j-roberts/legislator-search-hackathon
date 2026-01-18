import { NextRequest, NextResponse } from "next/server";
import type { ContentGenerationParams, CallScript, EmailDraft } from "@/lib/types";
import {
  buildCallScriptSystemPrompt,
  buildCallScriptUserPrompt,
  buildEmailDraftSystemPrompt,
  buildEmailDraftUserPrompt,
  parseCallScriptResponse,
  parseEmailDraftResponse,
} from "@/lib/prompt-builder";
import {
  getAIConfig,
  getChatCompletionsUrl,
  getAuthHeaders,
  isAIConfigured,
  getProviderName,
} from "@/lib/ai-client";

interface GenerateContentRequest {
  params: ContentGenerationParams;
}

interface GenerateContentResponse {
  success: boolean;
  callScript?: CallScript;
  emailDraft?: EmailDraft;
  error?: {
    code: string;
    message: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse<GenerateContentResponse>> {
  try {
    const body = (await request.json()) as GenerateContentRequest;

    if (!body.params) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Generation parameters are required" },
        },
        { status: 400 }
      );
    }

    const { legislator, advocacyContext, tone, contentType, includeReferences } = body.params;

    // Validate required fields
    if (!legislator || !advocacyContext?.topic || !tone || !contentType) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required fields: legislator, advocacyContext.topic, tone, contentType",
          },
        },
        { status: 400 }
      );
    }

    if (!isAIConfigured()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CONFIG_ERROR", message: `${getProviderName()} API key not configured` },
        },
        { status: 500 }
      );
    }

    const aiConfig = getAIConfig();

    // Build prompts based on content type
    let systemPrompt: string;
    let userPrompt: string;

    if (contentType === "call") {
      systemPrompt = buildCallScriptSystemPrompt();
      userPrompt = buildCallScriptUserPrompt({
        legislator,
        advocacyContext,
        tone,
        includeReferences,
      });
    } else {
      systemPrompt = buildEmailDraftSystemPrompt();
      userPrompt = buildEmailDraftUserPrompt({
        legislator,
        advocacyContext,
        tone,
        includeReferences,
      });
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Call AI provider (non-streaming for JSON response)
    const aiResponse = await fetch(getChatCompletionsUrl(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        model: aiConfig.model,
        messages,
        stream: false,
        temperature: 0.7, // Some creativity but not too random
        max_tokens: 1500,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`${getProviderName()} API error:`, aiResponse.status, errorText);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AI_ERROR",
            message: `AI generation failed: ${aiResponse.status}`,
          },
        },
        { status: aiResponse.status }
      );
    }

    const data = await aiResponse.json();
    const responseContent = data.choices?.[0]?.message?.content;

    if (!responseContent) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "EMPTY_RESPONSE", message: "AI returned an empty response" },
        },
        { status: 500 }
      );
    }

    // Parse the response based on content type
    if (contentType === "call") {
      const callScript = parseCallScriptResponse(responseContent);
      if (!callScript) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "PARSE_ERROR",
              message: "Failed to parse call script from AI response",
            },
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, callScript });
    } else {
      const emailDraft = parseEmailDraftResponse(responseContent);
      if (!emailDraft) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "PARSE_ERROR",
              message: "Failed to parse email draft from AI response",
            },
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ success: true, emailDraft });
    }
  } catch (error) {
    console.error("Content generation API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error instanceof Error ? error.message : "An error occurred",
        },
      },
      { status: 500 }
    );
  }
}
