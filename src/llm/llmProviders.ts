// Pure, unit-testable provider configuration.
// No network calls, no Node-only imports — safe to import in Vitest.

export type ProviderId = 'foundry' | 'github'

/**
 * Resolves the active provider from env.
 * Defaults to 'foundry' so the demo works with just `az login` and no .env.
 */
export function resolveProviderId(env: Record<string, string | undefined>): ProviderId {
  const raw = env['LLM_PROVIDER']
  if (raw === 'github' || raw === 'foundry') return raw
  return 'foundry'
}

/**
 * Returns the upstream endpoint and model for the given provider.
 * All values can be overridden via env variables.
 */
export function providerConfig(
  id: ProviderId,
  env: Record<string, string | undefined>,
): { endpoint: string; model: string } {
  if (id === 'foundry') {
    const base = (
      env['FOUNDRY_ENDPOINT'] ?? 'https://foundrytestjes.services.ai.azure.com/openai/v1'
    ).replace(/\/$/, '')
    return {
      endpoint: `${base}/chat/completions`,
      model: env['FOUNDRY_DEPLOYMENT'] ?? 'gpt-5.4-mini',
    }
  }
  return {
    endpoint:
      env['GITHUB_MODELS_ENDPOINT'] ?? 'https://models.github.ai/inference/chat/completions',
    model: env['GITHUB_MODELS_MODEL'] ?? 'openai/gpt-4.1-mini',
  }
}

/**
 * Builds the upstream JSON body.
 * Always injects `model`; spreads incoming body.
 * For foundry: renames `max_tokens` → `max_completion_tokens` (gpt-5.4-mini quirk).
 * For github: leaves `max_tokens` as-is.
 */
export function transformBody(
  id: ProviderId,
  body: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const result: Record<string, unknown> = { model, ...body }
  if (id === 'foundry' && 'max_tokens' in result) {
    const maxTokens = result['max_tokens']
    delete result['max_tokens']
    result['max_completion_tokens'] = maxTokens
  }
  return result
}
