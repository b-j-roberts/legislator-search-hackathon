import { NextRequest, NextResponse } from 'next/server';
import type { ChatRequest } from '@/lib/types';

const MAPLE_PROXY_URL = process.env.MAPLE_PROXY_URL || 'http://localhost:8080/v1';
const MAPLE_API_KEY = process.env.MAPLE_API_KEY || '';
const MAPLE_MODEL = process.env.MAPLE_MODEL || 'llama-3.3-70b';

const SYSTEM_PROMPT = `You are a helpful assistant for researching US legislators, congressional hearings, voting records, and legislative documents. Your goal is to help citizens identify and contact legislators on issues they care about.

When responding:
- Provide accurate, factual information about legislators and their positions
- Include relevant voting records and public statements when available
- Offer contact information when asked
- Be nonpartisan and present multiple perspectives
- Cite sources when possible

If you don't have specific information, say so clearly rather than making assumptions.`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatRequest;

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Message is required' } },
        { status: 400 }
      );
    }

    if (!MAPLE_API_KEY) {
      return NextResponse.json(
        { error: { code: 'CONFIG_ERROR', message: 'Maple API key not configured' } },
        { status: 500 }
      );
    }

    // Build messages array with conversation history if provided
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (body.context?.previousMessages) {
      for (const msg of body.context.previousMessages) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    messages.push({ role: 'user', content: body.message });

    // Call Maple Proxy (OpenAI-compatible API)
    const mapleResponse = await fetch(`${MAPLE_PROXY_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MAPLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: MAPLE_MODEL,
        messages,
        stream: true,
      }),
    });

    if (!mapleResponse.ok) {
      const errorText = await mapleResponse.text();
      console.error('Maple API error:', mapleResponse.status, errorText);
      return NextResponse.json(
        {
          error: {
            code: 'MAPLE_ERROR',
            message: `Maple API error: ${mapleResponse.status}`,
            details: errorText,
          },
        },
        { status: mapleResponse.status }
      );
    }

    // Stream the response back to the client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = mapleResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }

            // Forward the SSE data as-is (Maple uses OpenAI format)
            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'An error occurred',
        },
      },
      { status: 500 }
    );
  }
}
