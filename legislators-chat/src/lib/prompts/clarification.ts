/**
 * Query Clarification Prompt for Maple AI
 *
 * Handles ambiguous queries by detecting when clarification is needed
 * and generating appropriate clarifying questions before searching.
 */

// =============================================================================
// Types
// =============================================================================

/** Types of ambiguity that can be detected */
export type AmbiguityType =
  | "vague_topic" // Too broad or general (e.g., "taxes", "healthcare")
  | "missing_referent" // References something undefined (e.g., "the bill", "that senator")
  | "scope_unclear" // Who/what is being asked about (e.g., "what do they think")
  | "time_ambiguous" // Unclear time frame (e.g., "recently", "lately")
  | "multiple_interpretations"; // Could mean several things

/** Result of ambiguity detection */
export interface AmbiguityDetection {
  /** Whether the query is ambiguous */
  isAmbiguous: boolean;
  /** Types of ambiguity detected */
  ambiguityTypes: AmbiguityType[];
  /** Confidence level (0-1) */
  confidence: number;
  /** Specific patterns matched */
  matchedPatterns: string[];
}

/** A clarification option to present to the user */
export interface ClarificationOption {
  /** Short label for the option */
  label: string;
  /** The refined query if this option is selected */
  refinedQuery: string;
}

/** A clarification question with options */
export interface ClarificationQuestion {
  /** The clarifying question to ask */
  question: string;
  /** Pre-defined options for the user to select */
  options: ClarificationOption[];
  /** The type of ambiguity this addresses */
  ambiguityType: AmbiguityType;
}

/** Result of clarification analysis */
export interface ClarificationResult {
  /** Whether clarification is needed */
  needsClarification: boolean;
  /** The detection analysis */
  detection: AmbiguityDetection;
  /** Suggested clarification question (if needed) */
  suggestedQuestion: ClarificationQuestion | null;
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Vague topic patterns - queries that are too broad without specifics
 * These single-word or very short queries typically need more context
 */
const VAGUE_TOPIC_PATTERNS: RegExp[] = [
  // Single topic words (must be the whole query or nearly all of it)
  /^(taxes?|healthcare|economy|education|immigration|environment|climate|guns?|abortion|rights?)\.?\s*$/i,
  /^(spending|budget|debt|jobs?|wages?|trade|tariffs?|china|russia)\.?\s*$/i,
  /^(security|defense|military|veterans?|housing|inflation|crime|drugs?)\.?\s*$/i,

  // Very short vague questions
  /^what about (.{3,15})[\?\.]?\s*$/i,
  /^tell me about (.{3,15})[\?\.]?\s*$/i,
  /^(.{3,15}) (?:info|information|stuff)[\?\.]?\s*$/i,
];

/**
 * Missing referent patterns - references to unspecified entities
 */
const MISSING_REFERENT_PATTERNS: RegExp[] = [
  // References to "the bill/act/law" without specifying which
  /\b(the|that|this) (bill|act|law|legislation|resolution|amendment)\b(?!\s+(on|about|regarding|for|to))/i,

  // References to unspecified legislators
  /\b(the|that|this) (senator|representative|congressman|congresswoman|legislator|member)\b(?!\s+from)/i,

  // Pronouns without clear antecedent in first message
  /^(what did|what does|what has|how did|how does) (he|she|they|it|them)\b/i,

  // References to "their" position without specifying who
  /\b(their|his|her) (position|stance|view|vote|statement)s?\b/i,
];

/**
 * Scope unclear patterns - who or what is being asked about
 */
const SCOPE_UNCLEAR_PATTERNS: RegExp[] = [
  // "What do they think" without specifying who
  /what do (they|people|legislators?|members?|congress) (think|say|believe|feel)\b/i,

  // Generic "opinions on" without specifying whose
  /\bopinions? on\b(?!.*\b(democrat|republican|senator|representative))/i,

  // "Both sides" without context
  /\b(both sides?|all sides?|everyone)\b.*(say|think|believe|position)/i,

  // Vague "who" questions
  /^who (supports?|opposes?|voted|said)\b(?!.*\b(the|a|this|that))/i,
];

/**
 * Time ambiguity patterns - unclear temporal scope
 */
const TIME_AMBIGUOUS_PATTERNS: RegExp[] = [
  // Vague time references
  /\b(recently|lately|now|currently|these days|nowadays)\b/i,

  // "Last" without specifying period
  /\blast (session|year|month|time)\b/i,

  // "Latest" without clear context
  /\b(the )?latest\b(?!\s+(bill|act|vote|version))/i,
];

/**
 * Multiple interpretation patterns - could mean different things
 */
const MULTIPLE_INTERPRETATION_PATTERNS: RegExp[] = [
  // Could refer to multiple policies
  /\b(reform|change|fix|address|solve)\b.*(problem|issue|crisis|situation)$/i,

  // Ambiguous between federal/state
  /\b(law|policy|regulation)s?\b(?!\s+(in|from|by)\s+(congress|senate|house))/i,
];

/**
 * Topics that commonly need clarification with their sub-topics
 */
export const TOPIC_CLARIFICATIONS: Record<string, string[]> = {
  taxes: ["income taxes", "corporate taxes", "capital gains taxes", "payroll taxes", "a specific tax bill"],
  healthcare: [
    "Medicare/Medicaid",
    "prescription drug prices",
    "health insurance coverage",
    "a specific healthcare bill",
  ],
  immigration: ["border security", "asylum policy", "DACA/Dreamers", "visa programs", "deportation policy"],
  climate: ["carbon emissions", "renewable energy", "EPA regulations", "the Green New Deal", "fossil fuel policy"],
  education: [
    "K-12 education",
    "higher education costs",
    "student loans",
    "school choice",
    "curriculum standards",
  ],
  guns: [
    "background checks",
    "assault weapons",
    "concealed carry",
    "red flag laws",
    "Second Amendment legislation",
  ],
  abortion: [
    "abortion access legislation",
    "abortion restrictions",
    "reproductive healthcare funding",
    "state-level abortion laws",
  ],
  economy: ["inflation", "jobs and employment", "minimum wage", "trade policy", "federal spending"],
  spending: ["defense spending", "entitlement programs", "infrastructure", "the federal budget", "debt ceiling"],
  security: ["national security", "cybersecurity", "border security", "domestic terrorism", "foreign threats"],
};

/**
 * Minimum query length to consider for vague topic detection
 * Shorter queries are more likely to be ambiguous
 */
const MIN_SPECIFIC_QUERY_LENGTH = 25;

/**
 * Confidence thresholds for clarification
 */
const CONFIDENCE_THRESHOLDS = {
  definitelyAmbiguous: 0.8,
  probablyAmbiguous: 0.5,
  slightlyAmbiguous: 0.3,
};

// =============================================================================
// Detection Functions
// =============================================================================

/**
 * Detect if a query is ambiguous and needs clarification
 *
 * @param query The user's query
 * @param conversationLength Number of previous messages (0 = first message)
 * @returns AmbiguityDetection result
 */
export function detectAmbiguity(query: string, conversationLength: number = 0): AmbiguityDetection {
  const normalizedQuery = query.trim().toLowerCase();
  const ambiguityTypes: AmbiguityType[] = [];
  const matchedPatterns: string[] = [];
  let confidenceScore = 0;

  // Check vague topic patterns
  for (const pattern of VAGUE_TOPIC_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      if (!ambiguityTypes.includes("vague_topic")) {
        ambiguityTypes.push("vague_topic");
      }
      matchedPatterns.push(pattern.toString());
      confidenceScore += 0.4;
    }
  }

  // Check missing referent patterns (more relevant in first message)
  if (conversationLength === 0) {
    for (const pattern of MISSING_REFERENT_PATTERNS) {
      if (pattern.test(normalizedQuery)) {
        if (!ambiguityTypes.includes("missing_referent")) {
          ambiguityTypes.push("missing_referent");
        }
        matchedPatterns.push(pattern.toString());
        confidenceScore += 0.5;
      }
    }
  }

  // Check scope unclear patterns
  for (const pattern of SCOPE_UNCLEAR_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      if (!ambiguityTypes.includes("scope_unclear")) {
        ambiguityTypes.push("scope_unclear");
      }
      matchedPatterns.push(pattern.toString());
      confidenceScore += 0.3;
    }
  }

  // Check time ambiguity patterns
  for (const pattern of TIME_AMBIGUOUS_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      if (!ambiguityTypes.includes("time_ambiguous")) {
        ambiguityTypes.push("time_ambiguous");
      }
      matchedPatterns.push(pattern.toString());
      confidenceScore += 0.2; // Lower weight - often can be inferred
    }
  }

  // Check multiple interpretation patterns
  for (const pattern of MULTIPLE_INTERPRETATION_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      if (!ambiguityTypes.includes("multiple_interpretations")) {
        ambiguityTypes.push("multiple_interpretations");
      }
      matchedPatterns.push(pattern.toString());
      confidenceScore += 0.25;
    }
  }

  // Short queries are more likely to be ambiguous
  if (normalizedQuery.length < MIN_SPECIFIC_QUERY_LENGTH && ambiguityTypes.length > 0) {
    confidenceScore += 0.15;
  }

  // Cap confidence at 1.0
  const confidence = Math.min(confidenceScore, 1.0);

  return {
    isAmbiguous: confidence >= CONFIDENCE_THRESHOLDS.probablyAmbiguous,
    ambiguityTypes,
    confidence,
    matchedPatterns,
  };
}

/**
 * Generate a clarification question based on detected ambiguity
 *
 * @param query The original query
 * @param detection The ambiguity detection result
 * @returns ClarificationQuestion or null if no good question can be generated
 */
export function generateClarificationQuestion(
  query: string,
  detection: AmbiguityDetection
): ClarificationQuestion | null {
  if (!detection.isAmbiguous || detection.ambiguityTypes.length === 0) {
    return null;
  }

  const normalizedQuery = query.trim().toLowerCase();

  // Handle vague topics first - check if we have predefined clarifications
  if (detection.ambiguityTypes.includes("vague_topic")) {
    for (const [topic, subtopics] of Object.entries(TOPIC_CLARIFICATIONS)) {
      if (normalizedQuery.includes(topic)) {
        return {
          question: `Are you interested in a specific aspect of ${topic}?`,
          options: subtopics.slice(0, 4).map((subtopic) => ({
            label: subtopic,
            refinedQuery: `${subtopic} in Congress`,
          })),
          ambiguityType: "vague_topic",
        };
      }
    }

    // Generic vague topic question
    return {
      question: "Could you be more specific about what you'd like to know?",
      options: [
        { label: "Recent legislation", refinedQuery: `legislation on ${normalizedQuery}` },
        { label: "Legislator positions", refinedQuery: `what legislators have said about ${normalizedQuery}` },
        { label: "Voting records", refinedQuery: `votes on ${normalizedQuery}` },
      ],
      ambiguityType: "vague_topic",
    };
  }

  // Handle missing referent
  if (detection.ambiguityTypes.includes("missing_referent")) {
    // Check for "the bill" type references
    const billMatch = normalizedQuery.match(/\b(the|that|this) (bill|act|legislation|resolution)/i);
    if (billMatch) {
      return {
        question: "Which bill would you like me to search for?",
        options: [
          { label: "Recent bills", refinedQuery: "recent legislation in Congress" },
          { label: "Popular bills", refinedQuery: "major legislation 2024" },
          { label: "I'll describe it", refinedQuery: query },
        ],
        ambiguityType: "missing_referent",
      };
    }

    // Check for "the senator" type references
    const legislatorMatch = normalizedQuery.match(
      /\b(the|that|this) (senator|representative|congressman|congresswoman)/i
    );
    if (legislatorMatch) {
      return {
        question: "Which legislator are you asking about?",
        options: [
          { label: "My state's legislators", refinedQuery: query },
          { label: "A committee chair", refinedQuery: `committee chairs ${normalizedQuery}` },
          { label: "I'll provide the name", refinedQuery: query },
        ],
        ambiguityType: "missing_referent",
      };
    }
  }

  // Handle scope unclear
  if (detection.ambiguityTypes.includes("scope_unclear")) {
    return {
      question: "Whose perspective would you like me to focus on?",
      options: [
        { label: "Democrats", refinedQuery: `${query} Democratic party` },
        { label: "Republicans", refinedQuery: `${query} Republican party` },
        { label: "Both parties", refinedQuery: `${query} bipartisan` },
        { label: "Specific legislators", refinedQuery: query },
      ],
      ambiguityType: "scope_unclear",
    };
  }

  // Handle time ambiguity
  if (detection.ambiguityTypes.includes("time_ambiguous")) {
    return {
      question: "What time period are you interested in?",
      options: [
        { label: "Last 6 months", refinedQuery: query },
        { label: "Current Congress (118th)", refinedQuery: `${query} 118th Congress` },
        { label: "Last 2 years", refinedQuery: `${query} since 2023` },
        { label: "All available (2020+)", refinedQuery: query },
      ],
      ambiguityType: "time_ambiguous",
    };
  }

  // Handle multiple interpretations
  if (detection.ambiguityTypes.includes("multiple_interpretations")) {
    return {
      question: "What type of information would be most helpful?",
      options: [
        { label: "Legislation & bills", refinedQuery: `${query} legislation` },
        { label: "Hearings & testimony", refinedQuery: `${query} hearings` },
        { label: "Legislator statements", refinedQuery: `${query} floor speeches` },
      ],
      ambiguityType: "multiple_interpretations",
    };
  }

  return null;
}

/**
 * Analyze a query and determine if clarification is needed
 *
 * @param query The user's query
 * @param conversationLength Number of previous messages
 * @returns ClarificationResult with full analysis
 */
export function analyzeQueryForClarification(query: string, conversationLength: number = 0): ClarificationResult {
  const detection = detectAmbiguity(query, conversationLength);
  const suggestedQuestion = generateClarificationQuestion(query, detection);

  return {
    needsClarification: detection.isAmbiguous && suggestedQuestion !== null,
    detection,
    suggestedQuestion,
  };
}

// =============================================================================
// Prompt Building
// =============================================================================

/**
 * System prompt section for handling ambiguous queries
 * Append this to the search system prompt when clarification mode is active
 */
export const CLARIFICATION_SYSTEM_ADDITION = `
## QUERY CLARIFICATION

When the user's query is ambiguous, ask ONE clarifying question before searching.

**Ambiguity types to detect:**

| Type | Example | Response |
|------|---------|----------|
| VAGUE TOPIC | "taxes" | "Are you interested in income taxes, corporate taxes, or a specific tax bill?" |
| MISSING REFERENT | "the bill" | "Which bill? Any details like topic, number, or sponsor help." |
| SCOPE UNCLEAR | "what do they think" | "Would you like statements from Democrats, Republicans, or both?" |
| TIME AMBIGUOUS | "recently" | Default to last 6 months, but mention you can adjust |

**Guidelines:**
- Keep clarifying questions brief (under 25 words)
- Offer 2-3 specific options when possible
- If somewhat ambiguous but searchable, proceed with search and note assumptions
- Never ask more than one clarifying question at a time
`;

/**
 * Build a prompt to instruct the AI to ask for clarification
 *
 * @param query The original ambiguous query
 * @param clarification The clarification result
 * @returns Prompt string to send to the AI
 */
export function buildClarificationPrompt(query: string, clarification: ClarificationResult): string {
  if (!clarification.needsClarification || !clarification.suggestedQuestion) {
    return "";
  }

  const { suggestedQuestion, detection } = clarification;

  const optionsText = suggestedQuestion.options.map((opt) => `- ${opt.label}`).join("\n");

  return `The user's query "${query}" is ambiguous (${detection.ambiguityTypes.join(", ")}).

Before searching, ask this clarifying question:
"${suggestedQuestion.question}"

Offer these options:
${optionsText}

Keep your response brief and conversational. Do not search yet.`;
}

/**
 * Check if a query is a response to a clarification question
 * (i.e., user is selecting from the offered options)
 *
 * @param query The user's new query
 * @param previousClarification The previous clarification that was asked
 * @returns True if this appears to be a clarification response
 */
export function isClarificationResponse(query: string, previousClarification: ClarificationQuestion): boolean {
  const normalizedQuery = query.trim().toLowerCase();

  // Check if query matches any of the offered options
  for (const option of previousClarification.options) {
    if (normalizedQuery.includes(option.label.toLowerCase())) {
      return true;
    }
  }

  // Check for selection-like responses
  const selectionPatterns = [
    /^(the )?(first|second|third|fourth|1st|2nd|3rd|4th|option \d)/i,
    /^(i want|i'd like|show me|tell me about|let's go with)/i,
    /^(yes|yeah|sure|okay|ok|that one|the one about)/i,
  ];

  return selectionPatterns.some((pattern) => pattern.test(normalizedQuery));
}

/**
 * Refine a query based on the user's clarification response
 *
 * @param originalQuery The original ambiguous query
 * @param userResponse The user's response to clarification
 * @param clarification The clarification that was asked
 * @returns Refined query string
 */
export function refineQueryFromClarification(
  originalQuery: string,
  userResponse: string,
  clarification: ClarificationQuestion
): string {
  const normalizedResponse = userResponse.trim().toLowerCase();

  // Check if response matches an option
  for (const option of clarification.options) {
    if (normalizedResponse.includes(option.label.toLowerCase())) {
      return option.refinedQuery;
    }
  }

  // If response is more detailed, use it as is
  if (userResponse.length > 15) {
    return userResponse;
  }

  // Otherwise, combine with original query
  return `${originalQuery} - ${userResponse}`;
}
