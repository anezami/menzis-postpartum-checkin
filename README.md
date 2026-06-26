# Menzis Postpartum Welzijn Check-in

> ⚠️ **DEMONSTRATOR — GEEN MEDISCH HULPMIDDEL**
> Dit project bevat uitsluitend **fictieve gegevens** en dient als technische demonstratie van een data-driven triage-flow. Het is **geen medisch hulpmiddel, geen medisch advies** en niet bedoeld voor klinisch gebruik.

## Over dit project

Een mobiel-first React-applicatie die nieuwe moeders begeleidt door een korte mentale welzijns check-in na de bevalling (postpartum). De engine is volledig data-driven: vragen, antwoorden en uitkomsten komen uit JSON-bestanden; de UI verwerkt deze generiek zonder kennis van de inhoud.

## Lizz — conversational mode

Lizz is the primary demo experience: an interactive, chat-style guide that walks the user through the **same 3-question decision tree** as the classic flow, but in a friendly conversational format.

**Default deeplink (opens Lizz):**

```
/lizz?token=demo123&moment=inschrijving
```

Other demo deeplinks:

- `/lizz?token=demo123&moment=inschrijving` — Sanne (3 weken postpartum)
- `/lizz?token=demo456&moment=6_maanden` — Fatima (6 maanden postpartum)
- `/lizz?token=demo789&moment=12_maanden` — Lotte (12 maanden postpartum)

### Features

- **Chat transcript**: Lizz's messages appear on one side (with a "L" avatar), user's chosen answers echoed on the other.
- **Option chips**: 4 tappable buttons per question (WCAG AA, min 48px, visible focus ring).
- **Free-text input**: text box — in LLM mode, classified by the active model; in static mode, matched by keyword substring. Falls back to chips if uncertain.
- **Back navigation**: "Vorige / Previous" link to change the last answer; tracks exact message boundaries so undo is always correct.
- **Result delivery**: Lizz presents the outcome conversationally using the triage color card, then offers "Opnieuw / Start again" and "Naar dashboard / Go to dashboard" chips.
- **Safety net**: For niveau 4 (rood), the vangnet block is always shown in a calm, non-alarming style.
- **Same engine, same scoring**: uses `evalueer(getBeslisboom(), antwoorden)` — identical results to the classic flow. `registreerSignaal` is called exactly once.
- **LLM mode (default)**: powered by **Azure AI Foundry** (`gpt-5.4-mini`) via a server-side Vite proxy — credentials never reach the browser. Falls back silently to static flow on any failure.
- **Talking avatar + voice input**: Azure AI Speech TTS Avatar (Lizz/lisa, casual-sitting) speaks each question aloud; a microphone button lets the user reply by voice (STT). Both degrade gracefully to text-only when the Speech resource is unavailable.

### Voice: talking avatar + speech-to-text

Lizz can speak via the **Azure AI Speech TTS Avatar** and listen via **Speech-to-Text**, both backed by the same `foundrytestjes` Cognitive Services resource (keyless Entra auth).

```bash
az login    # one-time — DefaultAzureCredential picks this up
npm run dev
```

The dev proxy (`GET /api/lizz/avatar-token`) mints an `aad#<resourceId>#<aadToken>` auth value and fetches an ICE relay token from the Speech relay service. Both are returned to the client as `{ authToken, region, iceServers }` — the raw AAD token is never logged or stored.

| Module | Purpose |
|---|---|
| `src/speech/speechConfig.ts` | Pure constants + locale/voice maps (unit-testable, no SDK) |
| `src/speech/speechToken.ts` | Shared `getSpeechToken()` helper — calls `/api/lizz/avatar-token` |
| `src/speech/avatarClient.ts` | `startAvatarSession()` — WebRTC + AvatarSynthesizer; `speak(text,voice)` via SSML |
| `src/speech/speechToText.ts` | `recognizeOnce(locale)` — SpeechRecognizer + mic; `sttAvailable()` guard |

Voice degrades gracefully: if `/api/lizz/avatar-token` returns 503, the avatar hides and the user types as usual.

### Zero-config quick start (Foundry, default)

```bash
az login          # authenticate once — DefaultAzureCredential picks this up
npm run dev
```

Open: [http://localhost:5173/lizz?token=demo123&moment=inschrijving](http://localhost:5173/lizz?token=demo123&moment=inschrijving)

Lizz uses **Azure AI Foundry** (`gpt-5.4-mini`) automatically. The local Node proxy acquires an Entra ID token via `DefaultAzureCredential` (scope `https://ai.azure.com/.default`) — nothing is stored or committed.

### Switching to GitHub Models

```bash
cp .env.example .env
# Edit .env and uncomment:
#   LLM_PROVIDER=github
#   GITHUB_TOKEN=<gh auth token output>
npm run dev
```

### Disabling LLM (static flow only)

```bash
cp .env.example .env
# Uncomment: VITE_LIZZ_LLM_ENABLED=false
npm run dev
```

See `HANDOFF.md` and `.env.example` for full details.

### Supported languages + auto-detect

| Code | Endonym    | Direction |
|------|------------|-----------|
| `nl` | Nederlands | LTR       |
| `en` | English    | LTR       |
| `tr` | Türkçe     | LTR       |
| `ar` | العربية    | **RTL**   |

The active language is **auto-detected from the browser** (`navigator.languages`) on first visit and **persisted to `localStorage`**. The user can switch language at any time via the globe (🌐) dropdown in the Lizz header — all copy, questions and options re-render immediately in the new language. Stored numeric answers are language-agnostic, so switching mid-conversation keeps scoring intact.

**RTL for Arabic**: when Arabic is selected the chat container gets `dir="rtl"`, Lizz bubbles align to the right (start side), user bubbles to the left (end side), and chip groups and action buttons mirror accordingly using CSS logical properties.

### Classic / Lizz toggle

A subtle "Klassieke versie / Classic version" link in the Lizz header switches to the classic `/start` flow. A "Lizz ✨" link in the classic header switches back to Lizz — both carry the current token and moment so the demo context is preserved.

---

## Snel starten

```bash
npm install && npm run dev
```

Open: [http://localhost:5173/lizz?token=demo123&moment=inschrijving](http://localhost:5173/lizz?token=demo123&moment=inschrijving)

## Classic flow deeplinks

- `/start?token=demo123&moment=inschrijving` — Sanne (3 weken postpartum)
- `/start?token=demo456&moment=6_maanden` — Fatima (6 maanden postpartum)
- `/start?token=demo789&moment=12_maanden` — Lotte (12 maanden postpartum)

## De flow

**Deeplink → Welkom → 3 vragen → Uitkomst → Dashboard**

1. `/start?token=…&moment=…` — Laadt het profiel via de token, initialiseert de sessie en verwijst door.
2. `/welkom` — Persoonlijke begroeting, introductietekst en verplichte demo-toestemmingsverklaring.
3. `/vraag/0–2` — Één vraag per scherm, voortgangsbalk, grote radio-opties, voor/achteruit navigatie.
4. `/uitkomst` — Triage-uitkomst via `evalueer()`, kleurgecodeerde kaart, veiligheidsboodschap bij niveau 4. Signaal eenmalig opgeslagen in in-memory store.
5. `/dashboard` — Overzicht van alle geregistreerde signalen in de huidige sessie.

De engine (`src/engine/triage.ts`) bepaalt het niveau via de `max`-strategie en zoekt de overeenkomstige uitkomst op in de beslisboom. De UI heeft geen triage-logica.

## Demo testscenario's

| Scenario | Antwoorden | Niveau | Kleur | Signaal |
|---|---|---|---|---|
| Alles goed | Alle 3 vragen waarde `1` | 1 | 🟢 Groen | `geen_signaal` |
| Hoge nood | Minimaal één antwoord `4` | 4 | 🔴 Rood | `professional_contact` + veiligheidsboodschap |
| Lichte zorg | Hoogste antwoord `3` | 3 | 🟠 Oranje | `digitale_zelfzorg` |

## Menzis kleur-tokens

| Token | Hex | Gebruik |
|---|---|---|
| `menzis.geel` | `#FEC352` | Primary buttons, progress bar, focus ring |
| `menzis.inkt` | `#161513` | Tekst, header achtergrond |
| `menzis.wit` | `#FFFFFF` | Kaartachtergronden |
| `menzis.zacht` | `#FFF7E8` | Pagina-achtergrond, zachte kaarten |
| `triage.groen` | `#2E7D32` | Niveau 1 |
| `triage.geel` | `#F2A900` | Niveau 2 |
| `triage.oranje` | `#E8730C` | Niveau 3 |
| `triage.rood` | `#C62828` | Niveau 4 |

## Bouwen & testen

```bash
npm run build   # TypeScript + Vite productie-build
npm run test    # Vitest unit tests
npm run lint    # Oxlint
```

---

_Originele Vite README:_

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
