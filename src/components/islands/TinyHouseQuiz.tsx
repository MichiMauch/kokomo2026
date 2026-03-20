import { useState, useMemo } from 'react'

// --- Data ---

interface Answer {
  text: string
  score: 1 | 2 | 3
  types: Partial<Record<TinyType, number>>
  models: Partial<Record<TinyModel, number>>
}

interface Question {
  question: string
  answers: Answer[]
}

type TinyType = 'naturmensch' | 'minimalist' | 'freiheitsmensch' | 'komfort'
type TinyModel = 'autark' | 'mobil' | 'design' | 'komfort'
type Phase = 'intro' | 'question' | 'result'

const questions: Question[] = [
  {
    question: 'Wie fühlt sich ein kleiner Raum für dich an?',
    answers: [
      { text: 'Befreiend — weniger Raum, mehr Klarheit', score: 3, types: { minimalist: 2 }, models: { autark: 1 } },
      { text: 'Gemütlich — wenn er gut gestaltet ist', score: 2, types: { naturmensch: 1 }, models: { design: 1 } },
      { text: 'Schnell etwas eng — ich brauche Platz', score: 1, types: { komfort: 2 }, models: { komfort: 1 } },
    ],
  },
  {
    question: 'Du ziehst um — was nimmst du mit?',
    answers: [
      { text: 'Nur das Nötigste — der Rest ist Ballast', score: 3, types: { minimalist: 2 }, models: { mobil: 2 } },
      { text: 'Einige Lieblingsstücke und das Wesentliche', score: 2, types: { naturmensch: 1 }, models: { design: 1 } },
      { text: 'Am liebsten alles — jedes Stück hat Bedeutung', score: 1, types: { komfort: 1 }, models: { komfort: 1 } },
    ],
  },
  {
    question: 'Was ist dir bei deinem Zuhause am wichtigsten?',
    answers: [
      { text: 'Naturverbundenheit — Fenster ins Grüne', score: 3, types: { naturmensch: 2 }, models: { autark: 1 } },
      { text: 'Clevere Raumaufteilung auf wenig Fläche', score: 2, types: { minimalist: 1 }, models: { design: 2 } },
      { text: 'Komfort — grosse Küche, bequemes Bad', score: 1, types: { komfort: 2 }, models: { komfort: 2 } },
    ],
  },
  {
    question: 'Wie gehst du mit Besitz um?',
    answers: [
      { text: 'Ich entrümple regelmässig und lebe leicht', score: 3, types: { minimalist: 2 }, models: { mobil: 1 } },
      { text: 'Ich habe nicht viel, aber was ich habe, schätze ich', score: 2, types: { naturmensch: 1 }, models: { design: 1 } },
      { text: 'Ich sammle gern und umgebe mich mit Dingen', score: 1, types: { komfort: 1 }, models: { komfort: 1 } },
    ],
  },
  {
    question: 'Was bedeutet Freiheit für dich?',
    answers: [
      { text: 'Unabhängigkeit — selbstbestimmt und autark leben', score: 3, types: { freiheitsmensch: 2 }, models: { autark: 2 } },
      { text: 'Flexibilität — Neues entdecken, Orte wechseln', score: 2, types: { freiheitsmensch: 1 }, models: { mobil: 1 } },
      { text: 'Sicherheit — ein fester Ort zum Ankommen', score: 1, types: { komfort: 2 }, models: { komfort: 2 } },
    ],
  },
  {
    question: 'Könntest du dir vorstellen, mobil zu wohnen?',
    answers: [
      { text: 'Ja! Heute hier, morgen dort — traumhaft', score: 3, types: { freiheitsmensch: 2 }, models: { autark: 1, mobil: 2 } },
      { text: 'Vielleicht — ab und zu den Standort wechseln', score: 2, types: { freiheitsmensch: 1 }, models: { mobil: 1 } },
      { text: 'Nein — ich brauche einen festen Platz', score: 1, types: { komfort: 1 }, models: { komfort: 1 } },
    ],
  },
  {
    question: 'Wie wichtig ist dir Nachhaltigkeit beim Wohnen?',
    answers: [
      { text: 'Sehr — ich möchte meinen Fussabdruck minimieren', score: 3, types: { freiheitsmensch: 2 }, models: { autark: 1 } },
      { text: 'Wichtig — aber es muss auch praktisch sein', score: 2, types: { naturmensch: 1 }, models: { mobil: 1 } },
      { text: 'Nachrangig — Wohnkomfort geht vor', score: 1, types: { komfort: 2 }, models: { komfort: 2 } },
    ],
  },
  {
    question: 'Dein idealer Morgen beginnt mit…',
    answers: [
      { text: 'Vogelgezwitscher und Blick auf Wiesen oder Wald', score: 3, types: { naturmensch: 2 }, models: { autark: 2 } },
      { text: 'Kaffee auf einer kleinen, sonnigen Terrasse', score: 2, types: { minimalist: 1 }, models: { design: 1 } },
      { text: 'Ausschlafen im bequemen, grossen Bett', score: 1, types: { komfort: 1 }, models: { komfort: 1 } },
    ],
  },
  {
    question: 'Wie stehst du zu Multifunktionsmöbeln?',
    answers: [
      { text: 'Genial — ein Tisch wird zur Werkbank wird zum Bett', score: 3, types: { minimalist: 2 }, models: { mobil: 1 } },
      { text: 'Praktisch — solange das Design stimmt', score: 2, types: { naturmensch: 1 }, models: { design: 1 } },
      { text: 'Umständlich — ich mag richtige Möbel', score: 1, types: { komfort: 1 }, models: { komfort: 1 } },
    ],
  },
  {
    question: 'Welches Tiny-House-Szenario reizt dich am meisten?',
    answers: [
      { text: 'Allein am Waldrand — Natur pur, weit weg vom Trubel', score: 3, types: { naturmensch: 2 }, models: { autark: 2 } },
      { text: 'In einer kleinen Community — clever geplant, gemeinsam leben', score: 2, types: { minimalist: 1 }, models: { design: 2 } },
      { text: 'Stadtnah mit guter Anbindung und allem Komfort', score: 1, types: { komfort: 2 }, models: { komfort: 2 } },
    ],
  },
]

const typeInfo: Record<TinyType, { emoji: string; name: string; description: string }> = {
  naturmensch: {
    emoji: '🌿',
    name: 'Der Naturmensch',
    description: 'Du suchst Verbundenheit mit der Natur. Dein Tiny House ist dein Rückzugsort im Grünen — Vogelgesang statt Strassenverkehr, Sternenhimmel statt Strassenlaterne.',
  },
  minimalist: {
    emoji: '✨',
    name: 'Der Minimalist',
    description: 'Weniger ist mehr — das ist dein Lebensmotto. Du liebst klare Strukturen, durchdachte Räume und die Freiheit, die entsteht, wenn man loslässt.',
  },
  freiheitsmensch: {
    emoji: '🦅',
    name: 'Der Freiheitsmensch',
    description: 'Unabhängigkeit ist dir heilig. Du willst selbstbestimmt leben, flexibel bleiben und am liebsten heute hier und morgen dort aufwachen.',
  },
  komfort: {
    emoji: '🛋️',
    name: 'Der Komfort-Tiny-Housler',
    description: 'Du magst es gemütlich und praktisch. Ein Tiny House ja — aber bitte mit allem, was das Leben angenehm macht. Kompromisse beim Wohnkomfort? Lieber nicht.',
  },
}

const modelInfo: Record<TinyModel, { emoji: string; name: string; description: string }> = {
  autark: {
    emoji: '🔋',
    name: 'Autarkes Tiny House',
    description: 'Solarstrom, Regenwasser, Komposttoilette — dein Haus funktioniert unabhängig vom Netz. Perfekt für naturnahe Standorte abseits der Infrastruktur.',
  },
  mobil: {
    emoji: '🚐',
    name: 'Mobiles Tiny House',
    description: 'Auf Rädern gebaut, jederzeit versetzbar. Du bist nicht an einen Ort gebunden und kannst deinen Wohnort flexibel wählen.',
  },
  design: {
    emoji: '📐',
    name: 'Design-Tiny-House',
    description: 'Architektonisch durchdacht, mit cleverer Raumnutzung und ästhetischem Anspruch. Jeder Quadratmeter ist bis ins Detail geplant.',
  },
  komfort: {
    emoji: '🏡',
    name: 'Komfort-Tiny-House',
    description: 'Vollausgestattet mit moderner Küche, komfortablem Bad und allem, was ein konventionelles Haus bietet — nur kompakter.',
  },
}

function getScoreText(percent: number): string {
  if (percent <= 40) return 'Du bist eher der konventionelle Typ — aber wer weiss, vielleicht entdeckst du noch die Faszination Tiny House!'
  if (percent <= 60) return 'Du bist offen für das Tiny-House-Konzept, hast aber auch Bedürfnisse, die Raum brauchen. Ein guter Kompromiss ist möglich!'
  if (percent <= 80) return 'Du hast definitiv das Zeug zum Tiny-House-Bewohner! Mit dem richtigen Modell wird das dein Traumzuhause.'
  return 'Du bist ein echtes Tiny-House-Naturtalent! Klein wohnen liegt dir im Blut — worauf wartest du noch?'
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

function highestKey<K extends string>(map: Record<K, number>): K {
  let best: K | undefined
  let max = -1
  for (const k in map) {
    if (map[k] > max) {
      max = map[k]
      best = k
    }
  }
  return best!
}

// --- Component ---

export default function TinyHouseQuiz() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<(Answer | null)[]>(Array(questions.length).fill(null))
  // Shuffle answer order once per quiz session
  const shuffledQuestions = useMemo(
    () => questions.map((q) => ({ ...q, answers: shuffle(q.answers) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase === 'intro'] // re-shuffle when returning to intro
  )

  function handleStart() {
    setAnswers(Array(questions.length).fill(null))
    setCurrentQ(0)
    setPhase('question')
  }

  function handleAnswer(answer: Answer) {
    const next = [...answers]
    next[currentQ] = answer
    setAnswers(next)
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1)
    } else {
      setPhase('result')
    }
  }

  function handleBack() {
    if (currentQ > 0) setCurrentQ(currentQ - 1)
  }

  function handleRestart() {
    setPhase('intro')
    setCurrentQ(0)
    setAnswers(Array(questions.length).fill(null))
  }

  function handleShare() {
    const url = window.location.href
    const text = 'Wie Tiny-House-tauglich bist du? Mach den Test!'
    if (navigator.share) {
      navigator.share({ title: text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(() => alert('Link kopiert!'))
    }
  }

  // Compute results
  const totalScore = answers.reduce((sum, a) => sum + (a?.score ?? 0), 0)
  const percent = Math.round((totalScore / 30) * 100)

  const typeTotals: Record<TinyType, number> = { naturmensch: 0, minimalist: 0, freiheitsmensch: 0, komfort: 0 }
  const modelTotals: Record<TinyModel, number> = { autark: 0, mobil: 0, design: 0, komfort: 0 }
  for (const a of answers) {
    if (!a) continue
    for (const [k, v] of Object.entries(a.types)) typeTotals[k as TinyType] += v
    for (const [k, v] of Object.entries(a.models)) modelTotals[k as TinyModel] += v
  }
  const bestType = highestKey(typeTotals)
  const bestModel = highestKey(modelTotals)

  // --- Render ---

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 16px 80px' }}>
      <style>{`
        @keyframes quizFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .quiz-animate-in { animation: quizFadeIn 0.3s ease both; }
        .quiz-progress-bar { transition: width 0.4s ease; }
        .quiz-circle { transition: stroke-dashoffset 0.8s ease; }
      `}</style>

      {phase === 'intro' && (
        <div key="intro" className="quiz-animate-in" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🏠</div>
          <h1
            style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2, margin: '0 0 16px' }}
            className="text-slate-900 dark:text-white"
          >
            Wie Tiny-House-tauglich bist du?
          </h1>
          <p
            style={{ fontSize: 16, lineHeight: 1.7, margin: '0 0 32px', maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}
            className="text-slate-600 dark:text-slate-300"
          >
            10 Fragen, 3 Ergebnisse: Finde heraus, wie gut du fürs Tiny-House-Leben geeignet bist, welcher Typ du bist und welches Modell zu dir passt.
          </p>
          <button
            onClick={handleStart}
            className="inline-flex cursor-pointer items-center justify-center rounded-full bg-primary-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:bg-primary-600 hover:shadow-xl dark:bg-primary-600 dark:hover:bg-primary-500"
          >
            Test starten
          </button>
        </div>
      )}

      {phase === 'question' && (
        <>
          {/* Progress — outside fade so it never flickers */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Frage {currentQ + 1} von {questions.length}
              </span>
              <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                {Math.round(((currentQ + 1) / questions.length) * 100)}%
              </span>
            </div>
            <div
              style={{ height: 6, borderRadius: 3, overflow: 'hidden' }}
              className="bg-slate-200 dark:bg-slate-700"
            >
              <div
                className="quiz-progress-bar bg-primary-500"
                style={{ height: '100%', borderRadius: 3, width: `${((currentQ + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div key={currentQ} className="quiz-animate-in">
          {/* Question */}
          <h2
            style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.3, margin: '0 0 24px' }}
            className="text-slate-900 dark:text-white"
          >
            {shuffledQuestions[currentQ].question}
          </h2>

          {/* Answers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {shuffledQuestions[currentQ].answers.map((a, i) => {
              const isSelected = answers[currentQ] === a
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(a)}
                  style={{
                    textAlign: 'left',
                    padding: '16px 20px',
                    borderRadius: 14,
                    border: '1px solid',
                    cursor: 'pointer',
                    fontSize: 15,
                    lineHeight: 1.5,
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                  }}
                  className={
                    isSelected
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-900/30 dark:text-primary-300'
                      : 'border-slate-200 bg-white/80 text-slate-700 hover:border-primary-300 hover:bg-primary-50/50 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:border-primary-500/50 dark:hover:bg-slate-700/60'
                  }
                >
                  {a.text}
                </button>
              )
            })}
          </div>

          {/* Back button */}
          {currentQ > 0 && (
            <button
              onClick={handleBack}
              style={{ marginTop: 20, padding: '8px 0', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ← Zurück
            </button>
          )}
          </div>
        </>
      )}

      {phase === 'result' && (
        <div key="result" className="quiz-animate-in">
          <h2
            style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', margin: '0 0 32px', lineHeight: 1.2 }}
            className="text-slate-900 dark:text-white"
          >
            Dein Tiny-House-Profil
          </h2>

          <div style={{ display: 'grid', gap: 20 }} className="grid-cols-1 md:grid-cols-3">
            {/* Card 1: Score */}
            <div
              style={{
                padding: 28,
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(12px)',
                textAlign: 'center',
              }}
              className="dark:!bg-slate-800/60 dark:!border-slate-700/50"
            >
              <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 16px' }}>
                <svg viewBox="0 0 36 36" style={{ width: 100, height: 100, transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3" className="dark:stroke-slate-700" />
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="#05DE66"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={`${(percent / 100) * 100.53} 100.53`}
                    className="quiz-circle"
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                  className="text-slate-900 dark:text-white"
                >
                  {percent}%
                </div>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }} className="text-slate-900 dark:text-white">
                Tiny-House-Tauglichkeit
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }} className="text-slate-600 dark:text-slate-300">
                {getScoreText(percent)}
              </p>
            </div>

            {/* Card 2: Type */}
            <div
              style={{
                padding: 28,
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(12px)',
                textAlign: 'center',
              }}
              className="dark:!bg-slate-800/60 dark:!border-slate-700/50"
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>{typeInfo[bestType].emoji}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }} className="text-slate-900 dark:text-white">
                {typeInfo[bestType].name}
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }} className="text-slate-600 dark:text-slate-300">
                {typeInfo[bestType].description}
              </p>
            </div>

            {/* Card 3: Model */}
            <div
              style={{
                padding: 28,
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.7)',
                backdropFilter: 'blur(12px)',
                textAlign: 'center',
              }}
              className="dark:!bg-slate-800/60 dark:!border-slate-700/50"
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>{modelInfo[bestModel].emoji}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 8px' }} className="text-slate-900 dark:text-white">
                {modelInfo[bestModel].name}
              </h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }} className="text-slate-600 dark:text-slate-300">
                {modelInfo[bestModel].description}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
            <button
              onClick={handleRestart}
              className="inline-flex cursor-pointer items-center justify-center rounded-full bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-primary-600 hover:shadow-xl dark:bg-primary-600 dark:hover:bg-primary-500"
            >
              Nochmal testen
            </button>
            <button
              onClick={handleShare}
              style={{
                padding: '12px 24px',
                borderRadius: 9999,
                border: '1px solid',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600,
                transition: 'all 0.2s',
              }}
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Teilen
            </button>
          </div>

          {/* CTA */}
          <div
            style={{
              marginTop: 40,
              padding: 24,
              borderRadius: 16,
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.5)',
              backdropFilter: 'blur(8px)',
            }}
            className="dark:!bg-slate-800/40 dark:!border-slate-700/40"
          >
            <p style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }} className="text-slate-800 dark:text-slate-200">
              Neugierig geworden? Erfahre mehr über das Tiny-House-Leben.
            </p>
            <a
              href="/tiny-house/"
              className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
            >
              Zum Blog →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
