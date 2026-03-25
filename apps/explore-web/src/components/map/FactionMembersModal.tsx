import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'

interface FactionMember {
  userId: string
  name: string
  profileImage: string | null
  notorietyPoints: number
  displayedGeneralTitles: Array<{ id: number; name: string; icon: string }> | null
  factionTitle2: { id: number; name: string; icon: string } | null
}

interface FactionInfo {
  image_url: string | null
  description: string | null
  bonus_energy: number
  bonus_conquest: number
  bonus_construction: number
  bonus_regen_energy: number
  bonus_regen_conquest: number
  bonus_regen_construction: number
}

interface Props {
  factionId: string
  factionTitle: string
  factionColor: string
  onClose: () => void
}

export function FactionMembersModal({ factionId, factionTitle, factionColor, onClose }: Props) {
  const [members, setMembers] = useState<FactionMember[]>([])
  const [factionInfo, setFactionInfo] = useState<FactionInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const [isUnderdog, setIsUnderdog] = useState(false)
  const [underdogMultiplier, setUnderdogMultiplier] = useState(2)

  useEffect(() => {
    async function load() {
      const [membersRes, factionRes, underdogRes, multRes] = await Promise.all([
        supabase.rpc('get_faction_members', { p_faction_id: factionId }),
        supabase.from('factions')
          .select('image_url, description, bonus_energy, bonus_conquest, bonus_construction, bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction')
          .eq('id', factionId)
          .single(),
        supabase.rpc('get_underdog_faction_id'),
        supabase.from('app_settings').select('value').eq('key', 'underdog_multiplier').single(),
      ])
      if (membersRes.data && Array.isArray(membersRes.data)) {
        setMembers(membersRes.data as FactionMember[])
      }
      if (factionRes.data) {
        setFactionInfo(factionRes.data as FactionInfo)
      }
      if (underdogRes.data) {
        setIsUnderdog((underdogRes.data as string) === factionId)
      }
      if (multRes.data) {
        setUnderdogMultiplier(parseFloat(multRes.data.value) || 2)
      }
      setLoading(false)
    }
    load()
  }, [factionId])

  function handleMemberClick(playerId: string) {
    onClose()
    useMapStore.getState().setSelectedPlayerId(playerId)
  }

  const regenE = factionInfo ? (isUnderdog ? Math.round(100 - (100 - factionInfo.bonus_regen_energy) / underdogMultiplier) : factionInfo.bonus_regen_energy) : 0
  const regenC = factionInfo ? (isUnderdog ? Math.round(100 - (100 - factionInfo.bonus_regen_conquest) / underdogMultiplier) : factionInfo.bonus_regen_conquest) : 0
  const regenB = factionInfo ? (isUnderdog ? Math.round(100 - (100 - factionInfo.bonus_regen_construction) / underdogMultiplier) : factionInfo.bonus_regen_construction) : 0

  const hasBonuses = factionInfo && (
    factionInfo.bonus_energy !== 0 || factionInfo.bonus_conquest !== 0 || factionInfo.bonus_construction !== 0 ||
    regenE !== 0 || regenC !== 0 || regenB !== 0
  )

  const isMobile = window.innerWidth <= 768

  const modal = (
    <div className="player-modal-overlay" onClick={onClose} style={isMobile ? { zIndex: 99999, alignItems: 'stretch' } : undefined}>
      <div
        className="faction-members-modal"
        onClick={e => e.stopPropagation()}
        style={isMobile ? {
          width: '100%',
          maxWidth: 'none',
          maxHeight: 'none',
          height: '100%',
          borderRadius: 0,
          border: 'none',
          boxSizing: 'border-box' as const,
        } : undefined}
      >
        <button className="player-modal-close" onClick={onClose} aria-label="Fermer">
          &#10005;
        </button>

        <div className="faction-members-layout">
          {/* Colonne gauche : banniere + infos (sticky sur desktop) */}
          <div className="faction-members-sidebar">
            <h2 className="faction-members-title" style={{ color: factionColor }}>
              {factionTitle}
            </h2>

            {factionInfo && (
              <>
                {factionInfo.image_url && (
                  <img src={factionInfo.image_url} alt={factionTitle} className="faction-members-img" />
                )}
                {factionInfo.description && (
                  <p className="faction-members-desc" dangerouslySetInnerHTML={{ __html: factionInfo.description.replace(/\n/g, '<br>') }} />
                )}
                {hasBonuses && (
                  <div className="faction-members-bonuses">
                    {factionInfo.bonus_energy !== 0 && (
                      <span className={`faction-bonus-tag${factionInfo.bonus_energy < 0 ? ' malus' : ''}`}>
                        {factionInfo.bonus_energy > 0 ? '+' : ''}{factionInfo.bonus_energy} Energie
                      </span>
                    )}
                    {factionInfo.bonus_conquest !== 0 && (
                      <span className={`faction-bonus-tag${factionInfo.bonus_conquest < 0 ? ' malus' : ''}`}>
                        {factionInfo.bonus_conquest > 0 ? '+' : ''}{factionInfo.bonus_conquest} Conquete
                      </span>
                    )}
                    {factionInfo.bonus_construction !== 0 && (
                      <span className={`faction-bonus-tag${factionInfo.bonus_construction < 0 ? ' malus' : ''}`}>
                        {factionInfo.bonus_construction > 0 ? '+' : ''}{factionInfo.bonus_construction} Construction
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
                )}
              </>
            )}
          </div>

          {/* Colonne droite : classement des membres */}
          <div className="faction-members-main">
            {isUnderdog && (
              <div className="faction-card-underdog" style={{ position: 'relative', marginTop: 8, marginBottom: 12, border: '1px solid rgba(255, 180, 50, 0.3)', borderRadius: 8 }}>
                <span className="faction-card-underdog-title">{'\uD83D\uDC80'} BAROUD D'HONNEUR {'\uD83D\uDC80'}</span>
                <p className="faction-card-underdog-desc">Cette faction lutte pour sa survie ! x{underdogMultiplier} sur toutes les ressources</p>
              </div>
            )}
            <h3 className="faction-members-list-title">Classement</h3>

            {loading && <div className="player-modal-loading">Chargement...</div>}

            {!loading && members.length === 0 && (
              <div className="player-modal-loading">Aucun membre</div>
            )}

            {!loading && members.length > 0 && (
              <div className="faction-members-list">
                {members.map((m, i) => (
                  <div
                    key={m.userId}
                    className="faction-member-row"
                    onClick={() => handleMemberClick(m.userId)}
                  >
                    <span className="faction-member-rank">#{i + 1}</span>
                    {m.profileImage ? (
                      <img src={m.profileImage} alt="" className="faction-member-avatar" />
                    ) : (
                      <div
                        className="faction-member-avatar-fallback"
                        style={{ background: factionColor }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="faction-member-info">
                      <span className="faction-member-name">{m.name}</span>
                      {m.factionTitle2 && (
                        <div className="faction-member-titles">
                          <span className="title-badge title-badge-faction">
                            {m.factionTitle2.icon} {m.factionTitle2.name}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="faction-member-notoriety">{m.notorietyPoints}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
