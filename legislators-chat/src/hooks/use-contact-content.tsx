"use client";

import * as React from "react";
import type {
  Legislator,
  TonePreference,
  AdvocacyContext,
  GeneratedContent,
  CallScript,
  EmailDraft,
  ContentGenerationParams,
  ContactMethod,
} from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

interface ContentGenerationState {
  /** Whether content is currently being generated */
  isGenerating: boolean;
  /** Error message if generation failed */
  error: string | null;
  /** Generated content indexed by legislator ID and content type */
  content: Record<string, Record<"call" | "email", GeneratedContent | null>>;
  /** Currently selected tone */
  selectedTone: TonePreference;
  /** User's advocacy context */
  advocacyContext: AdvocacyContext | null;
}

interface ContactContentContextValue {
  /** Current generation state */
  state: ContentGenerationState;
  /** Generate content for a legislator */
  generateContent: (
    legislator: Legislator,
    contentType: "call" | "email",
    options?: { tone?: TonePreference; forceRegenerate?: boolean }
  ) => Promise<void>;
  /** Get generated content for a legislator */
  getContent: (legislatorId: string, contentType: "call" | "email") => GeneratedContent | null;
  /** Check if content exists for a legislator */
  hasContent: (legislatorId: string, contentType: "call" | "email") => boolean;
  /** Clear generated content for a legislator */
  clearContent: (legislatorId: string, contentType?: "call" | "email") => void;
  /** Clear all generated content */
  clearAllContent: () => void;
  /** Set the selected tone */
  setSelectedTone: (tone: TonePreference) => void;
  /** Set the advocacy context */
  setAdvocacyContext: (context: AdvocacyContext | null) => void;
  /** Update specific fields of advocacy context */
  updateAdvocacyContext: (updates: Partial<AdvocacyContext>) => void;
  /** Whether currently generating for a specific legislator */
  isGeneratingFor: (legislatorId: string) => boolean;
  /** The ID of the legislator currently being generated for */
  generatingForId: string | null;
}

type ContentAction =
  | { type: "START_GENERATION"; payload: { legislatorId: string } }
  | { type: "GENERATION_SUCCESS"; payload: { legislatorId: string; contentType: "call" | "email"; content: GeneratedContent } }
  | { type: "GENERATION_ERROR"; payload: { error: string } }
  | { type: "CLEAR_ERROR" }
  | { type: "CLEAR_CONTENT"; payload: { legislatorId: string; contentType?: "call" | "email" } }
  | { type: "CLEAR_ALL_CONTENT" }
  | { type: "SET_TONE"; payload: TonePreference }
  | { type: "SET_ADVOCACY_CONTEXT"; payload: AdvocacyContext | null }
  | { type: "UPDATE_ADVOCACY_CONTEXT"; payload: Partial<AdvocacyContext> };

// =============================================================================
// Reducer
// =============================================================================

function contentReducer(
  state: ContentGenerationState,
  action: ContentAction
): ContentGenerationState {
  switch (action.type) {
    case "START_GENERATION":
      return {
        ...state,
        isGenerating: true,
        error: null,
      };

    case "GENERATION_SUCCESS": {
      const { legislatorId, contentType, content } = action.payload;
      return {
        ...state,
        isGenerating: false,
        error: null,
        content: {
          ...state.content,
          [legislatorId]: {
            ...state.content[legislatorId],
            [contentType]: content,
          },
        },
      };
    }

    case "GENERATION_ERROR":
      return {
        ...state,
        isGenerating: false,
        error: action.payload.error,
      };

    case "CLEAR_ERROR":
      return {
        ...state,
        error: null,
      };

    case "CLEAR_CONTENT": {
      const { legislatorId, contentType } = action.payload;
      if (contentType) {
        // Clear specific content type
        return {
          ...state,
          content: {
            ...state.content,
            [legislatorId]: {
              ...state.content[legislatorId],
              [contentType]: null,
            },
          },
        };
      }
      // Clear all content for legislator
      const newContent = { ...state.content };
      delete newContent[legislatorId];
      return {
        ...state,
        content: newContent,
      };
    }

    case "CLEAR_ALL_CONTENT":
      return {
        ...state,
        content: {},
        error: null,
      };

    case "SET_TONE":
      return {
        ...state,
        selectedTone: action.payload,
      };

    case "SET_ADVOCACY_CONTEXT":
      return {
        ...state,
        advocacyContext: action.payload,
      };

    case "UPDATE_ADVOCACY_CONTEXT":
      return {
        ...state,
        advocacyContext: state.advocacyContext
          ? { ...state.advocacyContext, ...action.payload }
          : { topic: "", ...action.payload },
      };

    default:
      return state;
  }
}

// =============================================================================
// API Client
// =============================================================================

interface GenerateContentResponse {
  success: boolean;
  callScript?: CallScript;
  emailDraft?: EmailDraft;
  error?: {
    code: string;
    message: string;
  };
}

async function generateContentAPI(
  params: ContentGenerationParams
): Promise<GenerateContentResponse> {
  const response = await fetch("/api/generate-content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ params }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return {
      success: false,
      error: {
        code: "API_ERROR",
        message: errorData?.error?.message || `Request failed with status ${response.status}`,
      },
    };
  }

  return response.json();
}

// =============================================================================
// Context
// =============================================================================

const ContactContentContext = React.createContext<ContactContentContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface ContactContentProviderProps {
  children: React.ReactNode;
  /** Initial research context from chat phase */
  initialResearchContext?: string | null;
}

export function ContactContentProvider({
  children,
  initialResearchContext,
}: ContactContentProviderProps) {
  const [state, dispatch] = React.useReducer(contentReducer, {
    isGenerating: false,
    error: null,
    content: {},
    selectedTone: "formal",
    advocacyContext: initialResearchContext
      ? { topic: initialResearchContext }
      : null,
  });

  // Track which legislator is currently being generated
  const [generatingForId, setGeneratingForId] = React.useState<string | null>(null);

  // Sync research context when it changes from parent
  React.useEffect(() => {
    if (initialResearchContext && !state.advocacyContext?.topic) {
      dispatch({
        type: "SET_ADVOCACY_CONTEXT",
        payload: { topic: initialResearchContext },
      });
    }
  }, [initialResearchContext, state.advocacyContext?.topic]);

  const generateContent = React.useCallback(
    async (
      legislator: Legislator,
      contentType: "call" | "email",
      options?: { tone?: TonePreference; forceRegenerate?: boolean }
    ) => {
      const { tone = state.selectedTone, forceRegenerate = false } = options || {};

      // Check if content already exists and we're not forcing regeneration
      const existingContent = state.content[legislator.id]?.[contentType];
      if (existingContent && !forceRegenerate) {
        return;
      }

      // Check for advocacy context
      if (!state.advocacyContext?.topic) {
        dispatch({
          type: "GENERATION_ERROR",
          payload: { error: "Please provide a topic or issue to generate content about." },
        });
        return;
      }

      dispatch({ type: "START_GENERATION", payload: { legislatorId: legislator.id } });
      setGeneratingForId(legislator.id);

      try {
        const params: ContentGenerationParams = {
          legislator,
          advocacyContext: state.advocacyContext,
          tone,
          contentType,
          includeReferences: true,
        };

        const response = await generateContentAPI(params);

        if (!response.success || response.error) {
          throw new Error(response.error?.message || "Content generation failed");
        }

        const generatedContent: GeneratedContent = {
          id: `${legislator.id}-${contentType}-${Date.now()}`,
          legislatorId: legislator.id,
          generatedAt: new Date().toISOString(),
          params: {
            advocacyContext: state.advocacyContext,
            tone,
            contentType,
            includeReferences: true,
          },
          callScript: response.callScript,
          emailDraft: response.emailDraft,
        };

        dispatch({
          type: "GENERATION_SUCCESS",
          payload: {
            legislatorId: legislator.id,
            contentType,
            content: generatedContent,
          },
        });
      } catch (error) {
        dispatch({
          type: "GENERATION_ERROR",
          payload: {
            error: error instanceof Error ? error.message : "Content generation failed",
          },
        });
      } finally {
        setGeneratingForId(null);
      }
    },
    [state.selectedTone, state.advocacyContext, state.content]
  );

  const getContent = React.useCallback(
    (legislatorId: string, contentType: "call" | "email"): GeneratedContent | null => {
      return state.content[legislatorId]?.[contentType] || null;
    },
    [state.content]
  );

  const hasContent = React.useCallback(
    (legislatorId: string, contentType: "call" | "email"): boolean => {
      return !!state.content[legislatorId]?.[contentType];
    },
    [state.content]
  );

  const clearContent = React.useCallback(
    (legislatorId: string, contentType?: "call" | "email") => {
      dispatch({ type: "CLEAR_CONTENT", payload: { legislatorId, contentType } });
    },
    []
  );

  const clearAllContent = React.useCallback(() => {
    dispatch({ type: "CLEAR_ALL_CONTENT" });
  }, []);

  const setSelectedTone = React.useCallback((tone: TonePreference) => {
    dispatch({ type: "SET_TONE", payload: tone });
  }, []);

  const setAdvocacyContext = React.useCallback((context: AdvocacyContext | null) => {
    dispatch({ type: "SET_ADVOCACY_CONTEXT", payload: context });
  }, []);

  const updateAdvocacyContext = React.useCallback((updates: Partial<AdvocacyContext>) => {
    dispatch({ type: "UPDATE_ADVOCACY_CONTEXT", payload: updates });
  }, []);

  const isGeneratingFor = React.useCallback(
    (legislatorId: string): boolean => {
      return state.isGenerating && generatingForId === legislatorId;
    },
    [state.isGenerating, generatingForId]
  );

  const value: ContactContentContextValue = {
    state,
    generateContent,
    getContent,
    hasContent,
    clearContent,
    clearAllContent,
    setSelectedTone,
    setAdvocacyContext,
    updateAdvocacyContext,
    isGeneratingFor,
    generatingForId,
  };

  return (
    <ContactContentContext.Provider value={value}>
      {children}
    </ContactContentContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useContactContent(): ContactContentContextValue {
  const context = React.useContext(ContactContentContext);

  if (!context) {
    throw new Error("useContactContent must be used within a ContactContentProvider");
  }

  return context;
}

// =============================================================================
// Utility Hooks
// =============================================================================

/**
 * Hook to get content for the currently active legislator
 */
export function useActiveContent(
  activeItem: { legislator: Legislator; contactMethod?: ContactMethod } | null
) {
  const { getContent, hasContent, generateContent, isGeneratingFor, state } = useContactContent();

  const legislatorId = activeItem?.legislator.id;
  const contentType = activeItem?.contactMethod || "call";

  const content = legislatorId ? getContent(legislatorId, contentType) : null;
  const hasGeneratedContent = legislatorId ? hasContent(legislatorId, contentType) : false;
  const isGenerating = legislatorId ? isGeneratingFor(legislatorId) : false;

  const generate = React.useCallback(
    async (options?: { tone?: TonePreference; forceRegenerate?: boolean }) => {
      if (activeItem?.legislator) {
        await generateContent(activeItem.legislator, contentType, options);
      }
    },
    [activeItem, contentType, generateContent]
  );

  return {
    content,
    hasContent: hasGeneratedContent,
    isGenerating,
    generate,
    error: state.error,
    selectedTone: state.selectedTone,
  };
}
