import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatRelativeTime } from '../../lib/dateFormat'

interface Participant {
  userId: string
  name: string | null
  avatar: string | null
  count: number
  lastAt: string | null
}
interface Payload {
  total: number
  participants: Participant[]
}

/**
 * Liste des joueurs ayant relevé un défi collectif sur la fenêtre courante, pour
 * la modale détail : avatar + nom + moment de la dernière participation
 * ("il y a 3h"). Triés du plus récent au plus ancien.
 * Source : RPC get_defi_participants (mig 205).
 */
export function DefiParticipants({ defiId }: { defiId: string }) {
  const [data, setData] = useState<Payload | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .rpc('get_defi_participants', { p_defi_id: defiId, p_limit: 30 })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return
        setData(data as Payload)
      })
    return () => { cancelled = true }
  }, [defiId])

  if (!data) return null
  if (data.participants.length === 0) {
    return (
      <p className="defi-participants-empty">
        Personne n'a encore relevé ce défi cette semaine. Sois le premier !
      </p>
    )
  }

  return (
    <div className="defi-participants">
      <div className="defi-participants-head">
        Ils relèvent le défi · {data.total}
      </div>
      <ul className="defi-participants-list">
        {data.participants.map((p) => (
          <li key={p.userId} className="defi-participant">
            {p.avatar ? (
              <img className="defi-participant-av" src={p.avatar} alt="" />
            ) : (
              <span className="defi-participant-av defi-participant-av-fb">
                {(p.name ?? '?').charAt(0).toUpperCase()}
              </span>
            )}
            <span className="defi-participant-name">{p.name ?? 'Explorateur'}</span>
            {p.count > 1 && <span className="defi-participant-count">×{p.count}</span>}
            <span className="defi-participant-time">{formatRelativeTime(p.lastAt)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
