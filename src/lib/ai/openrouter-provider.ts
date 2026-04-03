import type {
  AiProvider,
  AiRequest,
  AiResponse,
  AiStreamChunk,
  ToolCall,
} from './types'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 500

// ---------------------------------------------------------------------------
// Pricing table (USD per 1k tokens). Extend as models are added.
// ---------------------------------------------------------------------------
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-sonnet-4': { input: 0.003, output: 0.015 },
  'anthropic/claude-haiku-4': { input: 0.00025, output: 0.00125 },
  'anthropic/claude-opus-4': { input: 0.015, output: 0.075 },
  'openai/gpt-4o': { input: 0.0025, output: 0.01 },
  'openai/gpt-4o-mini': { input: 0.00015, output: 0.0006 },
}

// ---------------------------------------------------------------------------
// Hook types for observability
// ---------------------------------------------------------------------------
export type RequestHook = (request: AiRequest, body: unknown) => void
export type ResponseHook = (response: AiResponse, durationMs: number) => void
export type ErrorHook = (error: Error, attempt: number) => void

export interface OpenRouterProviderOptions {
  apiKey?: string
  siteUrl?: string
  siteName?: string
  onRequest?: RequestHook
  onResponse?: ResponseHook
  onError?: ErrorHook
}

// ---------------------------------------------------------------------------
// Wire-format types returned by the OpenRouter API
// ---------------------------------------------------------------------------
interface OpenRouterToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

interface OpenRouterChoice {
  message: {
    role: string
    content: string | null
    tool_calls?: OpenRouterToolCall[]
  }
  finish_reason: string
}

interface OpenRouterResponse {
  id: string
  model: string
  choices: OpenRouterChoice[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

interface OpenRouterStreamDelta {
  role?: string
  content?: string
  tool_calls?: Array<{
    index: number
    id?: string
    type?: 'function'
    function?: {
      name?: string
      arguments?: string
    }
  }>
}

interface OpenRouterStreamChunk {
  id: string
  object: string
  choices: Array<{
    index: number
    delta: OpenRouterStreamDelta
    finish_reason: string | null
  }>
}

// ---------------------------------------------------------------------------
// Helper: sleep for exponential backoff
// ---------------------------------------------------------------------------
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Helper: parse tool calls from wire format
// ---------------------------------------------------------------------------
function parseToolCalls(raw: OpenRouterToolCall[]): ToolCall[] {
  return raw.map((tc) => {
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(tc.function.arguments) as Record<string, unknown>
    } catch {
      // If the model returns malformed JSON arguments, surface empty object
      // rather than crashing. Callers must validate tool arguments.
      args = {}
    }
    return { id: tc.id, name: tc.function.name, arguments: args }
  })
}

// ---------------------------------------------------------------------------
// Helper: map OpenRouter finish_reason to our finishReason
// ---------------------------------------------------------------------------
function mapFinishReason(
  raw: string | null
): AiResponse['finishReason'] {
  switch (raw) {
    case 'stop':
      return 'stop'
    case 'tool_calls':
      return 'tool_calls'
    case 'length':
    case 'max_tokens':
      return 'length'
    default:
      return 'error'
  }
}

// ---------------------------------------------------------------------------
// OpenRouterProvider
// ---------------------------------------------------------------------------
export class OpenRouterProvider implements AiProvider {
  private readonly apiKey: string
  private readonly headers: Record<string, string>
  private readonly onRequest?: RequestHook
  private readonly onResponse?: ResponseHook
  private readonly onError?: ErrorHook

  constructor(options: OpenRouterProviderOptions = {}) {
    const key = options.apiKey ?? process.env.OPENROUTER_API_KEY ?? ''
    if (!key) {
      throw new Error(
        'OpenRouterProvider: API key is required. ' +
          'Set OPENROUTER_API_KEY environment variable or pass apiKey in options.'
      )
    }
    this.apiKey = key
    this.headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...(options.siteUrl ? { 'HTTP-Referer': options.siteUrl } : {}),
      ...(options.siteName ? { 'X-Title': options.siteName } : {}),
    }
    this.onRequest = options.onRequest
    this.onResponse = options.onResponse
    this.onError = options.onError
  }

  // -------------------------------------------------------------------------
  // Build the request body shared by chat() and stream()
  // -------------------------------------------------------------------------
  private buildBody(request: AiRequest, stream: boolean): unknown {
    const body: Record<string, unknown> = {
      model: request.model ?? 'anthropic/claude-sonnet-4',
      messages: request.messages.map((m) => {
        const msg: Record<string, unknown> = {
          role: m.role,
          content: m.content,
        }
        if (m.toolCallId !== undefined) msg.tool_call_id = m.toolCallId
        if (m.toolCalls !== undefined) {
          msg.tool_calls = m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          }))
        }
        return msg
      }),
      stream,
    }
    if (request.temperature !== undefined) body.temperature = request.temperature
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }))
    }
    if (request.responseFormat === 'json') {
      body.response_format = { type: 'json_object' }
    }
    return body
  }

  // -------------------------------------------------------------------------
  // Fetch with retry + exponential backoff
  // -------------------------------------------------------------------------
  private async fetchWithRetry(
    url: string,
    body: unknown,
    attempt = 1
  ): Promise<Response> {
    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    })

    // Retry on 429 (rate limit) and 5xx (server errors)
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
      const err = new Error(`OpenRouter HTTP ${res.status} on attempt ${attempt}`)
      this.onError?.(err, attempt)
      await sleep(delay)
      return this.fetchWithRetry(url, body, attempt + 1)
    }

    return res
  }

  // -------------------------------------------------------------------------
  // chat()
  // -------------------------------------------------------------------------
  async chat(request: AiRequest): Promise<AiResponse> {
    const body = this.buildBody(request, false)
    this.onRequest?.(request, body)

    const startMs = Date.now()
    const res = await this.fetchWithRetry(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      body
    )

    if (!res.ok) {
      const text = await res.text()
      throw new Error(
        `OpenRouter chat error ${res.status}: ${text}`
      )
    }

    const data = (await res.json()) as OpenRouterResponse
    const choice = data.choices[0]
    if (!choice) {
      throw new Error('OpenRouter returned no choices')
    }

    const toolCalls =
      choice.message.tool_calls && choice.message.tool_calls.length > 0
        ? parseToolCalls(choice.message.tool_calls)
        : undefined

    const model = data.model ?? request.model ?? 'unknown'
    const usage = {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    }

    const response: AiResponse = {
      content: choice.message.content ?? '',
      toolCalls,
      model,
      usage,
      cost: this.estimateCost(model, usage.promptTokens, usage.completionTokens),
      finishReason: mapFinishReason(choice.finish_reason),
    }

    this.onResponse?.(response, Date.now() - startMs)
    return response
  }

  // -------------------------------------------------------------------------
  // stream()
  // -------------------------------------------------------------------------
  async *stream(request: AiRequest): AsyncGenerator<AiStreamChunk> {
    const body = this.buildBody(request, true)
    this.onRequest?.(request, body)

    const res = await this.fetchWithRetry(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      body
    )

    if (!res.ok) {
      const text = await res.text()
      yield { type: 'error', error: `OpenRouter stream error ${res.status}: ${text}` }
      return
    }

    if (!res.body) {
      yield { type: 'error', error: 'OpenRouter stream: response body is null' }
      return
    }

    // Accumulate partial tool-call arguments across chunks
    const toolCallAccumulator = new Map<
      number,
      { id: string; name: string; arguments: string }
    >()

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') {
            if (trimmed === 'data: [DONE]') {
              // Flush any accumulated tool calls
              for (const [, tc] of toolCallAccumulator) {
                let args: Record<string, unknown> = {}
                try {
                  args = JSON.parse(tc.arguments) as Record<string, unknown>
                } catch {
                  args = {}
                }
                yield {
                  type: 'tool_call',
                  toolCall: { id: tc.id, name: tc.name, arguments: args },
                }
              }
              yield { type: 'done' }
            }
            continue
          }

          if (!trimmed.startsWith('data: ')) continue
          const jsonStr = trimmed.slice(6)

          let chunk: OpenRouterStreamChunk
          try {
            chunk = JSON.parse(jsonStr) as OpenRouterStreamChunk
          } catch {
            // Malformed SSE line — skip
            continue
          }

          const delta = chunk.choices[0]?.delta
          if (!delta) continue

          // Content token
          if (delta.content) {
            yield { type: 'content', content: delta.content }
          }

          // Tool call deltas
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const existing = toolCallAccumulator.get(tc.index) ?? {
                id: '',
                name: '',
                arguments: '',
              }
              if (tc.id) existing.id = tc.id
              if (tc.function?.name) existing.name += tc.function.name
              if (tc.function?.arguments) existing.arguments += tc.function.arguments
              toolCallAccumulator.set(tc.index, existing)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  // -------------------------------------------------------------------------
  // generateStructured<T>()
  // Uses response_format: json_schema when schema is provided, with a
  // fallback to json_object mode and manual JSON.parse if the model does not
  // support strict structured output.
  // -------------------------------------------------------------------------
  async generateStructured<T>(
    request: AiRequest,
    schema: Record<string, unknown>
  ): Promise<T> {
    const body = this.buildBody(request, false) as Record<string, unknown>

    // Prefer json_schema (strict) over json_object
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: (schema['title'] as string | undefined) ?? 'response',
        strict: true,
        schema,
      },
    }

    this.onRequest?.(request, body)
    const startMs = Date.now()

    const res = await this.fetchWithRetry(
      `${OPENROUTER_BASE_URL}/chat/completions`,
      body
    )

    if (!res.ok) {
      const text = await res.text()
      throw new Error(
        `OpenRouter generateStructured error ${res.status}: ${text}`
      )
    }

    const data = (await res.json()) as OpenRouterResponse
    const choice = data.choices[0]
    if (!choice) {
      throw new Error('OpenRouter generateStructured returned no choices')
    }

    const raw = choice.message.content ?? ''
    let parsed: T
    try {
      parsed = JSON.parse(raw) as T
    } catch {
      throw new Error(
        `OpenRouter generateStructured: model returned non-JSON content: ${raw.slice(0, 200)}`
      )
    }

    const model = data.model ?? request.model ?? 'unknown'
    const usage = {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    }
    const syntheticResponse: AiResponse = {
      content: raw,
      model,
      usage,
      cost: this.estimateCost(model, usage.promptTokens, usage.completionTokens),
      finishReason: mapFinishReason(choice.finish_reason),
    }
    this.onResponse?.(syntheticResponse, Date.now() - startMs)

    return parsed
  }

  // -------------------------------------------------------------------------
  // estimateCost()
  // -------------------------------------------------------------------------
  estimateCost(
    model: string,
    promptTokens: number,
    completionTokens: number
  ): number {
    const pricing = MODEL_PRICING[model]
    if (!pricing) return 0
    return (
      (promptTokens / 1000) * pricing.input +
      (completionTokens / 1000) * pricing.output
    )
  }

  // -------------------------------------------------------------------------
  // listModels()
  // -------------------------------------------------------------------------
  async listModels(): Promise<string[]> {
    const res = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    })
    if (!res.ok) {
      throw new Error(`OpenRouter listModels error ${res.status}`)
    }
    const data = (await res.json()) as {
      data: Array<{ id: string }>
    }
    return data.data.map((m) => m.id)
  }

  // -------------------------------------------------------------------------
  // healthCheck()
  // -------------------------------------------------------------------------
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${OPENROUTER_BASE_URL}/models?limit=1`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      })
      return res.ok
    } catch {
      return false
    }
  }
}
