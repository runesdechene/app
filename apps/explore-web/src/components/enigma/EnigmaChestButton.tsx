import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import parcheminImg from '../../assets/parchemin.png'
import './DailyEnigma.css'

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
  onOpenDaily: () => void
  onOpenFragment: (fragment: { fragmentId: number; name: string; icon: string | null; iconUrl: string | null }) => void
  refreshKey?: number
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

function getTimeUntil(isoDate: string | null): string {
  if (!isoDate) return ''
  const diff = new Date(isoDate).getTime() - Date.now()
  if (diff <= 0) return 'Disponible'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h${m.toString().padStart(2, '0')}`
}

export function EnigmaChestButton({ onOpenDaily, onOpenFragment, refreshKey }: Props) {
  const userId = usePlayerStore(s => s.userId)
  const [dailyDone, setDailyDone] = useState(false)
  const [fragments, setFragments] = useState<FragmentStatus[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [countdown, setCountdown] = useState(getCountdown())

  function refreshStatus() {
    if (!userId) return
    supabase.rpc('get_daily_enigma', { p_user_id: userId }).then(({ data }) => {
      const d = data as { all_answered?: boolean } | null
      setDailyDone(!!d?.all_answered)
    })
    supabase.rpc('get_my_fragment_status', { p_user_id: userId }).then(({ data }) => {
      if (data && Array.isArray(data)) setFragments(data as FragmentStatus[])
    })
  }

  useEffect(() => { refreshStatus() }, [userId, refreshKey])

  // Countdown ticker
  useEffect(() => {
    const interval = setInterval(() => setCountdown(getCountdown()), 60000)
    return () => clearInterval(interval)
  }, [])

  const fragmentsWithEnigma = fragments.filter(f => f.hasEnigma || f.enigmaCooldown)
  const hasFragments = fragmentsWithEnigma.length > 0
  const availableCount = (dailyDone ? 0 : 1) + fragmentsWithEnigma.filter(f => !f.enigmaCooldown).length

  function handleClick() {
    if (!hasFragments) {
      onOpenDaily()
      return
    }
    setShowMenu(true)
  }

  function handleSelectDaily() {
    setShowMenu(false)
    onOpenDaily()
  }

  function handleSelectFragment(f: FragmentStatus) {
    setShowMenu(false)
    onOpenFragment({ fragmentId: f.fragmentId, name: f.name, icon: f.icon, iconUrl: f.iconUrl })
  }

  return (
    <>
      <button
        className={`enigma-chest-btn${availableCount > 0 ? ' pulse' : ''}`}
        onClick={handleClick}
        title="Enigmes"
      >
        <img
          src={parcheminImg}
          alt=""
          className={`enigma-chest-img${availableCount === 0 ? ' enigma-chest-img-done' : ''}`}
        />
        {availableCount > 0 && (
          <span className="enigma-chest-label">
            <span style={{ color: '#d4af37', fontWeight: 700 }}>{availableCount}</span>
          </span>
        )}
      </button>

      {showMenu && (
        <div className="enigma-menu-overlay" onClick={() => setShowMenu(false)}>
          <div className="enigma-menu" onClick={e => e.stopPropagation()}>
            <p className="enigma-menu-title">Choisissez une enigme</p>

            <button
              className={`enigma-menu-item${dailyDone ? ' enigma-menu-item-disabled' : ''}`}
              onClick={dailyDone ? undefined : handleSelectDaily}
              disabled={dailyDone}
            >
              <img src={parcheminImg} alt="" className="enigma-menu-item-img" />
              <div className="enigma-menu-item-info">
                <span className="enigma-menu-item-name">Enigmes du jour</span>
                <span className="enigma-menu-item-sub">
                  {dailyDone ? `Revient dans ${countdown}` : 'Gratuite'}
                </span>
              </div>
              {!dailyDone && <span className="enigma-menu-item-badge">{'\u2B50'}</span>}
              {dailyDone && <span className="enigma-menu-item-badge" style={{ opacity: 0.4 }}>{'\u2714'}</span>}
            </button>

            {fragmentsWithEnigma.map(f => {
              const done = f.enigmaCooldown
              return (
                <button
                  key={f.fragmentId}
                  className={`enigma-menu-item${done ? ' enigma-menu-item-disabled' : ''}`}
                  onClick={done ? undefined : () => handleSelectFragment(f)}
                  disabled={done}
                >
                  {f.imageUrl ? (
                    <img src={f.imageUrl} alt="" className="enigma-menu-item-img" />
                  ) : f.icon ? (
                    <span className="enigma-menu-item-img" style={{ fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.icon}</span>
                  ) : (
                    <span className="enigma-menu-item-img" style={{ fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\uD83C\uDFDB\uFE0F'}</span>
                  )}
                  <div className="enigma-menu-item-info">
                    <span className="enigma-menu-item-name">{f.name}</span>
                    <span className="enigma-menu-item-sub">
                      {done ? `Revient dans ${getTimeUntil(f.enigmaNextAt)}` : 'Disponible'}
                    </span>
                  </div>
                  {!done && <span className="enigma-menu-item-badge">{'\u2B50'}</span>}
                  {done && <span className="enigma-menu-item-badge" style={{ opacity: 0.4 }}>{'\u2714'}</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
