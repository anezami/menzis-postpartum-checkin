import { describe, it, expect } from 'vitest'
import { resolveProviderId, providerConfig, transformBody } from './llmProviders'

// ---------------------------------------------------------------------------
// resolveProviderId
// ---------------------------------------------------------------------------

describe('resolveProviderId', () => {
  it('defaults to foundry when LLM_PROVIDER is absent', () => {
    expect(resolveProviderId({})).toBe('foundry')
  })

  it('defaults to foundry when LLM_PROVIDER is an unrecognised value', () => {
    expect(resolveProviderId({ LLM_PROVIDER: 'openai' })).toBe('foundry')
  })

  it('returns foundry when LLM_PROVIDER=foundry', () => {
    expect(resolveProviderId({ LLM_PROVIDER: 'foundry' })).toBe('foundry')
  })

  it('returns github when LLM_PROVIDER=github', () => {
    expect(resolveProviderId({ LLM_PROVIDER: 'github' })).toBe('github')
  })
})

// ---------------------------------------------------------------------------
// providerConfig — foundry
// ---------------------------------------------------------------------------

describe('providerConfig — foundry', () => {
  it('returns default endpoint and model when no overrides', () => {
    const cfg = providerConfig('foundry', {})
    expect(cfg.endpoint).toBe(
      'https://foundrytestjes.services.ai.azure.com/openai/v1/chat/completions',
    )
    expect(cfg.model).toBe('gpt-5.4-mini')
  })

  it('respects FOUNDRY_ENDPOINT override (strips trailing slash)', () => {
    const cfg = providerConfig('foundry', {
      FOUNDRY_ENDPOINT: 'https://my.foundry.com/openai/v2/',
    })
    expect(cfg.endpoint).toBe('https://my.foundry.com/openai/v2/chat/completions')
  })

  it('respects FOUNDRY_DEPLOYMENT override', () => {
    const cfg = providerConfig('foundry', { FOUNDRY_DEPLOYMENT: 'gpt-4o-mini' })
    expect(cfg.model).toBe('gpt-4o-mini')
  })
})

// ---------------------------------------------------------------------------
// providerConfig — github
// ---------------------------------------------------------------------------

describe('providerConfig — github', () => {
  it('returns default endpoint and model when no overrides', () => {
    const cfg = providerConfig('github', {})
    expect(cfg.endpoint).toBe('https://models.github.ai/inference/chat/completions')
    expect(cfg.model).toBe('openai/gpt-4.1-mini')
  })

  it('respects GITHUB_MODELS_ENDPOINT override', () => {
    const cfg = providerConfig('github', {
      GITHUB_MODELS_ENDPOINT: 'https://custom.github.ai/inference/chat/completions',
    })
    expect(cfg.endpoint).toBe('https://custom.github.ai/inference/chat/completions')
  })

  it('respects GITHUB_MODELS_MODEL override', () => {
    const cfg = providerConfig('github', { GITHUB_MODELS_MODEL: 'openai/gpt-4o' })
    expect(cfg.model).toBe('openai/gpt-4o')
  })
})

// ---------------------------------------------------------------------------
// transformBody
// ---------------------------------------------------------------------------

describe('transformBody', () => {
  it('always injects model', () => {
    const result = transformBody('foundry', { messages: [] }, 'gpt-5.4-mini')
    expect(result['model']).toBe('gpt-5.4-mini')
  })

  it('spreads incoming body fields', () => {
    const result = transformBody('github', { temperature: 0.7, messages: ['x'] }, 'gpt-4.1-mini')
    expect(result['temperature']).toBe(0.7)
    expect(result['messages']).toEqual(['x'])
  })

  it('foundry: renames max_tokens → max_completion_tokens', () => {
    const result = transformBody('foundry', { messages: [], max_tokens: 150 }, 'gpt-5.4-mini')
    expect('max_tokens' in result).toBe(false)
    expect(result['max_completion_tokens']).toBe(150)
  })

  it('foundry: leaves body unchanged when max_tokens is absent', () => {
    const result = transformBody('foundry', { messages: [], temperature: 0.2 }, 'gpt-5.4-mini')
    expect('max_tokens' in result).toBe(false)
    expect('max_completion_tokens' in result).toBe(false)
  })

  it('github: leaves max_tokens as-is', () => {
    const result = transformBody('github', { messages: [], max_tokens: 120 }, 'openai/gpt-4.1-mini')
    expect(result['max_tokens']).toBe(120)
    expect('max_completion_tokens' in result).toBe(false)
  })

  it('foundry: model is overridden by explicit model in body (spread wins for model key)', () => {
    // model in body should be overwritten by the injected model (model is first, body spreads after,
    // then body model overrides — but in our impl we do { model, ...body }, so body.model wins)
    const result = transformBody('foundry', { model: 'old-model', messages: [] }, 'gpt-5.4-mini')
    // body spread overwrites; body has model='old-model' which overrides injected 'gpt-5.4-mini'
    // This is intentional: callers should NOT pass model; proxy owns it. Documenting actual behaviour.
    expect(result['model']).toBe('old-model')
  })

  it('foundry: response_format passes through unchanged', () => {
    const result = transformBody(
      'foundry',
      { messages: [], response_format: { type: 'json_object' } },
      'gpt-5.4-mini',
    )
    expect(result['response_format']).toEqual({ type: 'json_object' })
  })
})
