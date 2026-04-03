import type { AiProvider, AiRequest, AiResponse, TaskModelConfig, TaskType } from './types'

// ---------------------------------------------------------------------------
// Task → model config mapping
// ---------------------------------------------------------------------------
export const TASK_MODEL_CONFIG: Record<TaskType, TaskModelConfig> = {
  // Heavy schema construction from natural language — needs reasoning depth
  build: {
    primary: 'anthropic/claude-sonnet-4',
    temperature: 0.7,
    maxTokens: 4096,
  },
  // Targeted edits to existing schema — lower temperature for precision
  edit: {
    primary: 'anthropic/claude-sonnet-4',
    temperature: 0.3,
    maxTokens: 2048,
  },
  // Explanations of design choices — moderate creativity
  explain: {
    primary: 'anthropic/claude-sonnet-4',
    temperature: 0.5,
    maxTokens: 2048,
  },
  // ABI / compatibility auditing — very low temperature for consistency
  audit: {
    primary: 'anthropic/claude-sonnet-4',
    temperature: 0.2,
    maxTokens: 4096,
  },
  // Importing and analyzing existing kernel/UAPI headers
  import: {
    primary: 'anthropic/claude-sonnet-4',
    temperature: 0.3,
    maxTokens: 4096,
  },
  // Repairing broken schema wiring or mismatched type contracts
  repair: {
    primary: 'anthropic/claude-sonnet-4',
    temperature: 0.3,
    maxTokens: 2048,
  },
  // Fast inline edits — small model is sufficient
  micro_edit: {
    primary: 'anthropic/claude-haiku-4',
    temperature: 0.2,
    maxTokens: 1024,
  },
  // Identifier / symbol naming suggestions
  naming: {
    primary: 'anthropic/claude-haiku-4',
    temperature: 0.5,
    maxTokens: 512,
  },
}

// ---------------------------------------------------------------------------
// getModelConfig
// ---------------------------------------------------------------------------
export function getModelConfig(task: TaskType): TaskModelConfig {
  return TASK_MODEL_CONFIG[task]
}

// ---------------------------------------------------------------------------
// routeTask
//
// Applies the task-appropriate model, temperature, and maxTokens to the
// provided request, then dispatches via the given provider. The caller's
// request values are preserved where they are explicitly set; the task config
// acts as a default that is only applied when the caller has not overridden.
// ---------------------------------------------------------------------------
export async function routeTask(
  task: TaskType,
  provider: AiProvider,
  request: AiRequest
): Promise<AiResponse> {
  const config = getModelConfig(task)

  const routed: AiRequest = {
    ...request,
    model: request.model ?? config.primary,
    temperature: request.temperature ?? config.temperature,
    maxTokens: request.maxTokens ?? config.maxTokens,
  }

  return provider.chat(routed)
}
