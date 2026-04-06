import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { EnigmaResult } from './EnigmaResult'
import './DailyEnigma.css'

interface Enigma {
  id: number
  difficulty: 'easy' | 'medium' | 'hard'
  loreText: string
  question: string
  format: 'qcm' | 'free'
  choices: string[] | null
  heritageId: string | null
  energyCost: number
  isBonus: boolean
  answeredToday: number
}

interface AnswerResult {
  correct: boolean
  answer: string
  explanation: string
  influenceGain: number
  eruditionGain: number
  energyCost: number
  newInfluenceStock: number
  newErudition: number
  newEnergy: number
  newGlory: number
}

interface DailyEnigmaProps {
  onClose: () => void
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
}

export function DailyEnigma({ onClose }: DailyEnigmaProps) {
  const userId = usePlayerStore(s => s.userId)
  const [enigma, setEnigma] = useState<Enigma | null>(null)
  const [noEnergy, setNoEnergy] = useState(false)
  const [noEnigma, setNoEnigma] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [freeAnswer, setFreeAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AnswerResult | null>(null)

  function loadEnigma() {
    if (!userId) return
    setLoading(true)
    setEnigma(null)
    setResult(null)
    setSelectedChoice(null)
    setFreeAnswer('')
    setNoEnergy(false)
    setNoEnigma(false)

    supabase.rpc('get_daily_enigma', { p_user_id: userId }).then(({ data, error }) => {
      if (error) { setLoading(false); return }
      const d = data as Record<string, unknown>

      if (d.error === 'not_enough_energy') {
        setNoEnergy(true)
      } else if (d.error === 'no_enigma_available') {
        setNoEnigma(true)
      } else if (d.id) {
        setEnigma({
          id: d.id as number,
          difficulty: d.difficulty as 'easy' | 'medium' | 'hard',
          loreText: d.loreText as string,
          question: d.question as string,
          format: d.format as 'qcm' | 'free',
          choices: d.choices as string[] | null,
          heritageId: d.heritageId as string | null,
          energyCost: (d.energyCost as number) ?? 0,
          isBonus: (d.isBonus as boolean) ?? false,
          answeredToday: (d.answeredToday as number) ?? 0,
        })
      }
      setLoading(false)
    })
  }

  useEffect(() => { loadEnigma() }, [userId])

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
      if (r.newInfluenceStock != null) usePlayerStore.getState().setInfluenceStock(r.newInfluenceStock)
      if (r.newErudition != null) usePlayerStore.getState().setEruditionPoints(r.newErudition)
      if (r.newEnergy != null) usePlayerStore.getState().setEnergy(r.newEnergy)
    }
    setSubmitting(false)
  }

  return (
    <div className="enigma-overlay" onClick={onClose}>
      <div className="enigma-modal" onClick={e => e.stopPropagation()}>
        <div className="enigma-header">
          <button className="enigma-close" onClick={onClose}>{'\u2715'}</button>
          <img src="/res/coffre.webp" alt="" className="enigma-header-chest" />
          <h2 className="enigma-title">
            {enigma?.isBonus ? '\u00c9nigme bonus' : '\u00c9nigme du jour'}
          </h2>
          {enigma?.isBonus && (
            <span className="enigma-cost">{enigma.energyCost} \u26a1</span>
          )}
        </div>

        {loading && <div className="enigma-loading">Chargement...</div>}

        {!loading && noEnergy && (
          <div className="enigma-already-done">
            <p className="enigma-already-done-text">
              Pas assez d'\u00e9nergie pour une \u00e9nigme bonus (5 \u26a1 requis).
            </p>
          </div>
        )}

        {!loading && noEnigma && (
          <div className="enigma-already-done">
            <p className="enigma-already-done-text">
              Plus d'\u00e9nigmes disponibles pour le moment.
            </p>
          </div>
        )}

        {!loading && enigma && !result && (
          <>
            <span className={`enigma-difficulty ${enigma.difficulty}`}>
              {DIFFICULTY_LABELS[enigma.difficulty] ?? enigma.difficulty}
            </span>

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
                placeholder="Votre r\u00e9ponse..."
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
          <>
            <EnigmaResult
              correct={result.correct}
              answer={result.answer}
              explanation={result.explanation}
              influenceGain={result.influenceGain}
              eruditionGain={result.eruditionGain}
              onClose={onClose}
            />
            <button className="enigma-next-btn" onClick={loadEnigma}>
              Encore une \u00e9nigme (5 \u26a1)
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/** Chest button to display on the map */
interface ChestButtonProps {
  onClick: () => void
  hasAnsweredToday: boolean
}

export function EnigmaChestButton({ onClick, hasAnsweredToday }: ChestButtonProps) {
  return (
    <button
      className={`enigma-chest-btn${!hasAnsweredToday ? ' pulse' : ''}`}
      onClick={onClick}
      title="\u00c9nigme du jour"
    >
      <img src="/res/coffre.webp" alt="" className="enigma-chest-img" />
      {!hasAnsweredToday && <span className="enigma-chest-dot" />}
    </button>
  )
}
