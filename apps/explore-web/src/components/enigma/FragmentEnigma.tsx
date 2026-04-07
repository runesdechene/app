import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { EnigmaResult } from './EnigmaResult'
import './DailyEnigma.css'

interface FragmentInfo {
  fragmentId: number
  name: string
  icon: string | null
  iconUrl: string | null
}

interface Props {
  fragment: FragmentInfo
  onClose: () => void
}

interface Enigma {
  id: number
  difficulty: string
  loreText: string
  question: string
  format: string
  choices: string[] | null
}

interface AnswerResult {
  correct: boolean
  answer: string
  explanation: string
  influenceGain: number
  eruditionGain: number
  newInfluenceStock?: number
  newErudition?: number
}

export function FragmentEnigma({ fragment, onClose }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [enigma, setEnigma] = useState<Enigma | null>(null)
  const [loading, setLoading] = useState(true)
  const [answer, setAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Charger l'énigme au montage
  useState(() => {
    if (!userId) return
    supabase.rpc('get_fragment_enigma', { p_user_id: userId, p_fragment_id: fragment.fragmentId })
      .then(({ data }) => {
        const d = data as Enigma & { error?: string; already_answered?: boolean } | null
        if (d?.already_answered) {
          setError('Vous avez deja repondu a cette enigme aujourd\'hui.')
        } else if (d?.error === 'no_enigma_available') {
          setError('Aucune enigme disponible pour ce fragment.')
        } else if (d?.error) {
          setError(d.error)
        } else if (d?.id) {
          setEnigma(d)
        }
        setLoading(false)
      })
  })

  async function handleSubmit() {
    if (!userId || !enigma || !answer.trim() || submitting) return
    setSubmitting(true)

    const { data } = await supabase.rpc('answer_fragment_enigma', {
      p_user_id: userId,
      p_enigma_id: enigma.id,
      p_answer: answer.trim(),
      p_fragment_id: fragment.fragmentId,
    })

    if (data && !data.error) {
      const r = data as AnswerResult
      setResult(r)
      if (r.newInfluenceStock != null) usePlayerStore.getState().setInfluenceStock(r.newInfluenceStock)
      if (r.newErudition != null) usePlayerStore.getState().setEruditionPoints(r.newErudition)
    }
    setSubmitting(false)
  }

  return (
    <div className="enigma-overlay" onClick={onClose}>
      <div className="enigma-modal" onClick={e => e.stopPropagation()}>
        <button className="enigma-close" onClick={onClose}>{'\u2715'}</button>

        <div className="enigma-header">
          <div className="enigma-header-content">
            {(fragment.iconUrl || fragment.icon) && (
              fragment.iconUrl
                ? <img src={fragment.iconUrl} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                : <span style={{ fontSize: 24 }}>{fragment.icon}</span>
            )}
            <h2 className="enigma-title">Enigme — {fragment.name}</h2>
          </div>
        </div>

        {loading && <p style={{ textAlign: 'center', padding: 20 }}>Chargement...</p>}

        {error && <p style={{ textAlign: 'center', padding: 20, opacity: 0.7 }}>{error}</p>}

        {enigma && !result && (
          <>
            <p className="enigma-lore">{enigma.loreText}</p>
            <p className="enigma-question">{enigma.question}</p>

            {enigma.format === 'qcm' && enigma.choices ? (
              <div className="enigma-choices">
                {enigma.choices.map((c, i) => (
                  <button
                    key={i}
                    className={`enigma-choice${answer === c ? ' selected' : ''}`}
                    onClick={() => setAnswer(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            ) : (
              <input
                className="enigma-input"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Votre reponse..."
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            )}

            <button
              className="enigma-submit"
              onClick={handleSubmit}
              disabled={!answer.trim() || submitting}
            >
              {submitting ? '...' : 'Valider'}
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
