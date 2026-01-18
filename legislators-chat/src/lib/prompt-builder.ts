/**
 * Prompt Builder for AI Content Generation
 *
 * Creates structured prompts for generating personalized call scripts
 * and email drafts for contacting legislators.
 */

import type {
  Legislator,
  AdvocacyContext,
  TonePreference,
  VoteSummary,
  Statement,
} from "./types";

// =============================================================================
// Tone Descriptions
// =============================================================================

const TONE_DESCRIPTIONS: Record<TonePreference, string> = {
  formal:
    "Use professional, respectful language appropriate for official correspondence. Be direct and factual.",
  passionate:
    "Express strong conviction and urgency while remaining respectful. Show you care deeply about this issue.",
  personal:
    "Include personal experiences and stories that connect you to the issue. Be relatable and human.",
  concise:
    "Be brief and to the point. Respect the recipient's time with a clear, focused message.",
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format legislator's title based on chamber
 */
function getLegislatorTitle(legislator: Legislator): string {
  return legislator.chamber === "Senate" ? "Senator" : "Representative";
}

/**
 * Format legislator's full title and name
 */
function getLegislatorFullTitle(legislator: Legislator): string {
  const title = getLegislatorTitle(legislator);
  return `${title} ${legislator.name}`;
}

/**
 * Format party name
 */
function getPartyName(party: "D" | "R" | "I"): string {
  switch (party) {
    case "D":
      return "Democrat";
    case "R":
      return "Republican";
    case "I":
      return "Independent";
  }
}

/**
 * Format relevant votes for prompt context
 */
function formatVotes(votes?: VoteSummary[]): string {
  if (!votes || votes.length === 0) return "No specific voting records available.";

  return votes
    .slice(0, 3)
    .map((v) => `- ${v.billTitle}: Voted ${v.vote.toUpperCase()} on ${v.date}`)
    .join("\n");
}

/**
 * Format relevant statements for prompt context
 */
function formatStatements(statements?: Statement[]): string {
  if (!statements || statements.length === 0) return "No recent public statements available.";

  return statements
    .slice(0, 2)
    .map((s) => `- "${s.text.slice(0, 150)}${s.text.length > 150 ? "..." : ""}" (${s.date}, ${s.source})`)
    .join("\n");
}

/**
 * Format stance information
 */
function formatStance(stance: Legislator["stance"], summary: string): string {
  const stanceLabels = {
    for: "generally supportive of",
    against: "generally opposed to",
    mixed: "has mixed positions on",
    unknown: "has no clear public position on",
  };

  return `${stanceLabels[stance]} the issue. ${summary}`;
}

// =============================================================================
// System Prompts
// =============================================================================

const CALL_SCRIPT_SYSTEM_PROMPT = `You are an expert at crafting effective, persuasive call scripts for constituents to use when contacting their elected representatives. Your scripts are:

1. CONCISE - Designed to be delivered in under 2 minutes
2. STRUCTURED - Clear introduction, key points, and closing
3. CONVERSATIONAL - Natural speech patterns, not robotic
4. ACTIONABLE - Include specific asks
5. RESPECTFUL - Professional tone appropriate for government offices

You respond ONLY with valid JSON in the exact format specified. Do not include any explanation or markdown.`;

const EMAIL_DRAFT_SYSTEM_PROMPT = `You are an expert at crafting effective, persuasive emails from constituents to their elected representatives. Your emails are:

1. PROFESSIONAL - Appropriate for official correspondence
2. CLEAR - Well-organized with a specific ask
3. EVIDENCE-BASED - Reference specific legislation, votes, or facts when available
4. PERSONAL - Include constituent's connection to the issue
5. ACTIONABLE - Clear call-to-action

You respond ONLY with valid JSON in the exact format specified. Do not include any explanation or markdown.`;

// =============================================================================
// Prompt Builders
// =============================================================================

export interface CallScriptPromptParams {
  legislator: Legislator;
  advocacyContext: AdvocacyContext;
  tone: TonePreference;
  includeReferences?: boolean;
}

export interface EmailDraftPromptParams {
  legislator: Legislator;
  advocacyContext: AdvocacyContext;
  tone: TonePreference;
  includeReferences?: boolean;
}

/**
 * Build the system prompt for call script generation
 */
export function buildCallScriptSystemPrompt(): string {
  return CALL_SCRIPT_SYSTEM_PROMPT;
}

/**
 * Build the user prompt for call script generation
 */
export function buildCallScriptUserPrompt(params: CallScriptPromptParams): string {
  const { legislator, advocacyContext, tone, includeReferences = true } = params;

  const title = getLegislatorFullTitle(legislator);
  const partyName = getPartyName(legislator.party);
  const stanceInfo = formatStance(legislator.stance, legislator.stanceSummary);

  let prompt = `Generate a phone call script for a constituent to call ${title}'s office about: "${advocacyContext.topic}"

## LEGISLATOR CONTEXT
- Name: ${title}
- Party: ${partyName}
- State: ${legislator.state}${legislator.district ? `, District ${legislator.district}` : ""}
- Chamber: ${legislator.chamber}
- Position: ${stanceInfo}`;

  if (includeReferences) {
    prompt += `

## RELEVANT VOTING RECORD
${formatVotes(legislator.relevantVotes)}

## PUBLIC STATEMENTS
${formatStatements(legislator.relevantStatements)}`;
  }

  prompt += `

## CONSTITUENT'S POSITION
- Topic: ${advocacyContext.topic}`;

  if (advocacyContext.position) {
    prompt += `\n- Position: ${advocacyContext.position}`;
  }

  if (advocacyContext.specificAsk) {
    prompt += `\n- Specific Ask: ${advocacyContext.specificAsk}`;
  }

  if (advocacyContext.personalStory) {
    prompt += `\n- Personal Connection: ${advocacyContext.personalStory}`;
  }

  if (advocacyContext.keyFindings && advocacyContext.keyFindings.length > 0) {
    prompt += `\n- Key Research Findings:\n${advocacyContext.keyFindings.map((f) => `  * ${f}`).join("\n")}`;
  }

  prompt += `

## TONE
${TONE_DESCRIPTIONS[tone]}

## OUTPUT FORMAT
Respond with ONLY this JSON structure (no markdown, no explanation):
{
  "introduction": "Opening statement introducing yourself as a constituent (1-2 sentences)",
  "talkingPoints": ["Point 1", "Point 2", "Point 3"],
  "anticipatedResponses": [
    {"question": "Likely staff question or pushback", "response": "How to respond"}
  ],
  "closing": "Closing statement with clear ask and thank you",
  "estimatedDuration": 90
}

Keep the total script under 2 minutes when spoken (~300 words max). Include 3-4 talking points. Include 1-2 anticipated responses.`;

  return prompt;
}

/**
 * Build the system prompt for email draft generation
 */
export function buildEmailDraftSystemPrompt(): string {
  return EMAIL_DRAFT_SYSTEM_PROMPT;
}

/**
 * Build the user prompt for email draft generation
 */
export function buildEmailDraftUserPrompt(params: EmailDraftPromptParams): string {
  const { legislator, advocacyContext, tone, includeReferences = true } = params;

  const title = getLegislatorFullTitle(legislator);
  const partyName = getPartyName(legislator.party);
  const stanceInfo = formatStance(legislator.stance, legislator.stanceSummary);

  let prompt = `Generate an email draft for a constituent to send to ${title} about: "${advocacyContext.topic}"

## LEGISLATOR CONTEXT
- Name: ${title}
- Party: ${partyName}
- State: ${legislator.state}${legislator.district ? `, District ${legislator.district}` : ""}
- Chamber: ${legislator.chamber}
- Position: ${stanceInfo}`;

  if (includeReferences) {
    prompt += `

## RELEVANT VOTING RECORD
${formatVotes(legislator.relevantVotes)}

## PUBLIC STATEMENTS
${formatStatements(legislator.relevantStatements)}`;
  }

  prompt += `

## CONSTITUENT'S POSITION
- Topic: ${advocacyContext.topic}`;

  if (advocacyContext.position) {
    prompt += `\n- Position: ${advocacyContext.position}`;
  }

  if (advocacyContext.specificAsk) {
    prompt += `\n- Specific Ask: ${advocacyContext.specificAsk}`;
  }

  if (advocacyContext.personalStory) {
    prompt += `\n- Personal Connection: ${advocacyContext.personalStory}`;
  }

  if (advocacyContext.keyFindings && advocacyContext.keyFindings.length > 0) {
    prompt += `\n- Key Research Findings:\n${advocacyContext.keyFindings.map((f) => `  * ${f}`).join("\n")}`;
  }

  prompt += `

## TONE
${TONE_DESCRIPTIONS[tone]}

## OUTPUT FORMAT
Respond with ONLY this JSON structure (no markdown, no explanation):
{
  "subjectLines": ["Option 1", "Option 2", "Option 3"],
  "salutation": "Dear [Title] [Name],",
  "opening": "Opening paragraph establishing yourself as a constituent and stating the purpose",
  "body": ["Main argument paragraph 1", "Supporting evidence paragraph 2", "Personal connection paragraph 3"],
  "citations": [
    {"text": "Referenced fact or vote", "source": "Source name", "url": "optional URL"}
  ],
  "closing": "Closing paragraph with clear ask",
  "signature": "Respectfully,\\n[Your Name]\\n[Your Address]"
}

Keep the email professional and under 400 words. Include 3 subject line options. Include 2-3 body paragraphs.`;

  return prompt;
}

// =============================================================================
// Response Parsers
// =============================================================================

import type { CallScript, EmailDraft } from "./types";

/**
 * Parse a call script from AI response
 */
export function parseCallScriptResponse(response: string): CallScript | null {
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (
      !parsed.introduction ||
      !Array.isArray(parsed.talkingPoints) ||
      !parsed.closing
    ) {
      console.error("Call script missing required fields");
      return null;
    }

    return {
      introduction: parsed.introduction,
      talkingPoints: parsed.talkingPoints,
      anticipatedResponses: parsed.anticipatedResponses || [],
      closing: parsed.closing,
      estimatedDuration: parsed.estimatedDuration || 90,
    };
  } catch (error) {
    console.error("Failed to parse call script response:", error);
    return null;
  }
}

/**
 * Parse an email draft from AI response
 */
export function parseEmailDraftResponse(response: string): EmailDraft | null {
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);

    // Validate required fields
    if (
      !Array.isArray(parsed.subjectLines) ||
      !parsed.salutation ||
      !parsed.opening ||
      !Array.isArray(parsed.body) ||
      !parsed.closing ||
      !parsed.signature
    ) {
      console.error("Email draft missing required fields");
      return null;
    }

    return {
      subjectLines: parsed.subjectLines,
      salutation: parsed.salutation,
      opening: parsed.opening,
      body: parsed.body,
      citations: parsed.citations || [],
      closing: parsed.closing,
      signature: parsed.signature,
    };
  } catch (error) {
    console.error("Failed to parse email draft response:", error);
    return null;
  }
}
