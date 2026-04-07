import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { FragmentEnigma } from '../enigma/FragmentEnigma'
import './FragmentBar.css'

interface FragmentStatus {
  fragmentId: number
  name: string
  icon: string | null
  iconUrl: string | null
  imageUrl: string | null
  collection: string | null
  hasEnigma: boolean
  enigmaAnsweredToday: boolean
  affinities: Array<{ tagId: string; tagTitle: string; bonusPoints: number }>
}

export function FragmentBar() {
  const userId = usePlayerStore(s => s.userId)
  const [fragments, setFragments] = useState<FragmentStatus[]>([])
  const [selectedFragment, setSelectedFragment] = useState<FragmentStatus | null>(null)

  useEffect(() => {
    if (!userId) return
    supabase.rpc('get_my_fragment_status', { p_user_id: userId })
      .then(({ data }) => {
        if (data && Array.isArray(data)) setFragments(data as FragmentStatus[])
      })
  }, [userId])

  if (fragments.length === 0) return null

  const withEnigma = fragments.filter(f => f.hasEnigma)

  return (
    <>
      {withEnigma.length > 0 && (
        <div className="fragment-bar">
          {withEnigma.map(f => {
            const done = f.enigmaAnsweredToday
            return (
              <button
                key={f.fragmentId}
                className={`fragment-bar-btn${done ? ' done' : ''}`}
                onClick={done ? undefined : () => setSelectedFragment(f)}
                disabled={done}
                title={done
                  ? `${f.name} — enigme du jour faite`
                  : `${f.name} — enigme disponible !`}
              >
                {f.iconUrl ? (
                  <img src={f.iconUrl} alt={f.name} className="fragment-bar-img" />
                ) : f.icon ? (
                  <span className="fragment-bar-icon">{f.icon}</span>
                ) : (
                  <span className="fragment-bar-icon">🏛️</span>
                )}
                {!done && <span className="fragment-bar-dot" />}
              </button>
            )
          })}
        </div>
      )}

      {selectedFragment && (
        <FragmentEnigma
          fragment={selectedFragment}
          onClose={() => {
            setSelectedFragment(null)
            // Refresh le statut
            if (userId) {
              supabase.rpc('get_my_fragment_status', { p_user_id: userId })
                .then(({ data }) => {
                  if (data && Array.isArray(data)) setFragments(data as FragmentStatus[])
                })
            }
          }}
        />
      )}
    </>
  )
}
