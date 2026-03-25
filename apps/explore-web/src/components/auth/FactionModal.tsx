import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'

interface FactionData {
  id: string
  title: string
  color: string
  pattern: string | null
  description: string | null
  image_url: string | null
  bonus_energy: number
  bonus_conquest: number
  bonus_construction: number
  bonus_regen_energy: number
  bonus_regen_conquest: number
  bonus_regen_construction: number
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
  const notorietyPoints = usePlayerStore(s => s.notorietyPoints)
  const setUserFactionId = usePlayerStore(s => s.setUserFactionId)
  const setUserFactionColor = usePlayerStore(s => s.setUserFactionColor)
  const setUserFactionTitle = usePlayerStore(s => s.setUserFactionTitle)
  const setUserFactionPattern = usePlayerStore(s => s.setUserFactionPattern)
  const setNotorietyPoints = usePlayerStore(s => s.setNotorietyPoints)
  const setDiscoveredIds = usePlayerStore(s => s.setDiscoveredIds)
  const incrementPlacesRefreshKey = useMapStore(s => s.incrementPlacesRefreshKey)

  const [underdogFactionId, setUnderdogFactionId] = useState<string | null>(null)
  const [underdogMultiplier, setUnderdogMultiplier] = useState(2)

  useEffect(() => {
    Promise.all([
      supabase
        .from('factions')
        .select('id, title, color, pattern, description, image_url, bonus_energy, bonus_conquest, bonus_construction, bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction')
        .order('order'),
      supabase.rpc('get_underdog_faction_id'),
      supabase.from('app_settings').select('value').eq('key', 'underdog_multiplier').single(),
    ]).then(([factionsRes, underdogRes, multRes]) => {
      if (factionsRes.data) setFactions(factionsRes.data as FactionData[])
      if (underdogRes.data) setUnderdogFactionId(underdogRes.data as string)
      if (multRes.data) setUnderdogMultiplier(parseFloat(multRes.data.value) || 2)
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
        conquestPoints: d.conquestPoints ?? 0,
        maxConquest: d.maxConquest ?? 5,
        conquestNextPointIn: d.conquestNextPointIn ?? 0,
        conquestCycle: d.conquestCycle ?? 14400,
        constructionPoints: d.constructionPoints ?? 0,
        maxConstruction: d.maxConstruction ?? 5,
        constructionNextPointIn: d.constructionNextPointIn ?? 0,
        constructionCycle: d.constructionCycle ?? 14400,
        bonusEnergy: d.bonusEnergy ?? 0,
        bonusConquest: d.bonusConquest ?? 0,
        bonusConstruction: d.bonusConstruction ?? 0,
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

    const isChanging = currentFactionId != null && currentFactionId !== factionId

    await supabase.rpc('set_user_faction', {
      p_user_id: userId,
      p_faction_id: factionId,
    })

    const faction = factions.find(f => f.id === factionId)
    setUserFactionId(factionId)
    setUserFactionColor(faction?.color ?? null)
    setUserFactionTitle(faction?.title ?? null)
    setUserFactionPattern(faction?.pattern ?? null)

    // Diviser notoriete par 2 si changement
    if (isChanging) {
      setNotorietyPoints(Math.floor(notorietyPoints / 2))
    }

    await reloadAfterFactionChange()

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
        className="faction-modal"
        onClick={e => e.stopPropagation()}
        style={isMobile ? {
          width: '100vw',
          maxWidth: 'none',
          maxHeight: '100vh',
          minHeight: '100vh',
          borderRadius: 0,
          border: 'none',
          padding: '16px',
          boxSizing: 'border-box' as const,
        } : undefined}
      >
        <button className="auth-modal-close" onClick={() => onClose(false)} aria-label="Fermer">
          &#10005;
        </button>

        <h2 className="faction-modal-title">Choisissez votre Faction</h2>
        <p className="faction-modal-subtitle">
          Rejoignez une faction pour revendiquer des lieux et étendre votre influence.
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
                    {(() => {
                      // Calcul des regen effectifs : underdog divise le cycle, equivalent a un bonus regen combine
                      const regenE = isUnderdog
                        ? Math.round(100 - (100 - f.bonus_regen_energy) / underdogMultiplier)
                        : f.bonus_regen_energy
                      const regenC = isUnderdog
                        ? Math.round(100 - (100 - f.bonus_regen_conquest) / underdogMultiplier)
                        : f.bonus_regen_conquest
                      const regenB = isUnderdog
                        ? Math.round(100 - (100 - f.bonus_regen_construction) / underdogMultiplier)
                        : f.bonus_regen_construction
                      const hasAny = f.bonus_energy !== 0 || f.bonus_conquest !== 0 || f.bonus_construction !== 0 || regenE !== 0 || regenC !== 0 || regenB !== 0
                      if (!hasAny) return null
                      return (
                        <div className="faction-card-bonuses">
                          {f.bonus_energy !== 0 && (
                            <span className={`faction-bonus-tag${f.bonus_energy < 0 ? ' malus' : ''}`}>
                              {f.bonus_energy > 0 ? '+' : ''}{f.bonus_energy} Energie
                            </span>
                          )}
                          {f.bonus_conquest !== 0 && (
                            <span className={`faction-bonus-tag${f.bonus_conquest < 0 ? ' malus' : ''}`}>
                              {f.bonus_conquest > 0 ? '+' : ''}{f.bonus_conquest} Conquete
                            </span>
                          )}
                          {f.bonus_construction !== 0 && (
                            <span className={`faction-bonus-tag${f.bonus_construction < 0 ? ' malus' : ''}`}>
                              {f.bonus_construction > 0 ? '+' : ''}{f.bonus_construction} Construction
                            </span>
                          )}
                          {regenE !== 0 && (
                            <span className={`faction-bonus-tag${regenE < 0 ? ' malus' : ''}${isUnderdog ? ' boosted' : ''}`}>
                              {isUnderdog && '\uD83D\uDC80 '}{regenE > 0 ? '+' : ''}{regenE}% Regen Energie
                            </span>
                          )}
                          {regenC !== 0 && (
                            <span className={`faction-bonus-tag${regenC < 0 ? ' malus' : ''}${isUnderdog ? ' boosted' : ''}`}>
                              {isUnderdog && '\uD83D\uDC80 '}{regenC > 0 ? '+' : ''}{regenC}% Regen Conquete
                            </span>
                          )}
                          {regenB !== 0 && (
                            <span className={`faction-bonus-tag${regenB < 0 ? ' malus' : ''}${isUnderdog ? ' boosted' : ''}`}>
                              {isUnderdog && '\uD83D\uDC80 '}{regenB > 0 ? '+' : ''}{regenB}% Regen Construction
                            </span>
                          )}
                        </div>
                      )
                    })()}
                    {isUnderdog && (
                      <div className="faction-card-underdog">
                        <span className="faction-card-underdog-title">{'\uD83D\uDC80'} BAROUD D'HONNEUR {'\uD83D\uDC80'}</span>
                        <p className="faction-card-underdog-desc">Cette faction lutte pour sa survie avec une rage de vaincre ! Les ressources sont multipliées.</p>
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
          <span className="faction-legend-item">⚡ Energie — Permet de découvrir des lieux</span>
          <span className="faction-legend-item">⚔️ Conquete — Aide à revendiquer un lieu</span>
          <span className="faction-legend-item">🪚 Construction — Vous pouvez fortifier vos lieux</span>
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

        {/* Confirmation changement de faction */}
        {confirmFaction && (
          <div className="faction-confirm-overlay">
            <div className="faction-confirm-dialog">
              <p>
                Etes-vous sur ? Changer de faction <strong>divisera votre Notoriete par 2</strong>
                {notorietyPoints > 0 ? ` (${notorietyPoints} → ${Math.floor(notorietyPoints / 2)} points)` : ''}.
              </p>
              <p>Cette action est irreversible.</p>
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
