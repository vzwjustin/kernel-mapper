import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider'
import { routeTask, getModelConfig } from '@/lib/ai/task-router'
import type { AiMode } from '@/types/domain'
import type { AiRequest, AiStreamChunk } from '@/lib/ai/types'

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const AiRequestSchema = z.object({
  mode: z.enum(['BUILD', 'EDIT', 'EXPLAIN', 'AUDIT', 'IMPORT', 'REPAIR']),
  prompt: z.string().min(1, 'prompt is required'),
  projectId: z.string().optional(),
  schemaId: z.string().optional(),
  stream: z.boolean().optional().default(false),
})

// ---------------------------------------------------------------------------
// Map AiMode → TaskType (used by the task router for model selection)
// ---------------------------------------------------------------------------

type TaskType = 'build' | 'edit' | 'explain' | 'audit' | 'import' | 'repair'

function modeToTask(mode: AiMode): TaskType {
  return mode.toLowerCase() as TaskType
}

// ---------------------------------------------------------------------------
// Lazy provider factory — only instantiated when a request arrives.
// Throws at request time if OPENROUTER_API_KEY is not set.
// ---------------------------------------------------------------------------

function createProvider(): OpenRouterProvider {
  return new OpenRouterProvider({
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    siteName: 'KernelCanvas',
  })
}

// ---------------------------------------------------------------------------
// POST /api/ai
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json()
    const result = AiRequestSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: result.error.issues },
        { status: 400 },
      )
    }

    const { mode, prompt, stream } = result.data

    // Build the AI request
    const aiRequest: AiRequest = {
      messages: [
        {
          role: 'system',
          content:
            'You are KernelCanvas, an AI assistant specialised in designing and building ' +
            'Linux kernel API schemas (Generic Netlink, ioctl, character device). ' +
            'You help users define commands, events, types, and permissions that are ' +
            'correct, stable, and compatible with the Linux kernel ABI conventions.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }

    const task = modeToTask(mode)

    // -------------------------------------------------------------------
    // Streaming response
    // -------------------------------------------------------------------
    if (stream) {
      let provider: OpenRouterProvider
      try {
        provider = createProvider()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Provider unavailable'
        return NextResponse.json({ error: message }, { status: 503 })
      }

      const encoder = new TextEncoder()

      const readable = new ReadableStream({
        async start(controller) {
          try {
            // Apply task routing to get correct model/temperature, then stream.
            // routeTask() calls provider.chat() for non-streaming; for streaming
            // we apply the model config manually and call provider.stream() directly.
            const config = getModelConfig(task)
            const streamRequest: AiRequest = {
              ...aiRequest,
              model: aiRequest.model ?? config.primary,
              temperature: aiRequest.temperature ?? config.temperature,
              maxTokens: aiRequest.maxTokens ?? config.maxTokens,
              stream: true,
            }

            for await (const chunk of provider.stream(streamRequest)) {
              const sseChunk = formatSseChunk(chunk)
              if (sseChunk !== null) {
                controller.enqueue(encoder.encode(sseChunk))
              }
              if (chunk.type === 'done' || chunk.type === 'error') {
                break
              }
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Stream error'
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`),
            )
          } finally {
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // -------------------------------------------------------------------
    // Non-streaming response
    // -------------------------------------------------------------------
    let provider: OpenRouterProvider
    try {
      provider = createProvider()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Provider unavailable'
      return NextResponse.json({ error: message }, { status: 503 })
    }

    const aiResponse = await routeTask(task, provider, aiRequest)

    return NextResponse.json({
      mode,
      content: aiResponse.content,
      model: aiResponse.model,
      usage: aiResponse.usage,
      cost: aiResponse.cost,
      finishReason: aiResponse.finishReason,
    })
  } catch (error) {
    console.error('[POST /api/ai]', error)
    return NextResponse.json(
      { error: 'AI request failed' },
      { status: 500 },
    )
  }
}

// ---------------------------------------------------------------------------
// SSE formatting helper
// ---------------------------------------------------------------------------

function formatSseChunk(chunk: AiStreamChunk): string | null {
  switch (chunk.type) {
    case 'content':
      return `data: ${JSON.stringify({ type: 'content', content: chunk.content })}\n\n`
    case 'tool_call':
      return `data: ${JSON.stringify({ type: 'tool_call', toolCall: chunk.toolCall })}\n\n`
    case 'done':
      return `data: ${JSON.stringify({ type: 'done' })}\n\n`
    case 'error':
      return `data: ${JSON.stringify({ type: 'error', error: chunk.error })}\n\n`
    default:
      return null
  }
}
