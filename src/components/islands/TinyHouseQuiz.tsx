import { useState, useMemo, useEffect, useRef } from 'react'

// --- Data ---

type Dimension = 'minimalismus' | 'platz' | 'handwerk' | 'stellplatz' | 'finanzen' | 'autarkie'
type Phase = 'intro' | 'question' | 'result'

interface Answer {
  text: string
  score: 1 | 2 | 3 // 3 = bereit, 1 = (noch) nicht
}

interface Question {
  dimension: Dimension
  question: string
  answers: Answer[]
}

// Reihenfolge der Dimensionen (für Ergebnis-Anzeige). Fragen sind paarweise
// nach dieser Reihenfolge gruppiert (2 Fragen pro Dimension = 1 Block).
const dimensionOrder: Dimension[] = ['minimalismus', 'platz', 'handwerk', 'stellplatz', 'finanzen', 'autarkie']

const questions: Question[] = [
  // --- Minimalismus / Konsum ---
  {
    dimension: 'minimalismus',
    question: 'Du räumst deinen Schrank aus — wie viel davon brauchst du wirklich?',
    answers: [
      { text: 'Das meiste kann weg, ich lebe gern leicht', score: 3 },
      { text: 'Einiges müsste ich aussortieren, fiele mir aber schwer', score: 2 },
      { text: 'Ich brauche eigentlich fast alles, was ich besitze', score: 1 },
    ],
  },
  {
    dimension: 'minimalismus',
    question: 'Wie oft kaufst du Dinge, die du danach kaum nutzt?',
    answers: [
      { text: 'Selten — ich überlege vor jedem Kauf genau', score: 3 },
      { text: 'Ab und zu lasse ich mich verleiten', score: 2 },
      { text: 'Oft — shoppen macht mir einfach Freude', score: 1 },
    ],
  },
  // --- Platzbedarf / Hobbys ---
  {
    dimension: 'platz',
    question: 'Wie viel Platz brauchen deine Hobbys?',
    answers: [
      { text: 'Wenig — Laptop, Buch oder draussen unterwegs', score: 3 },
      { text: 'Mittel — etwas Stauraum wäre schön', score: 2 },
      { text: 'Viel — Werkstatt, Instrumente, Ausrüstung & Co.', score: 1 },
    ],
  },
  {
    dimension: 'platz',
    question: 'Stell dir vor, dein gesamter Stauraum schrumpft auf wenige Schränke. Und nun?',
    answers: [
      { text: 'Kein Problem — clevere Aufteilung reicht mir', score: 3 },
      { text: 'Mit etwas Planung käme ich zurecht', score: 2 },
      { text: 'Schwierig — ich brauche Platz für meine Sachen', score: 1 },
    ],
  },
  // --- Handwerk / Selbstbau ---
  {
    dimension: 'handwerk',
    question: 'Im Haus tropft der Wasserhahn. Was machst du?',
    answers: [
      { text: 'Selber reparieren — Werkzeug raus, läuft', score: 3 },
      { text: 'Erst googeln, dann vorsichtig selbst versuchen', score: 2 },
      { text: 'Sofort jemanden anrufen, der das kann', score: 1 },
    ],
  },
  {
    dimension: 'handwerk',
    question: 'Wie wohl fühlst du dich mit Bohrmaschine, Säge und Co.?',
    answers: [
      { text: 'Sehr — handwerkliche Projekte machen mir Spass', score: 3 },
      { text: 'Geht so — Grundlagen sind vorhanden', score: 2 },
      { text: 'Gar nicht — das überlasse ich lieber Profis', score: 1 },
    ],
  },
  // --- Stellplatz / Standort ---
  {
    dimension: 'stellplatz',
    question: 'Einen Stellplatz fürs Tiny House zu finden, kann dauern. Wie gehst du damit um?',
    answers: [
      { text: 'Ich bin dran und bleibe hartnäckig — das lohnt sich', score: 3 },
      { text: 'Ich würde suchen, aber Geduld ist nicht meine Stärke', score: 2 },
      { text: 'Ehrlich gesagt schreckt mich diese Suche ab', score: 1 },
    ],
  },
  {
    dimension: 'stellplatz',
    question: 'Wie flexibel bist du bei deinem zukünftigen Wohnort?',
    answers: [
      { text: 'Sehr — ich gehe dorthin, wo sich ein Platz findet', score: 3 },
      { text: 'In einer bestimmten Region würde ich mich umsehen', score: 2 },
      { text: 'Gar nicht — ich will genau dort bleiben, wo ich bin', score: 1 },
    ],
  },
  // --- Finanzen / Budget ---
  {
    dimension: 'finanzen',
    question: 'Wie gut hast du die Kosten eines Tiny Houses im Blick?',
    answers: [
      { text: 'Gut — ich habe ein realistisches Budget durchgerechnet', score: 3 },
      { text: 'Grob — ich kenne die ungefähre Grössenordnung', score: 2 },
      { text: 'Noch gar nicht — keine Ahnung, was auf mich zukommt', score: 1 },
    ],
  },
  {
    dimension: 'finanzen',
    question: 'Ein Tiny House lässt sich nicht überall klassisch finanzieren. Und du?',
    answers: [
      { text: 'Ich habe Eigenmittel oder einen Plan zur Finanzierung', score: 3 },
      { text: 'Ich müsste mich noch um die Finanzierung kümmern', score: 2 },
      { text: 'Finanzierung ist für mich ein grosses Fragezeichen', score: 1 },
    ],
  },
  // --- Autarkie / Komfortverzicht ---
  {
    dimension: 'autarkie',
    question: 'Im Winter kann es im Tiny House mal kühler werden. Dein Gedanke dazu?',
    answers: [
      { text: 'Pullover an, Holz nachlegen — gehört dazu', score: 3 },
      { text: 'Mit guter Heizung käme ich damit klar', score: 2 },
      { text: 'Frieren? Nein danke, ich brauche es konstant warm', score: 1 },
    ],
  },
  {
    dimension: 'autarkie',
    question: 'Wasser und Strom sind im Tiny House oft begrenzt. Wie gehst du damit um?',
    answers: [
      { text: 'Bewusst haushalten reizt mich sogar', score: 3 },
      { text: 'Etwas umstellen ginge, mit kleinen Abstrichen', score: 2 },
      { text: 'Ich will mir darüber keine Gedanken machen müssen', score: 1 },
    ],
  },
]

const dimensionInfo: Record<
  Dimension,
  {
    emoji: string
    name: string
    short: string
    strongText: string
    weakText: string
    nextStep: string
    article: { slug: string; title: string }
  }
> = {
  minimalismus: {
    emoji: '✨',
    name: 'Konsum & Loslassen',
    short: 'Konsum',
    strongText: 'Du lebst leicht und hängst nicht an Dingen — beste Voraussetzung fürs kleine Wohnen.',
    weakText: 'Loslassen fällt dir noch schwer. Mit etwas Ausmisten wird der Schritt ins Tiny House leichter.',
    nextStep: 'Miste eine Schublade oder einen Schrank komplett aus — als Trockenübung fürs Loslassen.',
    article: { slug: '18-tipps-zum-ausmisten-und-entruempeln', title: '18 Tipps zum Ausmisten und Entrümpeln' },
  },
  platz: {
    emoji: '📦',
    name: 'Platz & Hobbys',
    short: 'Platz',
    strongText: 'Du kommst mit wenig Fläche aus — im Tiny House wirst du dich nicht eingeengt fühlen.',
    weakText: 'Dein Platzbedarf ist hoch. Clevere Einrichtung und Stauraum-Ideen helfen, das aufzufangen.',
    nextStep: 'Notiere, welche Hobbys wirklich Platz brauchen — und welche auch kompakt funktionieren.',
    article: { slug: 'tiny-house-einrichten-worauf-du-achten-solltest', title: 'Tiny House einrichten – worauf du achten solltest' },
  },
  handwerk: {
    emoji: '🔧',
    name: 'Handwerkliches Geschick',
    short: 'Handwerk',
    strongText: 'Du packst selbst an — im Tiny-House-Alltag Gold wert, wenn mal etwas zu richten ist.',
    weakText: 'Handwerk ist noch nicht deins. Kleine Projekte zum Üben machen dich Schritt für Schritt fit.',
    nextStep: 'Trau dich an ein kleines DIY-Projekt: ein Regal bauen oder eine Kleinigkeit reparieren.',
    article: { slug: 'eine-schoenere-treppe-musste-her', title: 'Eine schönere Treppe musste her' },
  },
  stellplatz: {
    emoji: '📍',
    name: 'Stellplatz-Suche',
    short: 'Stellplatz',
    strongText: 'Du bist bereit, einen Platz zu suchen und flexibel zu bleiben — die halbe Miete.',
    weakText: 'Die Stellplatz-Suche schreckt dich noch ab. Mit den richtigen Strategien wird sie machbar.',
    nextStep: 'Recherchiere, wo in deiner Region ein Tiny House überhaupt erlaubt ist.',
    article: { slug: 'tipps-tiny-house-grundstueck-suchen', title: 'So findest du ein Grundstück für dein Tiny House' },
  },
  finanzen: {
    emoji: '💰',
    name: 'Finanzen & Budget',
    short: 'Finanzen',
    strongText: 'Du hast die Kosten realistisch im Blick — eine solide finanzielle Basis steht.',
    weakText: 'Beim Budget gibt es noch Fragezeichen. Ein klarer Finanzplan schafft hier Sicherheit.',
    nextStep: 'Stell ein grobes Budget auf: Haus, Stellplatz, Anschlüsse und eine Reserve.',
    article: { slug: 'finanzierung-eines-tiny-houses', title: 'Finanzierung eines Tiny Houses' },
  },
  autarkie: {
    emoji: '🔋',
    name: 'Autarker Alltag',
    short: 'Autarkie',
    strongText: 'Bewusst mit Wärme, Wasser und Strom umgehen liegt dir — perfekt fürs autarke Leben.',
    weakText: 'Komfortverzicht fällt dir schwer. Es lohnt sich, ehrlich zu prüfen, wie autark du leben willst.',
    nextStep: 'Probier eine Woche lang bewusst Strom und Wasser zu sparen — wie fühlt sich das an?',
    article: { slug: 'real-talk-im-winter-warum-wir-frieren-m-ssen-um-es-warm-zu-haben', title: 'Real Talk im Winter' },
  },
}

function getVerdict(percent: number): { key: 'noch-nicht' | 'auf-gutem-weg' | 'bereit'; emoji: string; title: string; text: string; gradient: string } {
  if (percent < 45) {
    return {
      key: 'noch-nicht',
      emoji: '🌱',
      title: 'Noch nicht startklar',
      text: 'Das Tiny-House-Leben reizt dich, aber an einigen Stellen passt es noch nicht ganz. Schau dir die Punkte unten an — Schritt für Schritt kommst du näher.',
      gradient: 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)',
    }
  }
  if (percent <= 70) {
    return {
      key: 'auf-gutem-weg',
      emoji: '🚀',
      title: 'Auf gutem Weg',
      text: 'Du bringst vieles mit, was es fürs Tiny-House-Leben braucht. An ein paar Stellen lohnt sich noch etwas Vorbereitung — dann steht dem Traum kaum mehr etwas im Weg.',
      gradient: 'linear-gradient(135deg, #01ABE7 0%, #0176A9 100%)',
    }
  }
  return {
    key: 'bereit',
    emoji: '🏡',
    title: 'Bereit fürs Tiny House!',
    text: 'Wow — du bringst fast alles mit, was das Tiny-House-Leben verlangt. Konsum, Platz, Handwerk, Standort: Du bist startklar. Worauf wartest du noch?',
    gradient: 'linear-gradient(135deg, #05DE66 0%, #029B48 100%)',
  }
}

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Fragen-Indizes pro Block (2 Fragen je Dimension, in dimensionOrder-Reihenfolge)
const blocks: { dimension: Dimension; indices: number[] }[] = dimensionOrder.map((dim) => ({
  dimension: dim,
  indices: questions.map((q, i) => (q.dimension === dim ? i : -1)).filter((i) => i >= 0),
}))

// --- Radar chart geometry ---
const RADAR_SIZE = 280
const RADAR_R = 100
const RADAR_C = RADAR_SIZE / 2

function radarPoint(index: number, value: number, r: number = RADAR_R): [number, number] {
  const angle = ((-90 + index * 60) * Math.PI) / 180
  const rr = (value / 100) * r
  return [RADAR_C + rr * Math.cos(angle), RADAR_C + rr * Math.sin(angle)]
}

function polygonPoints(values: number[], r: number = RADAR_R): string {
  return values.map((v, i) => radarPoint(i, v, r).join(',')).join(' ')
}

// --- Component ---

export default function TinyHouseQuiz() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentBlock, setCurrentBlock] = useState(0)
  const [answers, setAnswers] = useState<(Answer | null)[]>(Array(questions.length).fill(null))
  const [copied, setCopied] = useState(false)
  // Shuffle answer order once per quiz session
  const shuffledQuestions = useMemo(
    () => questions.map((q) => ({ ...q, answers: shuffle(q.answers) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase === 'intro'] // re-shuffle when returning to intro
  )

  function handleStart() {
    setAnswers(Array(questions.length).fill(null))
    setCurrentBlock(0)
    setPhase('question')
  }

  function handleAnswer(questionIndex: number, answer: Answer) {
    const next = [...answers]
    next[questionIndex] = answer
    setAnswers(next)
  }

  function handleNext() {
    if (currentBlock < blocks.length - 1) {
      setCurrentBlock(currentBlock + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setPhase('result')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function handleBack() {
    if (currentBlock > 0) setCurrentBlock(currentBlock - 1)
  }

  function handleRestart() {
    setPhase('intro')
    setCurrentBlock(0)
    setAnswers(Array(questions.length).fill(null))
    setCopied(false)
    submittedRef.current = false
  }

  function handleShare() {
    const url = window.location.href
    const text = 'Bist du bereit fürs Tiny-House-Leben? Mach den Test!'
    if (navigator.share) {
      navigator.share({ title: text, url }).catch(() => {})
    } else {
      navigator.clipboard
        .writeText(url)
        .then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2500)
        })
        .catch(() => {})
    }
  }

  // Compute results — per dimension average → percent
  const perDimension = useMemo(() => {
    const sums: Record<Dimension, { total: number; count: number }> = {
      minimalismus: { total: 0, count: 0 },
      platz: { total: 0, count: 0 },
      handwerk: { total: 0, count: 0 },
      stellplatz: { total: 0, count: 0 },
      finanzen: { total: 0, count: 0 },
      autarkie: { total: 0, count: 0 },
    }
    answers.forEach((a, i) => {
      if (!a) return
      const dim = questions[i].dimension
      sums[dim].total += a.score
      sums[dim].count += 1
    })
    const result = {} as Record<Dimension, number>
    for (const dim of dimensionOrder) {
      const { total, count } = sums[dim]
      // Score 1–3 → 0–100 %: (avg - 1) / 2 * 100
      result[dim] = count > 0 ? Math.round(((total / count - 1) / 2) * 100) : 0
    }
    return result
  }, [answers])

  const overallPercent = useMemo(() => {
    const vals = dimensionOrder.map((d) => perDimension[d])
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
  }, [perDimension])

  const verdict = getVerdict(overallPercent)

  // Dimensions sorted weakest → strongest (for breakdown & next steps)
  const sortedDims = useMemo(
    () => [...dimensionOrder].sort((a, b) => perDimension[a] - perDimension[b]),
    [perDimension]
  )

  // Persist result once per completed quiz (anonymous, for site analytics)
  const submittedRef = useRef(false)
  useEffect(() => {
    if (phase !== 'result' || submittedRef.current) return
    submittedRef.current = true
    fetch('/api/quiz-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overall: overallPercent,
        verdict: verdict.key,
        dimensions: perDimension,
      }),
      keepalive: true,
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Count-up animation for the headline percentage
  const [displayPercent, setDisplayPercent] = useState(0)
  useEffect(() => {
    if (phase !== 'result') {
      setDisplayPercent(0)
      return
    }
    let raf = 0
    const start = performance.now()
    const duration = 900
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplayPercent(Math.round(eased * overallPercent))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, overallPercent])

  const block = blocks[currentBlock]
  const blockDim = block.dimension
  const answeredInBlock = block.indices.filter((i) => answers[i] !== null).length
  const blockComplete = answeredInBlock === block.indices.length
  const isLastBlock = currentBlock === blocks.length - 1

  // --- Render ---

  return (
    <div style={{ width: '100%' }}>
      <style>{`
        @keyframes quizFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes quizPop {
          0% { opacity: 0; transform: scale(0.85); }
          60% { transform: scale(1.04); }
          100% { opacity: 1; transform: scale(1); }
        }
        .quiz-animate-in { animation: quizFadeIn 0.35s ease both; }
        .quiz-pop { animation: quizPop 0.5s cubic-bezier(.34,1.56,.64,1) both; }
        .quiz-progress-bar { transition: width 0.4s ease; }
        .quiz-dim-bar { transition: width 0.7s cubic-bezier(.22,1,.36,1); }
        .quiz-answer { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, background .18s ease; }
        .quiz-answer:hover { transform: translateY(-2px); box-shadow: 0 10px 24px -12px rgba(0,0,0,.25); }
        .quiz-answer .quiz-arrow { opacity: 0; transform: translateX(-4px); transition: all .18s ease; }
        .quiz-answer:hover .quiz-arrow { opacity: 1; transform: translateX(0); }
        .quiz-chip { transition: all .3s ease; }
      `}</style>

      {phase === 'intro' && (
        <div key="intro" className="quiz-animate-in" style={{ textAlign: 'center', padding: '8px 0 8px' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🏠</div>
          <h1
            style={{ fontSize: 30, fontWeight: 700, lineHeight: 1.2, margin: '0 0 16px' }}
            className="text-slate-900 dark:text-white"
          >
            Bist du bereit fürs Tiny-House-Leben?
          </h1>
          <p
            style={{ fontSize: 16, lineHeight: 1.7, margin: '0 0 28px', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}
            className="text-slate-600 dark:text-slate-300"
          >
            Finde es in 6 Themen heraus. Am Ende erfährst du, wie bereit du wirklich bist — und woran du noch arbeiten kannst.
          </p>

          {/* Topic preview chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 32, maxWidth: 540, marginLeft: 'auto', marginRight: 'auto' }}>
            {dimensionOrder.map((dim) => (
              <span
                key={dim}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9999, fontSize: 13.5, fontWeight: 600 }}
                className="bg-white/70 text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-slate-700"
              >
                <span>{dimensionInfo[dim].emoji}</span>
                {dimensionInfo[dim].short}
              </span>
            ))}
          </div>

          <button
            onClick={handleStart}
            className="inline-flex cursor-pointer items-center justify-center rounded-full bg-primary-700 px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-primary-800 hover:shadow-xl dark:bg-primary-600 dark:hover:bg-primary-500"
          >
            Test starten →
          </button>
          <p style={{ fontSize: 13, marginTop: 14 }} className="text-slate-400 dark:text-slate-500">
            Dauert ca. 2 Minuten · 6 Themen, je 2 Fragen
          </p>
        </div>
      )}

      {phase === 'question' && (
        <>
          {/* Topic stepper — reframes 12 questions as 6 short themes */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              {blocks.map((b, i) => {
                const state = i < currentBlock ? 'done' : i === currentBlock ? 'active' : 'todo'
                return (
                  <div key={b.dimension} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div
                      className={`quiz-chip ${
                        state === 'done'
                          ? 'bg-primary-500 text-white'
                          : state === 'active'
                            ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-500 dark:bg-primary-900/40 dark:text-primary-300'
                            : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                      }`}
                      style={{ width: 36, height: 36, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}
                    >
                      {state === 'done' ? '✓' : dimensionInfo[b.dimension].emoji}
                    </div>
                    <div style={{ height: 3, borderRadius: 2, width: '100%', overflow: 'hidden' }} className="bg-slate-200 dark:bg-slate-700">
                      <div
                        className="quiz-progress-bar bg-primary-500"
                        style={{ height: '100%', width: i < currentBlock ? '100%' : i === currentBlock ? `${(answeredInBlock / block.indices.length) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Thema {currentBlock + 1} von {blocks.length}
              </span>
            </div>
          </div>

          <div key={currentBlock} className="quiz-animate-in">
            {/* Theme badge */}
            <div
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px', borderRadius: 9999, fontSize: 13.5, fontWeight: 600, marginBottom: 20 }}
              className="bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
            >
              <span style={{ fontSize: 16 }}>{dimensionInfo[blockDim].emoji}</span>
              {dimensionInfo[blockDim].name}
            </div>

            {/* Two questions of this block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {block.indices.map((qIndex, qNr) => (
                <div key={qIndex}>
                  <h2 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3, margin: '0 0 16px' }} className="text-slate-900 dark:text-white">
                    <span className="text-primary-500 dark:text-primary-400">{qNr + 1}.</span> {shuffledQuestions[qIndex].question}
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {shuffledQuestions[qIndex].answers.map((a, i) => {
                      const isSelected = answers[qIndex] === a
                      return (
                        <button
                          key={i}
                          onClick={() => handleAnswer(qIndex, a)}
                          className={`quiz-answer ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300'
                              : 'border-slate-200 bg-white/80 text-slate-700 hover:border-primary-300 hover:bg-primary-50/50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-primary-500/50 dark:hover:bg-slate-700/60'
                          }`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            textAlign: 'left',
                            padding: '15px 18px',
                            borderRadius: 14,
                            border: '1px solid',
                            cursor: 'pointer',
                            fontSize: 15,
                            lineHeight: 1.5,
                            fontWeight: 500,
                          }}
                        >
                          <span>{a.text}</span>
                          {isSelected && (
                            <span className="text-primary-500 dark:text-primary-400" style={{ fontSize: 17, flexShrink: 0 }}>
                              ✓
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Navigation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 32, gap: 12 }}>
              {currentBlock > 0 ? (
                <button
                  onClick={handleBack}
                  style={{ padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  ← Zurück
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={handleNext}
                disabled={!blockComplete}
                className={
                  blockComplete
                    ? 'inline-flex cursor-pointer items-center justify-center rounded-full bg-primary-700 px-7 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-primary-800 hover:shadow-xl dark:bg-primary-600 dark:hover:bg-primary-500'
                    : 'inline-flex items-center justify-center rounded-full bg-slate-200 px-7 py-3 text-sm font-semibold text-slate-400 dark:bg-slate-700 dark:text-slate-500'
                }
                style={{ cursor: blockComplete ? 'pointer' : 'not-allowed' }}
              >
                {isLastBlock ? 'Auswerten' : 'Weiter'} →
              </button>
            </div>
            {!blockComplete && (
              <p style={{ textAlign: 'right', fontSize: 12.5, marginTop: 8 }} className="text-slate-400 dark:text-slate-500">
                Beantworte beide Fragen, um fortzufahren
              </p>
            )}
          </div>
        </>
      )}

      {phase === 'result' && (
        <div key="result" className="quiz-animate-in">
          {/* Verdict hero */}
          <div
            className="quiz-pop"
            style={{
              position: 'relative',
              overflow: 'hidden',
              padding: '36px 28px',
              borderRadius: 24,
              textAlign: 'center',
              color: '#fff',
              background: verdict.gradient,
              boxShadow: '0 20px 40px -20px rgba(0,0,0,0.4)',
              marginBottom: 28,
            }}
          >
            <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>{verdict.emoji}</div>
            <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, marginBottom: 6 }}>{displayPercent}%</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}>{verdict.title}</h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.65, margin: 0, maxWidth: 460, marginLeft: 'auto', marginRight: 'auto', opacity: 0.95 }}>
              {verdict.text}
            </p>
          </div>

          {/* Radar chart */}
          <div
            style={{
              padding: '24px 16px 8px',
              borderRadius: 20,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(10px)',
              marginBottom: 28,
            }}
            className="dark:!bg-slate-800/50 dark:!border-slate-700/50"
          >
            <h3 style={{ fontSize: 15, fontWeight: 700, textAlign: 'center', margin: '0 0 8px' }} className="text-slate-700 dark:text-slate-200">
              Dein Tiny-House-Profil
            </h3>
            <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} style={{ width: '100%', maxWidth: 320, height: 'auto', margin: '0 auto', display: 'block', overflow: 'visible' }}>
              {[25, 50, 75, 100].map((ring) => (
                <polygon key={ring} points={polygonPoints([ring, ring, ring, ring, ring, ring])} fill="none" stroke="currentColor" strokeWidth={1} className="text-slate-200 dark:text-slate-700" />
              ))}
              {dimensionOrder.map((_, i) => {
                const [x, y] = radarPoint(i, 100)
                return <line key={i} x1={RADAR_C} y1={RADAR_C} x2={x} y2={y} stroke="currentColor" strokeWidth={1} className="text-slate-200 dark:text-slate-700" />
              })}
              <polygon points={polygonPoints(dimensionOrder.map((d) => perDimension[d]))} fill="#05DE66" fillOpacity={0.25} stroke="#05DE66" strokeWidth={2} strokeLinejoin="round" />
              {dimensionOrder.map((d, i) => {
                const [x, y] = radarPoint(i, perDimension[d])
                return <circle key={d} cx={x} cy={y} r={4} fill="#05DE66" stroke="#fff" strokeWidth={1.5} />
              })}
              {dimensionOrder.map((d, i) => {
                const [x, y] = radarPoint(i, 100, RADAR_R + 24)
                return (
                  <text key={d} x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 17 }}>
                    {dimensionInfo[d].emoji}
                  </text>
                )
              })}
            </svg>
          </div>

          {/* Dimension breakdown */}
          <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }} className="text-slate-900 dark:text-white">
            Deine Stärken & Baustellen
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {sortedDims.map((dim) => {
              const pct = perDimension[dim]
              const info = dimensionInfo[dim]
              const isWeak = pct < 50
              const isStrong = pct >= 67
              const barColor = isWeak ? '#f59e0b' : isStrong ? '#05DE66' : '#01ABE7'
              return (
                <div
                  key={dim}
                  style={{ padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)' }}
                  className="dark:!bg-slate-800/50 dark:!border-slate-700/50"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 22 }}>{info.emoji}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }} className="text-slate-900 dark:text-white">
                      {info.name}
                    </span>
                    <span style={{ color: barColor, fontSize: 14, fontWeight: 700 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 12 }} className="bg-slate-200 dark:bg-slate-700">
                    <div className="quiz-dim-bar" style={{ height: '100%', borderRadius: 3, width: `${pct}%`, background: barColor }} />
                  </div>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }} className="text-slate-600 dark:text-slate-300">
                    {isWeak ? info.weakText : info.strongText}
                  </p>
                  <a
                    href={`/tiny-house/${info.article.slug}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 13.5, fontWeight: 600 }}
                    className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                  >
                    📖 {info.article.title} →
                  </a>
                </div>
              )
            })}
          </div>

          {/* Next steps — what to take away / learn */}
          <div
            style={{ marginTop: 32, padding: 24, borderRadius: 18, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(10px)' }}
            className="dark:!bg-slate-800/55 dark:!border-slate-700/50"
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px' }} className="text-slate-900 dark:text-white">
              🧭 Deine nächsten Schritte
            </h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, margin: '0 0 18px' }} className="text-slate-600 dark:text-slate-300">
              Tiny-House-Tauglichkeit ist keine Frage von Talent, sondern von Vorbereitung. Daran kannst du als Nächstes konkret arbeiten:
            </p>
            <ol style={{ display: 'flex', flexDirection: 'column', gap: 14, margin: 0, padding: 0, listStyle: 'none' }}>
              {sortedDims.slice(0, 3).map((dim, i) => {
                const info = dimensionInfo[dim]
                return (
                  <li key={dim} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <span
                      style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}
                      className="bg-primary-600 text-white"
                    >
                      {i + 1}
                    </span>
                    <div>
                      <p style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.5, margin: '0 0 2px' }} className="text-slate-900 dark:text-white">
                        {info.emoji} {info.nextStep}
                      </p>
                      <a
                        href={`/tiny-house/${info.article.slug}`}
                        style={{ fontSize: 13, fontWeight: 600 }}
                        className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                      >
                        Mehr dazu: {info.article.title} →
                      </a>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={handleRestart}
              className="inline-flex cursor-pointer items-center justify-center rounded-full bg-primary-700 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-primary-800 hover:shadow-xl dark:bg-primary-600 dark:hover:bg-primary-500"
            >
              Nochmal testen
            </button>
            <button
              onClick={handleShare}
              style={{ padding: '12px 24px', borderRadius: 9999, border: '1px solid', cursor: 'pointer', fontSize: 14, fontWeight: 600, transition: 'all 0.2s' }}
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Teilen
            </button>
            {copied && <span className="text-sm font-medium text-primary-600 dark:text-primary-400">Link kopiert!</span>}
          </div>

          {/* CTA */}
          <div
            style={{ marginTop: 36, padding: 24, borderRadius: 16, textAlign: 'center', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)' }}
            className="dark:!bg-slate-800/40 dark:!border-slate-700/40"
          >
            <p style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }} className="text-slate-800 dark:text-slate-200">
              Neugierig geworden? Erfahre mehr über das Tiny-House-Leben.
            </p>
            <a href="/tiny-house/" className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
              Zum Blog →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
