import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { TagBonusList } from '../map/modals/TagBonusList'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'
import './FactionModal.css'

interface FactionData {
  id: string
  title: string
  color: string
  pattern: string | null
  description: string | null
  image_url: string | null
  bonus_energy: number
  bonus_regen_energy: number
}

interface FactionModalProps {
  onClose: (joined?: boolean) => void
  currentFactionId: string | null
}

export function FactionModal({ onClose, currentFactionId }: FactionModalProps) {
  const [factions, setFactions] = useState<FactionData[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState(false)
  const [confirmFaction, setConfirmFaction] = useState<string | null>(null)

  const userId = usePlayerStore(s => s.userId)
  const setUserFactionId = usePlayerStore(s => s.setUserFactionId)
  const setUserFactionColor = usePlayerStore(s => s.setUserFactionColor)
  const setUserFactionTitle = usePlayerStore(s => s.setUserFactionTitle)
  const setUserFactionPattern = usePlayerStore(s => s.setUserFactionPattern)
  const setDiscoveredIds = usePlayerStore(s => s.setDiscoveredIds)
  const incrementPlacesRefreshKey = useMapStore(s => s.incrementPlacesRefreshKey)
  const [cooldownError, setCooldownError] = useState<string | null>(null)

  const [underdogFactionId, setUnderdogFactionId] = useState<string | null>(null)
  const [tagBonuses, setTagBonuses] = useState<Record<string, Array<{ tagTitle: string; tagIcon: string | null; tagColor: string; tagBg: string; reduction: number }>>>({})

  useEffect(() => {
    Promise.all([
      // V0.7+ Mig 065 : factions triées par nombre de membres ASC (les plus
      // faibles d'abord) pour auto-équilibrage des inscriptions.
      supabase.rpc('get_factions_for_choice'),
      supabase.rpc('get_underdog_faction_id'),
      supabase.from('faction_tag_bonuses').select('faction_id, tag_id, cost_reduction'),
      supabase.from('tags').select('id, title, icon, color, background'),
    ]).then(([factionsRes, underdogRes, bonusRes, tagsRes]) => {
      if (factionsRes.data) setFactions(factionsRes.data as FactionData[])
      if (underdogRes.data) setUnderdogFactionId(underdogRes.data as string)

      if (bonusRes.data && tagsRes.data) {
        const tagMap = new Map((tagsRes.data as Array<{ id: string; title: string; icon: string | null; color: string; background: string }>).map(t => [t.id, { title: t.title, icon: t.icon, color: t.color, bg: t.background }]))
        const map: Record<string, Array<{ tagTitle: string; tagIcon: string | null; tagColor: string; tagBg: string; reduction: number }>> = {}
        for (const row of bonusRes.data as Array<{ faction_id: string; tag_id: string; cost_reduction: number }>) {
          if (row.cost_reduction <= 0) continue
          if (!map[row.faction_id]) map[row.faction_id] = []
          const tag = tagMap.get(row.tag_id)
          map[row.faction_id].push({ tagTitle: tag?.title ?? row.tag_id, tagIcon: tag?.icon ?? null, tagColor: tag?.color ?? '#C19A6B', tagBg: tag?.bg ?? '#F5E6D3', reduction: row.cost_reduction })
        }
        setTagBonuses(map)
      }

      setLoading(false)
    })
  }, [])

  /** Recharger discoveries + jauges après changement de faction */
  async function reloadAfterFactionChange() {
    if (!userId) return
    const [discRes, energyRes] = await Promise.all([
      supabase.rpc('get_user_discoveries', { p_user_id: userId }),
      supabase.rpc('get_user_energy', { p_user_id: userId }),
    ])
    if (discRes.data) setDiscoveredIds(discRes.data as string[])
    if (energyRes.data) {
      const d = energyRes.data as Record<string, number>
      usePlayerStore.setState({
        energy: d.energy ?? 0,
        maxEnergy: d.maxEnergy ?? 5,
        nextPointIn: d.nextPointIn ?? 0,
        energyCycle: d.energyCycle ?? 7200,
      })
    }
  }

  function handleFactionClick(factionId: string) {
    // Si changement de faction (avait une, passe a une autre) → confirmation
    if (currentFactionId && currentFactionId !== factionId) {
      setConfirmFaction(factionId)
    } else {
      selectFaction(factionId)
    }
  }

  async function selectFaction(factionId: string) {
    if (!userId || selecting) return
    setSelecting(true)

    setCooldownError(null)

    const { data } = await supabase.rpc('set_user_faction', {
      p_user_id: userId,
      p_faction_id: factionId,
    })

    if (data?.error === 'cooldown') {
      setCooldownError(`Vous devez attendre encore ${data.daysRemaining} jour${data.daysRemaining > 1 ? 's' : ''} avant de changer de Faction.`)
      setConfirmFaction(null)
      setSelecting(false)
      return
    }

    if (data?.error) {
      setCooldownError(data.error)
      setConfirmFaction(null)
      setSelecting(false)
      return
    }

    const faction = factions.find(f => f.id === factionId)
    setUserFactionId(factionId)
    setUserFactionColor(faction?.color ?? null)
    setUserFactionTitle(faction?.title ?? null)
    setUserFactionPattern(faction?.pattern ?? null)

    await reloadAfterFactionChange()

    // Mettre à jour les tags Shopify (fire-and-forget)
    const userEmail = await supabase.auth.getUser().then(({ data }) => data.user?.email)
    if (userEmail) {
      fetch('https://hub.runesdechene.com/.netlify/functions/shopify-create-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, firstName: usePlayerStore.getState().userName, factionTitle: faction?.title }),
      })
        .then(res => { if (!res.ok) console.warn('[FactionModal] shopify sync HTTP', res.status) })
        .catch(err => console.warn('[FactionModal] shopify sync failed', err))
    }

    // Re-fetch les places (couleurs de faction changent) + fermer la modal
    incrementPlacesRefreshKey()
    setSelecting(false)
    onClose(true)
  }

  async function leaveFaction() {
    if (!userId || selecting) return
    setSelecting(true)

    await supabase.rpc('set_user_faction', {
      p_user_id: userId,
      p_faction_id: null,
    })

    setUserFactionId(null)
    setUserFactionColor(null)
    await reloadAfterFactionChange()

    setSelecting(false)
    onClose(false)
  }

  const isMobile = window.innerWidth <= 768

  return (
    <div className="auth-overlay" onClick={() => onClose(false)} style={isMobile ? { zIndex: 10001 } : undefined}>
      <div
        className={`faction-modal${isMobile ? ' faction-modal-mobile' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <button className="auth-modal-close" onClick={() => onClose(false)} aria-label="Fermer">
          &#10005;
        </button>

        <h2 className="faction-modal-title">Choisissez votre Faction</h2>
        <p className="faction-modal-subtitle">
          Votre Faction, c'est votre manière d'agir. Mais quelle qu'elle soit, tous les joueurs collaborent pour réenchanter le monde et protéger l'Histoire.
        </p>

        {loading ? (
          <p className="faction-modal-loading">Chargement...</p>
        ) : (
          <div className="faction-modal-grid">
            {factions.map(f => {
              const isActive = currentFactionId === f.id
              const isUnderdog = underdogFactionId === f.id
              return (
                <button
                  key={f.id}
                  className={`faction-card${isActive ? ' active' : ''}${isUnderdog ? ' underdog' : ''}`}
                  style={{ '--faction-color': f.color } as React.CSSProperties}
                  onClick={() => handleFactionClick(f.id)}
                  disabled={selecting}
                >
                  {f.image_url ? (
                    <img src={f.image_url} alt={f.title} className="faction-card-img" />
                  ) : (
                    <div className="faction-card-placeholder" style={{ backgroundColor: f.color }} />
                  )}
                  <div className="faction-card-body">
                    <span className="faction-card-name">{f.title}</span>
                    {f.description && (
                      <div className="faction-card-desc" dangerouslySetInnerHTML={{ __html: f.description.replace(/\n/g, '<br>') }} />
                    )}
                    {tagBonuses[f.id]?.length > 0 && (
                      <TagBonusList
                        primary={tagBonuses[f.id].filter(b => b.reduction >= 50).map(b => ({ title: b.tagTitle, icon: b.tagIcon, color: b.tagColor, bg: b.tagBg }))}
                        secondary={tagBonuses[f.id].filter(b => b.reduction > 0 && b.reduction < 50).map(b => ({ title: b.tagTitle, icon: b.tagIcon, color: b.tagColor, bg: b.tagBg }))}
                        primaryReduction={tagBonuses[f.id].find(b => b.reduction >= 50)?.reduction}
                        secondaryReduction={tagBonuses[f.id].find(b => b.reduction > 0 && b.reduction < 50)?.reduction}
                      />
                    )}
                    {isUnderdog && (
                      <div className="faction-card-underdog">
                        <span className="faction-card-underdog-title">{'\uD83D\uDC80'} BAROUD D'HONNEUR {'\uD83D\uDC80'}</span>
                        <p className="faction-card-underdog-desc">Cette faction lutte pour sa survie ! Régénération d'énergie multipliée.</p>
                      </div>
                    )}
                    {isActive && (
                      <span className="faction-card-badge">Actuelle</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
        <div className="faction-legend">
          <span className="faction-legend-item">⚡ Énergie — Découvrir, veiller et fortifier les lieux</span>
          <span className="faction-legend-item">🎖️ Gloire — Votre prestige total, à vie</span>
          <span className="faction-legend-item">🪙 Couronnes — Influencer un lieu à distance (mécénat)</span>
          <span className="faction-legend-item">🏆 Coupe — Le classement des Factions cette saison</span>
          {currentFactionId && (
            <span className="faction-legend-item" style={{ fontWeight: 600 }}>⏳ Changer de Faction n'est possible que 2 fois tous les 30 jours</span>
          )}
        </div>

        {currentFactionId && (
          <button
            className="faction-modal-leave"
            onClick={leaveFaction}
            disabled={selecting}
          >
            Devenir un sans-bannière
          </button>
        )}

        {/* Erreur cooldown */}
        {cooldownError && (
          <div className="faction-confirm-overlay">
            <div className="faction-confirm-dialog">
              <p>{cooldownError}</p>
              <div className="faction-confirm-actions">
                <button onClick={() => setCooldownError(null)}>Compris</button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation changement de faction */}
        {confirmFaction && !cooldownError && (
          <div className="faction-confirm-overlay">
            <div className="faction-confirm-dialog">
              <p>
                Êtes-vous sûr ? Changer de Faction n'est possible <strong>que 2 fois tous les 30 jours</strong>.
              </p>
              <div className="faction-confirm-actions">
                <button onClick={() => setConfirmFaction(null)} disabled={selecting}>
                  Annuler
                </button>
                <button onClick={() => selectFaction(confirmFaction)} disabled={selecting}>
                  {selecting ? '...' : 'Confirmer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
