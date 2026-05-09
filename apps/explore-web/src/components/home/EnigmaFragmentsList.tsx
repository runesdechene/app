import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import './EnigmaFragmentsList.css'

interface FragmentStatus {
  fragmentId: number
  name: string
  icon: string | null
  iconUrl: string | null
  imageUrl: string | null
  collection: string | null
  hasEnigma: boolean
  enigmaCooldown: boolean
  enigmaNextAt: string | null
}

interface Props {
  onOpenFragment: (fragment: { fragmentId: number; name: string; icon: string | null; iconUrl: string | null }) => void
  refreshKey?: number
}

function formatHoursLeft(isoDate: string | null): string {
  if (!isoDate) return ''
  const diff = new Date(isoDate).getTime() - Date.now()
  if (diff <= 0) return ''
  const hours = Math.ceil(diff / 3600000)
  return `${hours}h`
}

/**
 * Rangée d'icônes des fragments possédés (avec énigme dispo ou en cooldown).
 * Affichée sous DailyEnigmaCard. Chaque icône est cliquable si l'énigme est dispo,
 * grisée + timer en heures sous-jacent si en cooldown.
 */
export function EnigmaFragmentsList({ onOpenFragment, refreshKey }: Props) {
  const userId = usePlayerStore((s) => s.userId)
  const [fragments, setFragments] = useState<FragmentStatus[]>([])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase.rpc('get_my_fragment_status', { p_user_id: userId }).then(({ data }) => {
      if (cancelled) return
      if (data && Array.isArray(data)) setFragments(data as FragmentStatus[])
    })
    return () => {
      cancelled = true
    }
  }, [userId, refreshKey])

  const fragmentsWithEnigma = fragments.filter((f) => f.hasEnigma || f.enigmaCooldown)
  if (fragmentsWithEnigma.length === 0) return null

  return (
    <div className="enigma-fragments-list">
      {fragmentsWithEnigma.map((f) => {
        const done = f.enigmaCooldown
        return (
          <button
            key={f.fragmentId}
            type="button"
            className={`enigma-fragment-icon${done ? ' done' : ''}`}
            onClick={
              done
                ? undefined
                : () => onOpenFragment({ fragmentId: f.fragmentId, name: f.name, icon: f.icon, iconUrl: f.iconUrl })
            }
            disabled={done}
            title={f.name}
            aria-label={done ? `${f.name} — disponible dans ${formatHoursLeft(f.enigmaNextAt)}` : `${f.name} — énigme disponible`}
          >
            <span className="enigma-fragment-icon-bubble">
              {f.imageUrl || f.iconUrl ? (
                <img src={f.imageUrl ?? f.iconUrl ?? ''} alt="" />
              ) : (
                <span aria-hidden>{f.icon ?? '🗝️'}</span>
              )}
            </span>
            {done && (
              <span className="enigma-fragment-icon-timer">{formatHoursLeft(f.enigmaNextAt)}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
