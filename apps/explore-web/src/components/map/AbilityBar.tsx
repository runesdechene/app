import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import './AbilityBar.css'

interface Ability {
  fragment_id: number
  name: string
  icon: string | null
  icon_url: string | null
  image_url: string | null
  ability_type: string
  ability_cooldown_hours: number
  ability_value: number
  last_used: string | null
  available: boolean
}

const ABILITY_LABELS: Record<string, string> = {
  free_discover: 'Découverte gratuite',
  free_claim: 'Protection gratuite',
  discount_discover: 'Réduction découverte',
  discount_claim: 'Réduction protection',
  double_glory: 'Gloire multipliée',
  distance_ignore: 'Ignorer la distance',
}

export function AbilityBar() {
  const userId = usePlayerStore(s => s.userId)
  const [abilities, setAbilities] = useState<Ability[]>([])
  const [activating, setActivating] = useState<number | null>(null)
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!userId) return
    supabase.rpc('get_my_abilities', { p_user_id: userId })
      .then(({ data }) => {
        if (data && Array.isArray(data)) setAbilities(data as Ability[])
      })
  }, [userId])

  // Tick toutes les minutes pour mettre à jour les cooldowns
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(interval)
  }, [])

  async function activate(fragmentId: number) {
    if (!userId) return
    const ability = abilities.find(a => a.fragment_id === fragmentId)
    if (!ability) return
    setActivating(fragmentId)
    const { data } = await supabase.rpc('use_fragment_ability', {
      p_user_id: userId,
      p_fragment_id: fragmentId,
    })
    if (data?.success) {
      setAbilities(prev => prev.map(a =>
        a.fragment_id === fragmentId
          ? { ...a, available: false, last_used: new Date().toISOString() }
          : a
      ))
      // Activer le buff
      usePlayerStore.getState().setActiveBuff(ability.ability_type)
      if (ability.ability_value) {
        localStorage.setItem('activeBuffValue', String(ability.ability_value))
      }
    }
    setActivating(null)
  }

  function getCooldownInfo(ability: Ability): { label: string; percent: number } | null {
    if (ability.available || !ability.last_used) return null
    const elapsed = (Date.now() - new Date(ability.last_used).getTime()) / 1000 / 3600
    const remaining = ability.ability_cooldown_hours - elapsed
    if (remaining <= 0) return null
    const percent = (remaining / ability.ability_cooldown_hours) * 100
    const label = remaining < 1 ? `${Math.ceil(remaining * 60)}m` : `${Math.ceil(remaining)}h`
    return { label, percent }
  }

  const activeBuff = usePlayerStore(s => s.activeBuff)

  const buffValue = parseFloat(localStorage.getItem('activeBuffValue') ?? '0')
  const BUFF_LABELS: Record<string, string> = {
    free_discover: '🔍 Découverte gratuite prête !',
    free_claim: '🛡️ Protection gratuite prête !',
    discount_discover: `🔍 Prochaine découverte -${buffValue} ⚡`,
    discount_claim: `🛡️ Prochaine protection -${buffValue} ⚡`,
    double_glory: `🏅 Gloire x${buffValue || 2} sur la prochaine action !`,
    distance_ignore: '📍 Distance ignorée !',
  }

  if (abilities.length === 0) return null

  return (
    <div className="ability-bar">
      {abilities.map(a => {
        const cd = getCooldownInfo(a)
        const isReady = a.available && !cd
        return (
          <button
            key={a.fragment_id}
            className={`ability-btn${isReady ? ' ready' : ' cooldown'}`}
            onClick={() => isReady && activate(a.fragment_id)}
            disabled={!isReady || activating === a.fragment_id}
            title={`${a.name} — ${ABILITY_LABELS[a.ability_type] ?? a.ability_type}${cd ? ` (${cd.label})` : ''}`}
          >
            {(a.image_url || a.icon_url) ? (
              <img src={a.image_url ?? a.icon_url!} alt={a.name} className="ability-btn-img" />
            ) : (
              <span className="ability-btn-icon">{a.icon ?? '✨'}</span>
            )}
            {cd && (
              <span
                className="ability-btn-sweep"
                style={{ background: `conic-gradient(rgba(0,0,0,0.6) ${cd.percent}%, transparent ${cd.percent}%)` }}
              />
            )}
            {cd && <span className="ability-btn-cooldown">{cd.label}</span>}
            {activating === a.fragment_id && <span className="ability-btn-cooldown">...</span>}
          </button>
        )
      })}
      {activeBuff && (
        <div className="ability-buff-indicator">
          {BUFF_LABELS[activeBuff] ?? activeBuff}
        </div>
      )}
    </div>
  )
}
