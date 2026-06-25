import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { useCrownsStore } from '../../stores/crownsStore'
import { refreshLevelStateGlobal } from '../../hooks/useLevel'
import { useEnsurePushPermission } from '../../hooks/useEnsurePushPermission'
import { useDefisStore } from '../../stores/defisStore'
import { EnigmaResult } from './EnigmaResult'
import { readableInk } from '../../lib/textFormat'
import parcheminImg from '../../assets/parchemin.png'
import './DailyEnigma.css'

interface Enigma {
  id: number
  difficulty: 'very_easy' | 'easy' | 'medium' | 'hard'
  loreText: string
  question: string
  format: 'qcm' | 'free'
  choices: string[] | null
  theme: string | null
  rewardInfluence: number
  rewardErudition: number
}

interface AnswerResult {
  correct: boolean
  answer: string
  explanation: string
  influenceGain: number
  eruditionGain: number
  crownsGain?: number
  newCrownsBalance?: number
  newErudition: number
  newGlory: number
}

interface DailyEnigmaProps {
  onClose: () => void
}

function getCountdown(): string {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  const diff = midnight.getTime() - now.getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h${m.toString().padStart(2, '0')}`
}

const DIFFICULTY_LABELS: Record<string, string> = {
  very_easy: 'Facile',
  easy: 'Intermédiaire',
  medium: 'Avancé',
  hard: 'Expert',
}

const DIFFICULTY_ORDER: Array<'very_easy' | 'easy' | 'medium' | 'hard'> = ['very_easy', 'easy', 'medium', 'hard']

export function DailyEnigma({ onClose }: DailyEnigmaProps) {
  const userId = usePlayerStore(s => s.userId)
  const companyName = usePlayerStore(s => s.userFactionTitle)
  const companyColor = usePlayerStore(s => s.userFactionColor)
  const setCrownsBalance = useCrownsStore(s => s.setBalance)
  const [enigmas, setEnigmas] = useState<Enigma[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [allDone, setAllDone] = useState(false)
  const [noEnigma, setNoEnigma] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [freeAnswer, setFreeAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const ensurePush = useEnsurePushPermission()
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [rpcError, setRpcError] = useState<string | null>(null)
  const [, setTotalGains] = useState({ influence: 0, erudition: 0 })
  const [themes, setThemes] = useState<Map<string, { label: string; color: string | null; icon: string | null }>>(new Map())

  // Load theme visuals once (macaron)
  useEffect(() => {
    supabase.from('enigma_themes').select('id, label, color, icon').then(({ data }) => {
      if (!data) return
      const map = new Map<string, { label: string; color: string | null; icon: string | null }>()
      for (const t of data as Array<{ id: string; label: string; color: string | null; icon: string | null }>) {
        map.set(t.id, { label: t.label, color: t.color, icon: t.icon })
      }
      setThemes(map)
    })
  }, [])

  function loadEnigmas() {
    if (!userId) return
    setLoading(true)
    setEnigmas([])
    setCurrentIndex(0)
    setResult(null)
    setAllDone(false)
    setNoEnigma(false)
    setRpcError(null)
    setTotalGains({ influence: 0, erudition: 0 })

    supabase.rpc('get_daily_enigma', { p_user_id: userId }).then(({ data, error }) => {
      if (error) {
        setRpcError(`Erreur de chargement : ${error.message ?? 'RPC indisponible'}`)
        setLoading(false)
        return
      }
      const d = data as Record<string, unknown>

      if (d.all_answered) {
        setAllDone(true)
      } else if (d.error === 'no_enigma_available') {
        setNoEnigma(true)
      } else if (d.enigmas && Array.isArray(d.enigmas)) {
        const list = (d.enigmas as Array<Record<string, unknown>>).map(e => ({
          id: e.id as number,
          difficulty: e.difficulty as Enigma['difficulty'],
          loreText: e.loreText as string,
          question: e.question as string,
          format: e.format as 'qcm' | 'free',
          choices: e.choices as string[] | null,
          theme: e.theme as string | null,
          rewardInfluence: (e.rewardInfluence as number) ?? 0,
          rewardErudition: (e.rewardErudition as number) ?? 0,
        }))
        // Sort easy → medium → hard
        list.sort((a, b) => DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty))
        setEnigmas(list)
      } else {
        setRpcError(`Format de réponse inattendu : ${JSON.stringify(d).slice(0, 200)}`)
      }
      setLoading(false)
    })
  }

  useEffect(() => { loadEnigmas() }, [userId])

  const enigma = enigmas[currentIndex] ?? null

  async function handleSubmit() {
    if (!userId || !enigma || submitting) return
    const answer = enigma.format === 'qcm' ? selectedChoice : freeAnswer.trim()
    if (!answer) return

    setSubmitting(true)
    const { data, error } = await supabase.rpc('answer_enigma', {
      p_user_id: userId,
      p_enigma_id: enigma.id,
      p_answer: answer,
    })

    if (!error && data && !data.error) {
      const r = data as AnswerResult
      setResult(r)
      setTotalGains(prev => ({
        influence: prev.influence + (r.influenceGain ?? 0),
        erudition: prev.erudition + (r.eruditionGain ?? 0),
      }))
      if (typeof r.newCrownsBalance === 'number') {
        setCrownsBalance(r.newCrownsBalance)
      }
      if (userId) void refreshLevelStateGlobal(userId)
      if (userId) useDefisStore.getState().refresh(userId)
      // Well-timed prompt : on vient juste de résoudre l'énigme du jour,
      // c'est l'instant idéal pour proposer les notifs (rituel quotidien).
      // Le hook ne re-prompt jamais s'il a déjà été refusé une fois.
      ensurePush({
        reason: 'daily_enigma',
        title: 'Veux-tu être prévenu chaque jour ?',
        body:  'On te ping quand ton énigme du jour est prête.',
      })
    }
    setSubmitting(false)
  }

  function handleNext() {
    if (currentIndex < enigmas.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setResult(null)
      setSelectedChoice(null)
      setFreeAnswer('')
    } else {
      onClose()
    }
  }

  const isLast = currentIndex >= enigmas.length - 1
  const progress = enigmas.length > 0 ? `${currentIndex + 1} / ${enigmas.length}` : ''

  return createPortal(
    <div className="enigma-overlay" onClick={onClose}>
      <div className="enigma-modal" onClick={e => e.stopPropagation()}>
        <button className="enigma-close-x" onClick={onClose}>&#10005;</button>

        {!result && (
          <div className="enigma-header">
            <img src={parcheminImg} alt="" className="enigma-header-chest" />
            <h2 className="enigma-title">{'\u00c9'}nigmes du jour</h2>
            {enigmas.length > 0 && <span className="enigma-progress">{progress}</span>}
            {companyName && (
              <span style={{ fontFamily: 'var(--font-accent, sans-serif)', fontSize: 13, fontWeight: 600, color: companyColor ? readableInk(companyColor) : 'var(--color-ink, #4A3728)' }}>
                ⚔️ pour {companyName}
              </span>
            )}
          </div>
        )}

        {loading && <div className="enigma-loading">Chargement...</div>}

        {!loading && allDone && (
          <div className="enigma-already-done">
            <p className="enigma-already-done-text">
              Vous avez répondu aux 3 énigmes du jour.
            </p>
            <p className="enigma-already-done-text" style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
              Prochaines énigmes dans {getCountdown()}
            </p>
          </div>
        )}

        {!loading && noEnigma && (
          <div className="enigma-already-done">
            <p className="enigma-already-done-text">
              Plus d'énigmes disponibles pour le moment.
            </p>
          </div>
        )}

        {!loading && rpcError && (
          <div className="enigma-already-done">
            <p className="enigma-already-done-text" style={{ color: '#c94545' }}>
              {rpcError}
            </p>
          </div>
        )}

        {!loading && enigma && !result && (
          <>
            <div className="enigma-meta">
              <div className={`enigma-difficulty ${enigma.difficulty}`}>
                {DIFFICULTY_LABELS[enigma.difficulty] ?? enigma.difficulty}
              </div>
              {enigma.theme && themes.get(enigma.theme) && (() => {
                const t = themes.get(enigma.theme!)!
                const c = t.color ?? '#c19a6b'
                return (
                  <div className="enigma-heritage-pill" style={{ backgroundColor: `${c}20`, color: c }}>
                    {t.icon && (
                      <span
                        className="enigma-heritage-icon"
                        style={{
                          WebkitMaskImage: `url(${t.icon})`,
                          maskImage: `url(${t.icon})`,
                          backgroundColor: c,
                        }}
                      />
                    )}
                    {t.label}
                  </div>
                )
              })()}
            </div>

            <p className="enigma-lore">{enigma.loreText}</p>
            <p className="enigma-question">{enigma.question}</p>

            {enigma.format === 'qcm' && enigma.choices && (
              <div className="enigma-choices">
                {enigma.choices.map(choice => (
                  <button
                    key={choice}
                    className={`enigma-choice${selectedChoice === choice ? ' selected' : ''}`}
                    onClick={() => setSelectedChoice(choice)}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            )}

            {enigma.format === 'free' && (
              <input
                type="text"
                className="enigma-free-input"
                placeholder="Votre réponse..."
                value={freeAnswer}
                onChange={e => setFreeAnswer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              />
            )}

            <button
              className="enigma-submit"
              onClick={handleSubmit}
              disabled={submitting || (enigma.format === 'qcm' ? !selectedChoice : !freeAnswer.trim())}
            >
              {submitting ? 'V\u00e9rification...' : 'R\u00e9pondre'}
            </button>
          </>
        )}

        {result && (
          <EnigmaResult
            correct={result.correct}
            answer={result.answer}
            explanation={result.explanation}
            influenceGain={result.influenceGain}
            eruditionGain={result.eruditionGain}
            crownsGain={result.crownsGain}
            difficulty={enigma.difficulty}
            onClose={isLast ? onClose : handleNext}
            closeLabel={isLast ? 'Fermer' : '\u00c9nigme suivante \u2192'}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}
