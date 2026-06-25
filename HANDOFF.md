# Handoff — LLM-powered Lizz (for the next developer)

Welcome 👋 This document explains exactly where the project stands and how to add
the LLM (Azure AI Foundry) conversational layer. The app is a **frontend-only**
React + TypeScript + Vite + Tailwind demonstrator. **Fictitious data only — not a
medical device.**

## Current state (what's already done)

- ✅ Full check-in MVP: deeplink → welcome → 3 questions → color-coded outcome → dashboard.
- ✅ **Generic, data-driven triage engine** (`src/engine/triage.ts`) — scoring strategy
  (`"max"`) read from `src/data/beslisboom.json`. New questions/outcomes via JSON only.
- ✅ **Lizz** conversational chat UI (`src/pages/LizzPage.tsx`, `src/components/lizz/*`)
  — currently runs a **static scripted flow** (chips + optional free text).
- ✅ **i18n** in 4 languages: Dutch, English, Turkish, Arabic (RTL). Auto-detect via
  `src/i18n/taal.ts`; per-language copy in `src/data/content/{nl,en,tr,ar}.json`.
- ✅ Tests green: `npm run test` → **112/112 passing**. `npm run build` clean.

## The one thing to build: LLM conversation

Replace the *static* Lizz script with a **natural, multilingual LLM conversation**
that still produces the same authoritative result.

### Golden rule — the engine stays authoritative

The LLM **must not** decide the triage outcome. It only conducts the conversation and
**elicits the 3 answers**. Map each user reply to an option `waarde` (1–4) from
`beslisboom.json`, then compute the result with the existing engine:

```ts
import { evalueer, getBeslisboom } from "./engine/triage";
const uitkomst = evalueer(getBeslisboom(), antwoorden); // niveau + signaal + advies
```

This keeps scoring deterministic, testable, and identical to the classic flow.

### Agreed architecture: server-side proxy (key never in the browser)

```
Browser (Lizz UI)  ──POST /api/lizz──►  Local proxy  ──►  Azure AI Foundry
   VITE_LIZZ_LLM_ENABLED=true            (holds the key)     (chat completions)
```

1. **Proxy** — a tiny endpoint that holds the secret and forwards to Foundry. Two
   easy options:
   - **Vite dev middleware** in `vite.config.ts` (simplest for `npm run dev`), or
   - a small **Node/Express** server in `server/` for a production-like setup.
   Read config from env: `FOUNDRY_ENDPOINT`, `FOUNDRY_DEPLOYMENT`,
   `FOUNDRY_API_VERSION`, `FOUNDRY_API_KEY` (see `.env.example`).
2. **Client** — when `VITE_LIZZ_LLM_ENABLED === "true"`, Lizz calls `/api/lizz`
   instead of running the static script. Otherwise it uses the **static fallback**
   (so the demo always works, even with no key / offline).
3. **Prompting** — ground the model with the 3 questions and their option labels from
   the active-language `content` bundle, and instruct it to: (a) reply in the user's
   language, (b) keep a warm Menzis tone, (c) for each of the 3 topics emit the chosen
   `waarde` (1–4) in a structured field (e.g. function/tool call or a JSON block) that
   the client maps into `antwoorden`. Always render the niveau-4 **vangnet** (112) block.

### Setup steps

```bash
npm install
cp .env.example .env          # then fill in the Foundry values
# implement the proxy + client branch, then:
VITE_LIZZ_LLM_ENABLED=true npm run dev
```

### Guardrails / acceptance

- `npm run test` stays green; add tests for the reply→`waarde` mapping.
- Never commit `.env` or any key (`.gitignore` already blocks `.env*`).
- LLM output is **never** trusted for the triage decision — only for the conversation
  and answer elicitation; `evalueer()` remains the source of truth.
- Keep the static flow working as the no-key fallback.

## Useful entry points

| What | Where |
|------|-------|
| Conversational UI (plug LLM in here) | `src/pages/LizzPage.tsx`, `src/components/lizz/*` |
| Authoritative engine (do not bypass) | `src/engine/triage.ts`, `src/engine/types.ts` |
| Decision tree (canonical numeric data) | `src/data/beslisboom.json` |
| Per-language display copy | `src/data/content/{nl,en,tr,ar}.json` + `index.ts` |
| Language detection / RTL | `src/i18n/taal.ts` |
| Shared state + signal store | `src/context/CheckinContext.tsx` (`useCheckin`) |
| Env template | `.env.example` |

Questions about intent live in the README and inline comments. Good luck! 🚀
