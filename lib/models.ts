// Simplified AI models using Vercel AI Gateway (zero-config)
// All models work through AI Gateway without needing API keys

export type LLMModel = {
  id: string
  name: string
  provider: string
  providerId: string
  isBeta?: boolean
}

export type LLMModelConfig = {
  temperature?: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  maxTokens?: number
}

// Available models through Vercel AI Gateway
export const AVAILABLE_MODELS: LLMModel[] = [
  // OpenAI Models (zero-config via AI Gateway)
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', providerId: 'openai' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', providerId: 'openai' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI', providerId: 'openai' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI', providerId: 'openai' },
  
  // Anthropic Models (zero-config via AI Gateway)
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', providerId: 'anthropic' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'Anthropic', providerId: 'anthropic' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'Anthropic', providerId: 'anthropic' },
  
  // Google Models (zero-config via AI Gateway)
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash', provider: 'Google', providerId: 'google' },
  { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro', provider: 'Google', providerId: 'google' },
  { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash', provider: 'Google', providerId: 'google' },
]

// Get model string for AI SDK (provider/model-id format for AI Gateway)
export function getModelString(model: LLMModel): string {
  return `${model.providerId}/${model.id}`
}

// Get default model
export function getDefaultModel(): LLMModel {
  return AVAILABLE_MODELS[0] // GPT-4o as default
}

export function getDefaultModelParams(model: LLMModel): LLMModelConfig {
  return {
    temperature: 0.7,
    maxTokens: 4096,
  }
}
