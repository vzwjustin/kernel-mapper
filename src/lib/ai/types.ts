export interface AiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCallId?: string
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema
}

export interface AiRequest {
  messages: AiMessage[]
  model?: string
  temperature?: number
  maxTokens?: number
  tools?: ToolDefinition[]
  responseFormat?: 'text' | 'json'
  stream?: boolean
}

export interface AiResponse {
  content: string
  toolCalls?: ToolCall[]
  model: string
  usage: { promptTokens: number; completionTokens: number; totalTokens: number }
  cost?: number
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error'
}

export interface AiStreamChunk {
  type: 'content' | 'tool_call' | 'done' | 'error'
  content?: string
  toolCall?: ToolCall
  error?: string
}

export interface AiProvider {
  chat(request: AiRequest): Promise<AiResponse>
  stream(request: AiRequest): AsyncGenerator<AiStreamChunk>
  generateStructured<T>(request: AiRequest, schema: Record<string, unknown>): Promise<T>
  estimateCost(model: string, promptTokens: number, completionTokens: number): number
  listModels(): Promise<string[]>
  healthCheck(): Promise<boolean>
}

// Model profiles for task routing
export interface ModelProfile {
  id: string
  name: string
  model: string
  description: string
  maxTokens: number
  costPer1kInput: number
  costPer1kOutput: number
}

export type TaskType =
  | 'build'
  | 'edit'
  | 'explain'
  | 'audit'
  | 'import'
  | 'repair'
  | 'micro_edit'
  | 'naming'

export interface TaskModelConfig {
  primary: string
  fallback?: string
  temperature: number
  maxTokens: number
}
