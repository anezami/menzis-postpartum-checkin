# Handoff — LLM-powered Lizz (Azure AI Foundry / GitHub Models)

Welcome 👋 This document explains the project and how the LLM-powered Lizz works. The app is a **frontend-only** React + TypeScript + Vite + Tailwind demonstrator. **Fictitious data only — not a medical device.**

## Current state (what's already done)

- ✅ Full check-in MVP: deeplink → welcome → 3 questions → color-coded outcome → dashboard.
- ✅ **Generic, data-driven triage engine** (`src/engine/triage.ts`) — scoring strategy (`"max"`) read from `src/data/beslisboom.json`. New questions/outcomes via JSON only.
- ✅ **Lizz** conversational chat UI (`src/pages/LizzPage.tsx`, `src/components/lizz/*`) — static scripted flow as the baseline; **LLM mode on by default** (see below).
- ✅ **i18n** in 4 languages: Dutch, English, Turkish, Arabic (RTL). Auto-detect via `src/i18n/taal.ts`; per-language copy in `src/data/content/{nl,en,tr,ar}.json`.
- ✅ **LLM integration** — provider-pluggable dev proxy with **Azure AI Foundry** (Entra ID, `gpt-5.4-mini`) as default; GitHub Models as alternative. Engine remains authoritative; LLM only phrases questions and classifies free-text replies.
- ✅ Tests green: `npm run test` → **138/138 passing**. `npm run build` clean.

## How Lizz LLM mode works

### Golden rule — the engine stays authoritative

The LLM **does not** decide the triage outcome. It only:
1. **Phrases** each of the 3 questions conversationally in the user's language.
2. **Classifies** each free-text reply into an option `waarde` (1–4).

The triage engine always computes the result:

```ts
import { evalueer } from './engine/triage'
import { getBeslisboom } from './data/profielen'
const uitkomst = evalueer(getBeslisboom(), antwoorden) // niveau + signaal + kleur
```

If the LLM is unavailable or returns low-confidence output, Lizz **falls back silently** to the static chip flow. The demo never hard-fails.

### Architecture: server-side proxy (credentials never in the browser)

```
Browser (Lizz UI)  ──POST /api/lizz/chat──►  Vite middleware  ──►  Azure AI Foundry (default)
   no .env needed                            (acquires token)       gpt-5.4-mini
                                             via DefaultAzureCredential
                                             (az login on laptop)
```

- **Proxy** — `vite.config.ts` registers a `configureServer` middleware plugin. It reads the active provider from `LLM_PROVIDER` (defaults to `'foundry'`), acquires a bearer token, and forwards the request.
  - **Foundry**: uses `DefaultAzureCredential` from `@azure/identity` (scope `https://ai.azure.com/.default`). On a developer laptop this resolves via `az login`. Token is cached and refreshed 5 minutes before expiry.
  - **GitHub**: reads `GITHUB_TOKEN` or `GITHUB_MODELS_TOKEN` from `.env`.
  - If no credential is available → `503 {"error":"llm_not_configured"}` → UI silently activates static fallback.
- **Provider module** — `src/llm/llmProviders.ts`: pure, zero-network functions — `resolveProviderId`, `providerConfig`, `transformBody`. Unit-tested in `src/llm/llmProviders.test.ts`.
  - **Foundry quirk**: `max_tokens` is not accepted by `gpt-5.4-mini` — `transformBody` renames it to `max_completion_tokens` automatically.
- **Client transport** — `src/llm/githubModels.ts`: `chat(messages, opts?)` → POST `/api/lizz/chat` → returns `choices[0].message.content`. Throws `LlmError(status)` on non-2xx so callers detect 503 → static fallback.
- **Orchestration** — `src/llm/lizzConversation.ts`:
  - `vraagBeurt(args)` — asks the model to rephrase the current question warmly in the user's language.
  - `classificeerAntwoord(args)` — classifies free text into `{waarde, zekerheid, erkenning}` JSON; `zekerheid < 0.5` or parse failure → `{ onzeker: true }` → UI falls back to chips.
- **UI** — `src/pages/LizzPage.tsx`: LLM mode is ON unless `VITE_LIZZ_LLM_ENABLED=false`. Any failure → silent static fallback with an "offline modus" note.

### Laptop credential flow (zero config)

```
npm run dev
  → Vite starts
  → lizzProxyPlugin logs: [lizz-proxy] provider=foundry model=gpt-5.4-mini
  → first POST to /api/lizz/chat
  → getFoundryToken() calls DefaultAzureCredential.getToken('https://ai.azure.com/.default')
  → resolves via az login token cache on disk
  → bearer token forwarded to https://foundrytestjes.services.ai.azure.com/openai/v1/chat/completions
  → response streamed back to browser
```

Nothing secret in the browser or in git. Token lives only in the Node process memory.

### Quick start (default — Foundry, no .env needed)

```bash
az login          # one-time per machine
npm run dev
# Open: http://localhost:5173/lizz?token=demo123&moment=inschrijving
```

### Switching to GitHub Models

```bash
cp .env.example .env
# Edit .env — uncomment:
#   LLM_PROVIDER=github
#   GITHUB_TOKEN=<paste gh auth token output>
npm run dev
```

### Disabling LLM (static chip flow only)

```bash
cp .env.example .env
# Uncomment: VITE_LIZZ_LLM_ENABLED=false
npm run dev
```

### Proxy error codes

| Status | Meaning |
|---|---|
| `503 {"error":"llm_not_configured"}` | No credential available → static fallback activates |
| `502 {"error":"upstream_failure"}` | Upstream (Foundry / GitHub Models) unreachable → static fallback activates |

### Provider environment variables (all optional)

| Variable | Default | Purpose |
|---|---|---|
| `LLM_PROVIDER` | `foundry` | `foundry` or `github` |
| `FOUNDRY_ENDPOINT` | `https://foundrytestjes.services.ai.azure.com/openai/v1` | Foundry base URL |
| `FOUNDRY_DEPLOYMENT` | `gpt-5.4-mini` | Foundry deployment/model name |
| `GITHUB_TOKEN` | — | GitHub PAT (required when `LLM_PROVIDER=github`) |
| `GITHUB_MODELS_MODEL` | `openai/gpt-4.1-mini` | GitHub Models model name |
| `VITE_LIZZ_LLM_ENABLED` | (enabled) | Set to `false` to force static flow |

### Guardrails / acceptance

- `npm run test` stays green. `npm run build` is clean.
- `.env` is git-ignored. No secrets committed.
- LLM output is **never** trusted for the triage decision — `evalueer()` is always the source of truth.
- Static flow works identically when `VITE_LIZZ_LLM_ENABLED=false`.
- `@azure/identity` is a **devDependency** — it never ships in the browser bundle.
- `llmProviders.ts` has no Node-only imports — it's Vitest-safe.

## Known issues / watch-outs (from code review — now fixed)

- **`handleVorige` in `src/pages/LizzPage.tsx`** — Previously sliced a hardcoded 3 messages. Now tracks `answerMsgStart` (message index before each user-antwoord) so undo removes exactly the right messages even when LLM injects variable-length intermediate messages.

## Useful entry points

| What | Where |
|------|-------|
| Conversational UI | `src/pages/LizzPage.tsx`, `src/components/lizz/*` |
| LLM transport (client) | `src/llm/githubModels.ts` |
| LLM conversation orchestration | `src/llm/lizzConversation.ts` |
| Provider abstraction (pure) | `src/llm/llmProviders.ts` |
| Dev proxy (server, credential-holder) | `vite.config.ts` — `lizzProxyPlugin` |
| Authoritative engine (do not bypass) | `src/engine/triage.ts`, `src/engine/types.ts` |
| Decision tree (canonical numeric data) | `src/data/beslisboom.json` |
| Per-language display copy | `src/data/content/{nl,en,tr,ar}.json` + `index.ts` |
| Language detection / RTL | `src/i18n/taal.ts` |
| Shared state + signal store | `src/context/CheckinContext.tsx` (`useCheckin`) |
| Env template | `.env.example` |
