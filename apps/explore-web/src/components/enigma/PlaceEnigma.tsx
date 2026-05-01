import { useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { refreshLevelStateGlobal } from '../../hooks/useLevel'
import { EnigmaResult } from './EnigmaResult'
import './PlaceEnigma.css'

interface PlaceEnigmaProps {
  placeId: string
  placeLocation: { latitude: number; longitude: number }
  placeTags: string[] // tag titles, used for matching
}

interface Enigma {
  id: number
  difficulty: 'easy' | 'medium' | 'hard'
  loreText: string
  question: string
  format: 'qcm' | 'free'
  choices: string[] | null
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

/** Haversine in km */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
}

export function PlaceEnigma(props: PlaceEnigmaProps) {
  const { placeLocation } = props
  // props.placeId and props.placeTags reserved for future place-specific enigma filtering
  const userId = usePlayerStore(s => s.userId)
  const userPosition = usePlayerStore(s => s.userPosition)
  const [enigma, setEnigma] = useState<Enigma | null>(null)
  const [showEnigma, setShowEnigma] = useState(false)
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [freeAnswer, setFreeAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [loaded, setLoaded] = useState(false)

  const isOnSite = useMemo(() => {
    if (!userPosition) return false
    return haversineKm(userPosition.lat, userPosition.lng, placeLocation.latitude, placeLocation.longitude) < 0.1
  }, [userPosition, placeLocation])

  // Only show for GPS-verified players on site
  if (!userId || !isOnSite) return null

  async function loadEnigma() {
    if (loaded) {
      setShowEnigma(true)
      return
    }

    // Fetch a place enigma — we use get_daily_enigma with a place-type filter
    // For now, the RPC does not filter by place tags, so we just call it
    // The backend will eventually support place-specific enigmas
    const { data, error } = await supabase.rpc('get_daily_enigma', { p_user_id: userId })

    if (!error && data && !data.error && !data.already_answered && data.id) {
      setEnigma({
        id: data.id,
        difficulty: data.difficulty,
        loreText: data.loreText,
        question: data.question,
        format: data.format,
        choices: data.choices,
      })
    }

    setLoaded(true)
    setShowEnigma(true)
  }

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

      if (r.newInfluenceStock != null) {
        usePlayerStore.getState().setInfluenceStock(r.newInfluenceStock)
      }
      if (r.newErudition != null) {
        usePlayerStore.getState().setEruditionPoints(r.newErudition)
      }
      void refreshLevelStateGlobal(userId)
    }

    setSubmitting(false)
  }

  if (result) {
    return (
      <div className="place-enigma">
        <EnigmaResult
          correct={result.correct}
          answer={result.answer}
          explanation={result.explanation}
          influenceGain={result.influenceGain}
          eruditionGain={result.eruditionGain}
          difficulty={enigma?.difficulty}
          onClose={() => setShowEnigma(false)}
        />
      </div>
    )
  }

  if (!showEnigma) {
    return (
      <div className="place-enigma">
        <button className="place-enigma-trigger" onClick={loadEnigma}>
          <span className="place-enigma-trigger-icon">{'\uD83D\uDCDC'}</span>
          &Eacute;nigme sur ce lieu
        </button>
      </div>
    )
  }

  if (!enigma) {
    return (
      <div className="place-enigma">
        <p style={{ fontSize: '12px', color: 'var(--color-sepia)', textAlign: 'center' }}>
          Aucune \u00e9nigme disponible pour ce lieu.
        </p>
      </div>
    )
  }

  return (
    <div className="place-enigma">
      <div className={`enigma-difficulty ${enigma.difficulty}`}>
        {DIFFICULTY_LABELS[enigma.difficulty] ?? enigma.difficulty}
      </div>

      <p className="enigma-lore" style={{ marginTop: 8 }}>{enigma.loreText}</p>
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
    </div>
  )
}
