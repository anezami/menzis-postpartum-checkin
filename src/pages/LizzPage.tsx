import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useCheckin } from '../context/CheckinContext'
import { getContent, uitkomstTekst, vraagTekst, optieLabel } from '../data/content'
import { isRtl } from '../i18n/taal'
import { getProfiel, getBeslisboom } from '../data/profielen'
import { evalueer } from '../engine/triage'
import { getKleur } from '../components/triageKleur'
import type { Antwoorden } from '../engine/types'
import LizzAvatar from '../components/lizz/LizzAvatar'
import ChatBubble from '../components/lizz/ChatBubble'
import TypingIndicator from '../components/lizz/TypingIndicator'
import OptionChips from '../components/lizz/OptionChips'
import LanguageSwitcher from '../components/lizz/LanguageSwitcher'
import { vraagBeurt, classificeerAntwoord } from '../llm/lizzConversation'
import { startAvatarSession, type AvatarSession } from '../speech/avatarClient'
import { ttsVoice, sttLocale } from '../speech/speechConfig'
import { sttAvailable, recognizeOnce } from '../speech/speechToText'

// ---------------------------------------------------------------------------
// Message type system — text is resolved at render time from current content
// ---------------------------------------------------------------------------

type LizzMsgKind =
  | { tag: 'begroeting'; naam: string }
  | { tag: 'intro' }
  | { tag: 'toestemming-prompt' }
  | { tag: 'vraag'; vraagIndex: number }
  | { tag: 'llm-vraag'; vraagIndex: number; text: string }
  | { tag: 'tussenzin'; zinIndex: number }
  | { tag: 'llm-erkenning'; text: string }
  | { tag: 'user-antwoord'; vraagIndex: number; waarde: number }
  | { tag: 'uitkomst'; niveau: number; kleur: string }
  | { tag: 'vangnet' }
  | { tag: 'afsluiting' }
  | { tag: 'niet-begrepen' }
  | { tag: 'offline-note' }

type LizzMsg = {
  id: string
  from: 'lizz' | 'user'
  kind: LizzMsgKind
}

type Phase = 'loading' | 'consent' | 'vraag' | 'typing' | 'uitkomst'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LizzPage() {
  const [params] = useSearchParams()
  const { taal, setTaal, antwoorden, setAntwoord, startSessie, registreerSignaal, reset } =
    useCheckin()

  const tokenParam = params.get('token') ?? ''
  const momentParam = params.get('moment') ?? ''
  const profielParam = tokenParam ? getProfiel(tokenParam) : undefined
  const showFallback = !profielParam || !tokenParam || !momentParam

  const c = getContent(taal)
  const rtl = isRtl(taal)
  const boom = getBeslisboom()

  // LLM mode: ON by default (Foundry via az login, no .env needed).
  // Set VITE_LIZZ_LLM_ENABLED=false in .env to force the static chip flow.
  const llmEnabled = import.meta.env.VITE_LIZZ_LLM_ENABLED !== 'false'

  const [messages, setMessages] = useState<LizzMsg[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [vraagIndex, setVraagIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [zinIndex, setZinIndex] = useState(0)
  const [textInput, setTextInput] = useState('')

  const signaalRegistreerd = useRef(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  // Tracks the messages.length right before each user-antwoord was added.
  // handleVorige uses this to remove the exact right messages regardless of
  // how many intermediate messages (niet-begrepen, llm-erkenning, etc.) exist.
  const answerMsgStart = useRef<number[]>([])
  // Ref so async callbacks always see the live fallback state without stale closure issues.
  const llmFallbackActivated = useRef(false)

  // ─── Voice / avatar refs and state ─────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const avatarSessionRef = useRef<AvatarSession | null>(null)
  /** Set of message ids already dispatched to the avatar for TTS — reset on opnieuw */
  const spokenMsgIds = useRef<Set<string>>(new Set())
  const speakChain = useRef<Promise<void>>(Promise.resolve())

  const [avatarUnavailable, setAvatarUnavailable] = useState(false)
  const [speakerEnabled, setSpeakerEnabled] = useState(true)
  const [avatarCollapsed, setAvatarCollapsed] = useState(false)
  const [videoActive, setVideoActive] = useState(false)
  const [listening, setListening] = useState(false)

  // Scroll to bottom on new messages or typing indicator
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Avatar session — initialise once on mount when a real profile is available.
  // If the SDK / proxy is unreachable we set avatarUnavailable and the chat continues normally.
  useEffect(() => {
    if (showFallback) return
    if (!videoRef.current || !audioRef.current) return

    let cancelled = false
    startAvatarSession({
      videoEl: videoRef.current,
      audioEl: audioRef.current,
      voice: ttsVoice(taal),
    })
      .then((session) => {
        if (!cancelled) avatarSessionRef.current = session
      })
      .catch(() => {
        if (!cancelled) setAvatarUnavailable(true)
      })

    return () => {
      cancelled = true
      // Unmount: stop the session if it was started
      avatarSessionRef.current?.stop().catch(() => {})
      avatarSessionRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run once on mount — profile / taal won't change after initial load

  // Speak every new Lizz message through the avatar.
  // Advances spokenMsgIds regardless of speakerEnabled so toggling on never replays history.
  useEffect(() => {
    const session = avatarSessionRef.current
    if (!session || avatarUnavailable) return

    const unspoken = messages.filter(
      (m) => m.from === 'lizz' && !spokenMsgIds.current.has(m.id),
    )
    if (unspoken.length === 0) return

    // Advance pointer unconditionally
    for (const m of unspoken) spokenMsgIds.current.add(m.id)

    if (!speakerEnabled) return

    const voice = ttsVoice(taal)
    const toSpeak = unspoken
    speakChain.current = speakChain.current.then(async () => {
      for (const msg of toSpeak) {
        const text = spokenText(msg)
        if (!text) continue
        try {
          await session.speak(text, voice)
        } catch {
          setAvatarUnavailable(true)
          return
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]) // speakerEnabled intentionally read via closure — no history replay on toggle

  // Stagger the opening chat messages and drive phase to 'consent'.
  // Called on mount and by handleOpnieuw so both paths share identical behaviour.
  function startGesprek() {
    if (showFallback) return

    const profiel = profielParam!
    startSessie(tokenParam, momentParam, profiel)

    setTimeout(() => {
      setMessages([{ id: 'msg-begroeting', from: 'lizz', kind: { tag: 'begroeting', naam: profiel.naam } }])
    }, 300)
    setTimeout(() => {
      setMessages((prev) => [...prev, { id: 'msg-intro', from: 'lizz', kind: { tag: 'intro' } }])
    }, 1100)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: 'msg-toestemming', from: 'lizz', kind: { tag: 'toestemming-prompt' } },
      ])
      setPhase('consent')
    }, 2000)
  }

  // Init: call startSessie and stagger the opening chat messages (runs once on mount)
  useEffect(() => {
    startGesprek()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount — token/moment come from URL and won't change

  // ---------------------------------------------------------------------------
  // LLM fallback activator — shows an "offline modus" note once, then falls back
  // ---------------------------------------------------------------------------

  function activateLlmFallback() {
    if (!llmFallbackActivated.current) {
      llmFallbackActivated.current = true
      setMessages((prev) => [
        ...prev,
        { id: 'msg-offline-note', from: 'lizz', kind: { tag: 'offline-note' } },
      ])
    }
  }

  // ---------------------------------------------------------------------------
  // Core answer handler — used by both chip and LLM text paths
  // ---------------------------------------------------------------------------

  function submitAntwoord(waarde: number, erkenning?: string) {
    const currentVraagIndex = vraagIndex
    const currentZinIndex = zinIndex
    const vraag = boom.vragen[currentVraagIndex]

    // Record the message boundary before the user-antwoord is inserted.
    // handleVorige slices back to this index for precise undo.
    setMessages((prev) => {
      answerMsgStart.current[currentVraagIndex] = prev.length
      return [
        ...prev,
        {
          id: `msg-user-${currentVraagIndex}`,
          from: 'user',
          kind: { tag: 'user-antwoord', vraagIndex: currentVraagIndex, waarde },
        },
      ]
    })

    setAntwoord(vraag.id, waarde)
    setIsTyping(true)
    setPhase('typing')

    const delay = 650 + Math.random() * 300

    setTimeout(() => {
      setZinIndex((prev) => prev + 1)
      setIsTyping(false)

      const ackMsg: LizzMsg = erkenning
        ? {
            id: `msg-llm-erk-${currentVraagIndex}`,
            from: 'lizz',
            kind: { tag: 'llm-erkenning', text: erkenning },
          }
        : {
            id: `msg-tussenzin-${currentVraagIndex}`,
            from: 'lizz',
            kind: { tag: 'tussenzin', zinIndex: currentZinIndex % 3 },
          }

      if (currentVraagIndex < boom.vragen.length - 1) {
        const nextIdx = currentVraagIndex + 1

        if (llmEnabled && !llmFallbackActivated.current) {
          // LLM mode: fetch conversational phrasing for the next question
          setMessages((prev) => [...prev, ackMsg])
          setIsTyping(true)

          vraagBeurt({
            vraag: boom.vragen[nextIdx],
            vraagIndex: nextIdx,
            totaal: boom.vragen.length,
            naam: profielParam!.naam,
            taal,
            c,
          })
            .then((text) => {
              setIsTyping(false)
              setMessages((prev) => [
                ...prev,
                {
                  id: `msg-llm-vraag-${nextIdx}`,
                  from: 'lizz',
                  kind: { tag: 'llm-vraag', vraagIndex: nextIdx, text },
                },
              ])
              setVraagIndex(nextIdx)
              setPhase('vraag')
            })
            .catch(() => {
              activateLlmFallback()
              setIsTyping(false)
              setMessages((prev) => [
                ...prev,
                {
                  id: `msg-vraag-${nextIdx}`,
                  from: 'lizz',
                  kind: { tag: 'vraag', vraagIndex: nextIdx },
                },
              ])
              setVraagIndex(nextIdx)
              setPhase('vraag')
            })
        } else {
          // Static path
          setMessages((prev) => [
            ...prev,
            ackMsg,
            { id: `msg-vraag-${nextIdx}`, from: 'lizz', kind: { tag: 'vraag', vraagIndex: nextIdx } },
          ])
          setVraagIndex(nextIdx)
          setPhase('vraag')
        }
      } else {
        // All questions answered — compute uitkomst with the existing engine
        // antwoorden in context may not yet include this last answer (async React state),
        // so we manually merge it for the evaluation
        const alleAntwoorden: Antwoorden = { ...antwoorden, [vraag.id]: waarde }
        const uitkomst = evalueer(boom, alleAntwoorden)

        if (!signaalRegistreerd.current && profielParam && momentParam) {
          registreerSignaal(uitkomst, profielParam, momentParam)
          signaalRegistreerd.current = true
        }

        const endMessages: LizzMsg[] = [
          ackMsg,
          {
            id: 'msg-uitkomst',
            from: 'lizz',
            kind: { tag: 'uitkomst', niveau: uitkomst.niveau, kleur: uitkomst.kleur },
          },
        ]
        if (uitkomst.niveau === 4) {
          endMessages.push({ id: 'msg-vangnet', from: 'lizz', kind: { tag: 'vangnet' } })
        }
        endMessages.push({ id: 'msg-afsluiting', from: 'lizz', kind: { tag: 'afsluiting' } })

        setMessages((prev) => [...prev, ...endMessages])
        setPhase('uitkomst')
      }
    }, delay)
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleConsent() {
    if (llmEnabled && !llmFallbackActivated.current) {
      // LLM mode: fetch conversational phrasing for vraag 0
      setIsTyping(true)
      setPhase('typing')

      vraagBeurt({
        vraag: boom.vragen[0],
        vraagIndex: 0,
        totaal: boom.vragen.length,
        naam: profielParam!.naam,
        taal,
        c,
      })
        .then((text) => {
          setIsTyping(false)
          setMessages((prev) => [
            ...prev,
            { id: 'msg-llm-vraag-0', from: 'lizz', kind: { tag: 'llm-vraag', vraagIndex: 0, text } },
          ])
          setVraagIndex(0)
          setPhase('vraag')
        })
        .catch(() => {
          activateLlmFallback()
          setIsTyping(false)
          setMessages((prev) => [
            ...prev,
            { id: 'msg-vraag-0', from: 'lizz', kind: { tag: 'vraag', vraagIndex: 0 } },
          ])
          setVraagIndex(0)
          setPhase('vraag')
        })
    } else {
      // Static path
      setMessages((prev) => [
        ...prev,
        { id: 'msg-vraag-0', from: 'lizz', kind: { tag: 'vraag', vraagIndex: 0 } },
      ])
      setPhase('vraag')
      setVraagIndex(0)
    }
  }

  function handleAntwoord(waarde: number) {
    if (phase !== 'vraag') return
    submitAntwoord(waarde)
  }

  // Go back one question: remove all messages from when the previous answer was submitted,
  // so the previous question bubble remains visible and the user can re-answer.
  function handleVorige() {
    if (vraagIndex === 0 || phase !== 'vraag') return
    const cutPoint = answerMsgStart.current[vraagIndex - 1] ?? 0
    setMessages((prev) => prev.slice(0, cutPoint))
    setVraagIndex((prev) => prev - 1)
    setPhase('vraag')
  }

  // Shared submit path — used by both typed text and STT voice input.
  // ALL user answers (chip, typed, spoken) flow through submitAntwoord via this function.
  function submitUserText(text: string) {
    if ((phase !== 'vraag' && phase !== 'typing') || !text.trim()) return
    const trimmed = text.trim()

    if (llmEnabled && !llmFallbackActivated.current) {
      // LLM path: classify free text into a waarde
      setIsTyping(true)
      setPhase('typing')

      classificeerAntwoord({
        userText: trimmed,
        vraag: boom.vragen[vraagIndex],
        taal,
        c,
      })
        .then((result) => {
          setIsTyping(false)
          if (result.onzeker) {
            // Show a "didn't understand" message and keep chips
            setMessages((prev) => [
              ...prev,
              { id: `msg-niet-begrepen-${Date.now()}`, from: 'lizz', kind: { tag: 'niet-begrepen' } },
            ])
            setPhase('vraag')
          } else {
            // Confident classification — echo it and advance
            submitAntwoord(result.waarde, result.erkenning)
          }
        })
        .catch(() => {
          activateLlmFallback()
          setIsTyping(false)
          setPhase('vraag')
          // Fall through to static substring matching
          handleTextMatchStatic(trimmed)
        })
    } else {
      handleTextMatchStatic(trimmed)
    }
  }

  // Free-text input handler
  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = textInput.trim()
    if (!trimmed) return
    setTextInput('')
    submitUserText(trimmed)
  }

  function handleTextMatchStatic(text: string) {
    const normalized = text.toLowerCase()
    const vraag = boom.vragen[vraagIndex]
    let matchedWaarde: number | null = null

    for (const optie of vraag.opties) {
      const label = optieLabel(c, vraag.id, optie.waarde).toLowerCase()
      const firstWord = label.split(/\s/)[0]
      if (
        label.includes(normalized) ||
        normalized.includes(label) ||
        (firstWord.length >= 3 && normalized.startsWith(firstWord))
      ) {
        matchedWaarde = optie.waarde
        break
      }
    }

    if (matchedWaarde !== null) {
      submitAntwoord(matchedWaarde)
    } else {
      setMessages((prev) => [
        ...prev,
        { id: `msg-niet-begrepen-${Date.now()}`, from: 'lizz', kind: { tag: 'niet-begrepen' } },
      ])
    }
  }

  // Microphone / STT handler — result routed through submitUserText (same engine path as typing)
  function handleMicClick() {
    if (!sttAvailable() || listening || phase === 'typing') return
    setListening(true)
    void recognizeOnce(sttLocale(taal))
      .then((text) => {
        setListening(false)
        if (text.trim()) submitUserText(text.trim())
      })
      .catch(() => {
        setListening(false)
      })
  }

  // Reset and start fresh (preserves current token/moment — no navigation needed)
  function handleOpnieuw() {
    reset()
    signaalRegistreerd.current = false
    answerMsgStart.current = []
    llmFallbackActivated.current = false
    spokenMsgIds.current = new Set() // reset spoken pointer so new greeting is spoken
    speakChain.current = Promise.resolve()
    setMessages([])
    setVraagIndex(0)
    setZinIndex(0)
    setTextInput('')
    startGesprek()
  }

  // ---------------------------------------------------------------------------
  // Plain-text resolver for TTS — mirrors renderMsgContent but returns strings.
  // Returns null for messages that should not be spoken (user bubbles, offline note).
  // ---------------------------------------------------------------------------

  function spokenText(msg: LizzMsg): string | null {
    const { kind } = msg
    switch (kind.tag) {
      case 'begroeting':
        return c.lizz.begroeting.replace('{naam}', kind.naam)
      case 'intro':
        return c.lizz.intro
      case 'toestemming-prompt':
        return c.lizz.toestemming
      case 'vraag':
        // Spoken text = question only, no "Vraag 1 van 3" prefix
        return vraagTekst(c, boom.vragen[kind.vraagIndex].id)
      case 'llm-vraag':
        return kind.text
      case 'tussenzin':
        return c.lizz.tussenzinnen[kind.zinIndex % 3]
      case 'llm-erkenning':
        return kind.text
      case 'uitkomst': {
        const uc = uitkomstTekst(c, kind.niveau)
        return `${uc.titel}. ${uc.lizzBoodschap} ${uc.advies}`
      }
      case 'vangnet':
        return c.vangnet
      case 'afsluiting':
        return c.lizz.afsluiting
      case 'niet-begrepen':
        return c.lizz.nietBegrepen
      case 'user-antwoord':
        return null
      case 'offline-note':
        return null
      default:
        return null
    }
  }

  // ---------------------------------------------------------------------------
  // Render message content (text resolved from current content bundle)
  // ---------------------------------------------------------------------------

  function renderMsgContent(msg: LizzMsg): React.ReactNode {
    const { kind } = msg

    switch (kind.tag) {
      case 'begroeting':
        return c.lizz.begroeting.replace('{naam}', kind.naam)

      case 'intro':
        return c.lizz.intro

      case 'toestemming-prompt':
        return c.lizz.toestemming

      case 'vraag': {
        const v = boom.vragen[kind.vraagIndex]
        return (
          <div>
            <p className="mb-1 text-xs text-menzis-inkt/50 font-medium">
              {c.lizz.voortgang
                .replace('{huidig}', String(kind.vraagIndex + 1))
                .replace('{totaal}', String(boom.vragen.length))}
            </p>
            <p>{vraagTekst(c, v.id)}</p>
          </div>
        )
      }

      case 'llm-vraag': {
        return (
          <div>
            <p className="mb-1 text-xs text-menzis-inkt/50 font-medium">
              {c.lizz.voortgang
                .replace('{huidig}', String(kind.vraagIndex + 1))
                .replace('{totaal}', String(boom.vragen.length))}
            </p>
            <p>{kind.text}</p>
          </div>
        )
      }

      case 'tussenzin':
        return c.lizz.tussenzinnen[kind.zinIndex % 3]

      case 'llm-erkenning':
        return kind.text

      case 'user-antwoord': {
        const v = boom.vragen[kind.vraagIndex]
        return optieLabel(c, v.id, kind.waarde)
      }

      case 'uitkomst': {
        const uc = uitkomstTekst(c, kind.niveau)
        const kleurConfig = getKleur(kind.kleur)
        return (
          <div className={`rounded-2xl p-4 border-l-4 ${kleurConfig.borderColor} ${kleurConfig.bgLight}`}>
            <p className="font-bold text-menzis-inkt mb-2">
              {kleurConfig.emoji} {uc.titel}
            </p>
            <p className="text-base text-menzis-inkt/90 leading-relaxed mb-3">{uc.lizzBoodschap}</p>
            <p className="text-sm text-menzis-inkt/70 italic">{uc.advies}</p>
          </div>
        )
      }

      case 'vangnet':
        return (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-triage-rood/5 border border-triage-rood/20">
            <span className="text-xl flex-shrink-0" aria-hidden="true">🛟</span>
            <p className="text-sm leading-relaxed text-menzis-inkt">{c.vangnet}</p>
          </div>
        )

      case 'afsluiting':
        return c.lizz.afsluiting

      case 'niet-begrepen':
        return c.lizz.nietBegrepen

      case 'offline-note':
        return (
          <span className="text-xs text-menzis-inkt/40 italic">offline modus</span>
        )

      default:
        return null
    }
  }

  // ---------------------------------------------------------------------------
  // Fallback when token is unknown
  // ---------------------------------------------------------------------------

  if (showFallback) {
    return (
      <div className="min-h-screen bg-menzis-zacht" dir={rtl ? 'rtl' : 'ltr'}>
        <header className="bg-menzis-inkt py-4 px-6 flex items-center justify-between shadow-sm">
          <Link
            to="/"
            className="text-menzis-wit font-bold text-xl tracking-tight rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-menzis-geel"
            aria-label="Menzis — terug naar start"
          >
            Menzis
          </Link>
          <LanguageSwitcher taal={taal} onSetTaal={setTaal} c={c} />
        </header>

        <main className="max-w-md mx-auto px-4 py-10">
          <div className="bg-white rounded-3xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-5">
              <LizzAvatar size="lg" />
              <p className="font-bold text-menzis-inkt text-lg">{c.lizz.naamLabel}</p>
            </div>
            <p className="text-menzis-inkt/80 mb-6 leading-relaxed">{c.lizz.onbekendToken}</p>
            <div className="flex flex-col gap-3">
              {[
                { token: 'demo123', moment: 'inschrijving', naam: 'Sanne' },
                { token: 'demo456', moment: '6_maanden', naam: 'Fatima' },
                { token: 'demo789', moment: '12_maanden', naam: 'Lotte' },
              ].map(({ token: t, moment: m, naam }) => (
                <Link
                  key={t}
                  to={`/lizz?token=${t}&moment=${m}`}
                  className="min-h-[48px] flex items-center px-5 py-3 rounded-2xl bg-menzis-zacht border-2 border-menzis-geel text-menzis-inkt font-semibold hover:bg-menzis-geel/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-menzis-geel"
                >
                  👤 {naam}
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main chat UI
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-menzis-zacht flex flex-col" dir={rtl ? 'rtl' : 'ltr'}>
      {/* Sticky header */}
      <header className="bg-menzis-inkt py-3 px-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="text-menzis-wit font-bold text-lg tracking-tight rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-menzis-geel"
            aria-label="Menzis — terug naar start"
          >
            Menzis
          </Link>
          <span className="text-menzis-geel font-semibold text-sm" aria-label={c.lizz.naamLabel}>
            {c.lizz.naamLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher taal={taal} onSetTaal={setTaal} c={c} />
          <Link
            to={`/start?token=${tokenParam}&moment=${momentParam}`}
            className="text-xs text-menzis-wit/60 hover:text-menzis-wit transition-colors rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-menzis-geel px-2 py-1 whitespace-nowrap"
          >
            {c.lizz.klassiekToggle}
          </Link>
        </div>
      </header>

        {/* Avatar video panel — visible when SDK is available */}
        {!avatarUnavailable && (
          <section aria-label={c.lizz.naamLabel} className="max-w-lg mx-auto w-full px-4 pt-3">
            <div className="rounded-3xl shadow-md overflow-hidden bg-white">
              {/* Panel controls: collapse toggle + speaker toggle */}
              <div className="flex items-center justify-between px-4 py-2">
                <button
                  type="button"
                  onClick={() => setAvatarCollapsed((v) => !v)}
                  aria-expanded={!avatarCollapsed}
                  aria-controls="avatar-video-panel"
                  className="text-sm font-semibold text-menzis-inkt/60 hover:text-menzis-inkt flex items-center gap-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-menzis-geel rounded px-1 py-1"
                >
                  <span>{c.lizz.naamLabel}</span>
                  <span aria-hidden="true">{avatarCollapsed ? '▾' : '▴'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSpeakerEnabled((v) => !v)}
                  aria-label={speakerEnabled ? c.lizz.avatarUitLabel : c.lizz.avatarAanLabel}
                  aria-pressed={speakerEnabled}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-menzis-zacht transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-menzis-geel text-xl"
                >
                  {speakerEnabled ? '🔊' : '🔇'}
                </button>
              </div>

              {/* Video area — height collapses to 0 when toggled, element stays in DOM */}
              <div
                id="avatar-video-panel"
                className={`relative bg-menzis-zacht overflow-hidden transition-all duration-300 ${avatarCollapsed ? 'h-0' : 'aspect-video'}`}
              >
                {/* Placeholder shown until video stream becomes active */}
                <div
                  className={`absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none transition-opacity ${videoActive ? 'opacity-0' : 'opacity-100'}`}
                >
                  <LizzAvatar size="lg" />
                  <span className="text-menzis-inkt/60 text-sm font-medium">{c.lizz.naamLabel}</span>
                </div>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  autoPlay
                  playsInline
                  onPlay={() => setVideoActive(true)}
                  onPause={() => setVideoActive(false)}
                  aria-hidden="true"
                />
              </div>
            </div>
          </section>
        )}

        {/* Hidden audio element for avatar TTS — always in DOM so the ref is valid on mount */}
        <audio ref={audioRef} autoPlay className="sr-only" aria-hidden="true" />

        {/* Aria-live region announces STT listening state to screen readers */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {listening ? c.lizz.luistert : ''}
        </div>

        {/* Chat transcript */}
      <main
        className="flex-1 overflow-y-auto px-4 py-6 max-w-lg mx-auto w-full"
        aria-live="polite"
        aria-label={c.lizz.naamLabel}
      >
        <div className="flex flex-col gap-4">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} from={msg.from} rtl={rtl}>
              {renderMsgContent(msg)}
            </ChatBubble>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className={`flex items-start gap-3 ${rtl ? 'flex-row-reverse' : ''}`}>
              <LizzAvatar />
              <TypingIndicator label={c.lizz.denkt} />
            </div>
          )}

          {/* Consent chip — only shown during consent phase */}
          {phase === 'consent' && (
            <div className={`flex ${rtl ? 'justify-end' : 'justify-start'}`}>
              <button
                type="button"
                onClick={handleConsent}
                className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-menzis-geel text-menzis-inkt font-semibold text-base hover:brightness-105 active:brightness-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-menzis-geel shadow-sm"
              >
                {c.lizz.startKnop}
              </button>
            </div>
          )}

          {/* Answer chips — only shown for the active question */}
          {phase === 'vraag' && (
            <div>
              <OptionChips
                vraagIndex={vraagIndex}
                boom={boom}
                c={c}
                rtl={rtl}
                onKies={handleAntwoord}
              />

              {/* Subtle back link */}
              {vraagIndex > 0 && (
                <div className={`mt-3 flex ${rtl ? 'justify-end' : 'justify-start'}`}>
                  <button
                    type="button"
                    onClick={handleVorige}
                    className="text-sm text-menzis-inkt/50 hover:text-menzis-inkt underline transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-menzis-geel rounded px-2 py-1"
                  >
                    {rtl ? '→' : '←'} {c.lizz.vorige}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Uitkomst action chips */}
          {phase === 'uitkomst' && (
            <div className={`flex flex-wrap gap-3 mt-2 ${rtl ? 'justify-end' : 'justify-start'}`}>
              <button
                type="button"
                onClick={handleOpnieuw}
                className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-transparent border-2 border-menzis-inkt/30 text-menzis-inkt font-semibold text-base hover:bg-menzis-zacht transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-menzis-geel"
              >
                {c.lizz.opnieuw}
              </button>
              <Link
                to="/dashboard"
                className="min-h-[48px] px-5 py-2.5 rounded-2xl bg-menzis-geel text-menzis-inkt font-semibold text-base hover:brightness-105 active:brightness-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-menzis-geel inline-flex items-center shadow-sm"
              >
                {c.lizz.naarDashboard}
              </Link>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={chatEndRef} aria-hidden="true" />
        </div>
      </main>

      {/* Sticky free-text input — only during vraag phase */}
      {phase === 'vraag' && (
        <div className="sticky bottom-0 bg-white border-t border-menzis-inkt/10 px-4 py-3 max-w-lg mx-auto w-full">
          <form
            onSubmit={handleTextSubmit}
            className={`flex gap-2 items-center ${rtl ? 'flex-row-reverse' : ''}`}
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={c.lizz.invoerPlaceholder}
              dir={rtl ? 'rtl' : 'ltr'}
              className="flex-1 min-h-[44px] px-4 py-2 rounded-2xl border-2 border-menzis-inkt/20 bg-menzis-zacht text-menzis-inkt placeholder:text-menzis-inkt/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-menzis-geel text-base"
              aria-label={c.lizz.invoerPlaceholder}
            />
            {/* Microphone button — only shown when browser STT is available */}
            {sttAvailable() && (
              <button
                type="button"
                onClick={handleMicClick}
                disabled={listening}
                aria-label={c.lizz.micLabel}
                aria-pressed={listening}
                className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-menzis-geel disabled:opacity-40 ${
                  listening
                    ? 'bg-menzis-geel text-menzis-inkt animate-pulse'
                    : 'bg-menzis-zacht border-2 border-menzis-inkt/20 text-menzis-inkt hover:bg-menzis-geel/30'
                }`}
              >
                🎤
              </button>
            )}
            <button
              type="submit"
              disabled={!textInput.trim()}
              aria-label={c.lizz.verzend}
              className="min-h-[44px] min-w-[44px] px-4 rounded-2xl bg-menzis-geel text-menzis-inkt font-bold hover:brightness-105 disabled:opacity-40 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-menzis-geel"
            >
              {rtl ? '←' : '→'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}