import { NextRequest, NextResponse } from "next/server";
import type {
  EditableCallScript,
  EditableEmailDraft,
  RefinementMessage,
  Legislator,
  AdvocacyContext,
} from "@/lib/types";
import {
  getAIConfig,
  getChatCompletionsUrl,
  getAuthHeaders,
  isAIConfigured,
  getProviderName,
  buildRequestBody,
} from "@/lib/ai-client";

interface RefineContentRequest {
  currentContent: EditableCallScript | EditableEmailDraft;
  contentType: "call" | "email";
  request: string;
  legislator: Legislator;
  advocacyContext: AdvocacyContext | null;
  chatHistory?: RefinementMessage[];
}

interface RefineContentResponse {
  success: boolean;
  content?: EditableCallScript | EditableEmailDraft;
  explanation?: string;
  changeSummary?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Build system prompt for content refinement
 */
function buildRefinementSystemPrompt(contentType: "call" | "email"): string {
  const contentName = contentType === "call" ? "call script" : "email draft";

  return `You are an expert editor helping users refine their ${contentName} for contacting elected representatives.

Your role is to:
1. Understand the user's refinement request
2. Apply the requested changes while preserving the overall structure
3. Maintain the professional quality and effectiveness of the content
4. Explain what changes you made

IMPORTANT: You must respond with ONLY valid JSON in the exact format specified. Do not include any markdown, explanation outside the JSON, or additional text.`;
}

/**
 * Build user prompt for call script refinement
 */
function buildCallScriptRefinementPrompt(
  content: EditableCallScript,
  request: string,
  legislator: Legislator,
  advocacyContext: AdvocacyContext | null,
  chatHistory?: RefinementMessage[]
): string {
  let prompt = `Refine the following call script based on the user's request.

## CURRENT CALL SCRIPT
Introduction:
${content.introduction}

Talking Points:
${content.talkingPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}

Anticipated Q&A:
${content.anticipatedResponses.map((ar) => `Q: ${ar.question}\nA: ${ar.response}`).join("\n\n")}

Closing:
${content.closing}

## CONTEXT
- Legislator: ${legislator.name} (${legislator.party}-${legislator.state})
- Topic: ${advocacyContext?.topic || "Not specified"}
${advocacyContext?.position ? `- User's Position: ${advocacyContext.position}` : ""}
${advocacyContext?.personalStory ? `- Personal Story: ${advocacyContext.personalStory}` : ""}
${advocacyContext?.specificAsk ? `- Specific Ask: ${advocacyContext.specificAsk}` : ""}`;

  if (chatHistory && chatHistory.length > 0) {
    prompt += `\n\n## PREVIOUS REFINEMENTS`;
    for (const msg of chatHistory.slice(-4)) {
      prompt += `\n${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`;
    }
  }

  prompt += `

## USER'S REFINEMENT REQUEST
${request}

## OUTPUT FORMAT
Respond with ONLY this JSON structure (no markdown, no explanation outside JSON):
{
  "content": {
    "introduction": "Refined introduction",
    "talkingPoints": ["Refined point 1", "Refined point 2", "..."],
    "anticipatedResponses": [
      {"question": "Question", "response": "Response"}
    ],
    "closing": "Refined closing"
  },
  "explanation": "Brief explanation of what you changed and why (1-2 sentences)",
  "changeSummary": "Very brief summary like 'Made shorter' or 'Added personal story'"
}

IMPORTANT: Keep the script effective and under 2 minutes when spoken. Preserve any elements the user didn't ask to change.`;

  return prompt;
}

/**
 * Build user prompt for email draft refinement
 */
function buildEmailDraftRefinementPrompt(
  content: EditableEmailDraft,
  request: string,
  legislator: Legislator,
  advocacyContext: AdvocacyContext | null,
  chatHistory?: RefinementMessage[]
): string {
  let prompt = `Refine the following email draft based on the user's request.

## CURRENT EMAIL DRAFT
Subject: ${content.subjectLine}

${content.salutation}

${content.opening}

${content.body.join("\n\n")}

${content.closing}

${content.signature}

## CONTEXT
- Legislator: ${legislator.name} (${legislator.party}-${legislator.state})
- Topic: ${advocacyContext?.topic || "Not specified"}
${advocacyContext?.position ? `- User's Position: ${advocacyContext.position}` : ""}
${advocacyContext?.personalStory ? `- Personal Story: ${advocacyContext.personalStory}` : ""}
${advocacyContext?.specificAsk ? `- Specific Ask: ${advocacyContext.specificAsk}` : ""}`;

  if (chatHistory && chatHistory.length > 0) {
    prompt += `\n\n## PREVIOUS REFINEMENTS`;
    for (const msg of chatHistory.slice(-4)) {
      prompt += `\n${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`;
    }
  }

  prompt += `

## USER'S REFINEMENT REQUEST
${request}

## OUTPUT FORMAT
Respond with ONLY this JSON structure (no markdown, no explanation outside JSON):
{
  "content": {
    "subjectLine": "Refined subject line",
    "salutation": "Dear ...,",
    "opening": "Refined opening paragraph",
    "body": ["Refined body paragraph 1", "Refined body paragraph 2", "..."],
    "closing": "Refined closing paragraph",
    "signature": "Refined signature"
  },
  "explanation": "Brief explanation of what you changed and why (1-2 sentences)",
  "changeSummary": "Very brief summary like 'Made more formal' or 'Added statistics'"
}

IMPORTANT: Keep the email professional and under 400 words. Preserve any elements the user didn't ask to change.`;

  return prompt;
}

/**
 * Parse the refinement response from AI
 */
function parseRefinementResponse(
  response: string,
  contentType: "call" | "email"
): { content: EditableCallScript | EditableEmailDraft; explanation: string; changeSummary: string } | null {
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    if (!parsed.content || !parsed.explanation) {
      console.error("Refinement response missing required fields");
      return null;
    }

    // Validate content structure based on type
    if (contentType === "call") {
      const content = parsed.content as EditableCallScript;
      if (
        !content.introduction ||
        !Array.isArray(content.talkingPoints) ||
        !content.closing
      ) {
        console.error("Call script refinement missing required fields");
        return null;
      }
      // Ensure anticipatedResponses is an array
      content.anticipatedResponses = content.anticipatedResponses || [];
    } else {
      const content = parsed.content as EditableEmailDraft;
      if (
        !content.subjectLine ||
        !content.salutation ||
        !content.opening ||
        !Array.isArray(content.body) ||
        !content.closing ||
        !content.signature
      ) {
        console.error("Email draft refinement missing required fields");
        return null;
      }
    }

    return {
      content: parsed.content,
      explanation: parsed.explanation,
      changeSummary: parsed.changeSummary || "Content refined",
    };
  } catch (error) {
    console.error("Failed to parse refinement response:", error);
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<RefineContentResponse>> {
  try {
    const body = (await request.json()) as RefineContentRequest;

    const { currentContent, contentType, request: refinementRequest, legislator, advocacyContext, chatHistory } = body;

    // Validate required fields
    if (!currentContent || !contentType || !refinementRequest || !legislator) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Missing required fields: currentContent, contentType, request, legislator",
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

    // Build prompts
    const systemPrompt = buildRefinementSystemPrompt(contentType);
    const userPrompt =
      contentType === "call"
        ? buildCallScriptRefinementPrompt(
            currentContent as EditableCallScript,
            refinementRequest,
            legislator,
            advocacyContext,
            chatHistory
          )
        : buildEmailDraftRefinementPrompt(
            currentContent as EditableEmailDraft,
            refinementRequest,
            legislator,
            advocacyContext,
            chatHistory
          );

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Call AI provider
    const aiResponse = await fetch(getChatCompletionsUrl(), {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(
        buildRequestBody({
          model: aiConfig.model,
          messages,
          stream: false,
          temperature: 0.7,
          maxTokens: 1500,
        })
      ),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`${getProviderName()} API error:`, aiResponse.status, errorText);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "AI_ERROR",
            message: `AI refinement failed: ${aiResponse.status}`,
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

    // Parse the response
    const result = parseRefinementResponse(responseContent, contentType);
    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PARSE_ERROR",
            message: "Failed to parse refinement from AI response",
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      content: result.content,
      explanation: result.explanation,
      changeSummary: result.changeSummary,
    });
  } catch (error) {
    console.error("Content refinement API error:", error);
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
