import { useState, useEffect, useRef } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
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

// ---------------------------------------------------------------------------
// Message type system — text is resolved at render time from current content
// ---------------------------------------------------------------------------

type LizzMsgKind =
  | { tag: 'begroeting'; naam: string }
  | { tag: 'intro' }
  | { tag: 'toestemming-prompt' }
  | { tag: 'vraag'; vraagIndex: number }
  | { tag: 'tussenzin'; zinIndex: number }
  | { tag: 'user-antwoord'; vraagIndex: number; waarde: number }
  | { tag: 'uitkomst'; niveau: number; kleur: string }
  | { tag: 'vangnet' }
  | { tag: 'afsluiting' }
  | { tag: 'niet-begrepen' }

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
  const navigate = useNavigate()
  const { taal, setTaal, antwoorden, setAntwoord, startSessie, registreerSignaal, reset } =
    useCheckin()

  const tokenParam = params.get('token') ?? ''
  const momentParam = params.get('moment') ?? ''
  const profielParam = tokenParam ? getProfiel(tokenParam) : undefined
  const showFallback = !profielParam || !tokenParam || !momentParam

  const c = getContent(taal)
  const rtl = isRtl(taal)
  const boom = getBeslisboom()

  const [messages, setMessages] = useState<LizzMsg[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [vraagIndex, setVraagIndex] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [zinIndex, setZinIndex] = useState(0)
  const [textInput, setTextInput] = useState('')

  const signaalRegistreerd = useRef(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages or typing indicator
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  // Init: call startSessie and stagger the opening chat messages (runs once on mount)
  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount — token/moment come from URL and won't change

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleConsent() {
    setMessages((prev) => [
      ...prev,
      { id: 'msg-vraag-0', from: 'lizz', kind: { tag: 'vraag', vraagIndex: 0 } },
    ])
    setPhase('vraag')
    setVraagIndex(0)
  }

  function handleAntwoord(waarde: number) {
    if (phase !== 'vraag') return

    const vraag = boom.vragen[vraagIndex]
    const currentZinIndex = zinIndex

    // Echo user's choice in the chat
    setMessages((prev) => [
      ...prev,
      { id: `msg-user-${vraagIndex}`, from: 'user', kind: { tag: 'user-antwoord', vraagIndex, waarde } },
    ])

    // Store in context
    setAntwoord(vraag.id, waarde)

    // Show typing indicator
    setIsTyping(true)
    setPhase('typing')

    const delay = 650 + Math.random() * 300

    setTimeout(() => {
      setZinIndex((prev) => prev + 1)
      setIsTyping(false)

      // Add empathetic tussenzin
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-tussenzin-${vraagIndex}`,
          from: 'lizz',
          kind: { tag: 'tussenzin', zinIndex: currentZinIndex % 3 },
        },
      ])

      if (vraagIndex < boom.vragen.length - 1) {
        // Next question
        const nextIdx = vraagIndex + 1
        setMessages((prev) => [
          ...prev,
          { id: `msg-vraag-${nextIdx}`, from: 'lizz', kind: { tag: 'vraag', vraagIndex: nextIdx } },
        ])
        setVraagIndex(nextIdx)
        setPhase('vraag')
      } else {
        // All questions answered — compute uitkomst
        // antwoorden in context may not yet include this last answer (async React state),
        // so we manually merge it for the evaluation
        const alleAntwoorden: Antwoorden = { ...antwoorden, [vraag.id]: waarde }
        const uitkomst = evalueer(boom, alleAntwoorden)

        // Register signal exactly once
        if (!signaalRegistreerd.current && profielParam && momentParam) {
          registreerSignaal(uitkomst, profielParam, momentParam)
          signaalRegistreerd.current = true
        }

        setMessages((prev) => [
          ...prev,
          { id: 'msg-uitkomst', from: 'lizz', kind: { tag: 'uitkomst', niveau: uitkomst.niveau, kleur: uitkomst.kleur } },
        ])

        if (uitkomst.niveau === 4) {
          setMessages((prev) => [
            ...prev,
            { id: 'msg-vangnet', from: 'lizz', kind: { tag: 'vangnet' } },
          ])
        }

        setMessages((prev) => [
          ...prev,
          { id: 'msg-afsluiting', from: 'lizz', kind: { tag: 'afsluiting' } },
        ])

        setPhase('uitkomst')
      }
    }, delay)
  }

  // Go back one question: pop user-echo + tussenzin + current vraag (3 messages)
  function handleVorige() {
    if (vraagIndex === 0 || phase !== 'vraag') return
    setMessages((prev) => prev.slice(0, -3))
    setVraagIndex((prev) => prev - 1)
    setPhase('vraag')
  }

  // Free-text input: try to match typed text to an option via substring matching
  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (phase !== 'vraag' || !textInput.trim()) return

    const normalized = textInput.trim().toLowerCase()
    const vraag = boom.vragen[vraagIndex]
    let matchedWaarde: number | null = null

    for (const optie of vraag.opties) {
      const label = optieLabel(c, vraag.id, optie.waarde).toLowerCase()
      // Match if typed text contains the first meaningful word of the label or vice versa
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
      setTextInput('')
      handleAntwoord(matchedWaarde)
    } else {
      setTextInput('')
      setMessages((prev) => [
        ...prev,
        { id: `msg-niet-begrepen-${Date.now()}`, from: 'lizz', kind: { tag: 'niet-begrepen' } },
      ])
    }
  }

  // Reset and start fresh
  function handleOpnieuw() {
    reset()
    signaalRegistreerd.current = false
    setMessages([])
    setPhase('loading')
    setVraagIndex(0)
    setZinIndex(0)
    setTextInput('')
    navigate('/lizz?token=demo123&moment=inschrijving', { replace: true })
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

      case 'tussenzin':
        return c.lizz.tussenzinnen[kind.zinIndex % 3]

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
