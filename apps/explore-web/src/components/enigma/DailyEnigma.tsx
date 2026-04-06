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
}

interface AnswerResult {
  correct: boolean
  answer: string
  explanation: string
  influenceGain: number
  eruditionGain: number
  newInfluenceStock: number
  newErudition: number
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
  const [alreadyAnswered, setAlreadyAnswered] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [freeAnswer, setFreeAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AnswerResult | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_daily_enigma', { p_user_id: userId })

      if (cancelled) return

      if (error) {
        setLoading(false)
        return
      }

      const d = data as { already_answered?: boolean; error?: string } & Enigma

      if (d.already_answered) {
        setAlreadyAnswered(true)
      } else if (d.error) {
        // No enigma available
        setAlreadyAnswered(true)
      } else if (d.id) {
        setEnigma({
          id: d.id,
          difficulty: d.difficulty,
          loreText: d.loreText,
          question: d.question,
          format: d.format,
          choices: d.choices,
          heritageId: d.heritageId,
        })
      }

      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [userId])

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

      // Update store
      if (r.newInfluenceStock != null) {
        usePlayerStore.getState().setInfluenceStock(r.newInfluenceStock)
      }
      if (r.newErudition != null) {
        usePlayerStore.getState().setEruditionPoints(r.newErudition)
      }
    }

    setSubmitting(false)
  }

  return (
    <div className="enigma-overlay" onClick={onClose}>
      <div className="enigma-modal" onClick={e => e.stopPropagation()}>
        <div className="enigma-header">
          <button className="enigma-close" onClick={onClose}>{'\u2715'}</button>
          <span className="enigma-icon">{'\uD83D\uDCE6'}</span>
          <h2 className="enigma-title">&Eacute;nigme du jour</h2>
        </div>

        {loading && (
          <div className="enigma-loading">Chargement...</div>
        )}

        {!loading && alreadyAnswered && !result && (
          <div className="enigma-already-done">
            <span className="enigma-already-done-icon">{'\u2705'}</span>
            <p className="enigma-already-done-text">
              Vous avez d&eacute;j&agrave; r&eacute;pondu aujourd&apos;hui. Revenez demain !
            </p>
          </div>
        )}

        {!loading && enigma && !result && !alreadyAnswered && (
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
          <EnigmaResult
            correct={result.correct}
            answer={result.answer}
            explanation={result.explanation}
            influenceGain={result.influenceGain}
            eruditionGain={result.eruditionGain}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}

/** Chest button to display on the map — pulses when enigma is available */
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
      {'\uD83D\uDCE6'}
      {!hasAnsweredToday && <span className="enigma-chest-dot" />}
    </button>
  )
}
