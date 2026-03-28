import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useMapStore } from '../../stores/mapStore'
import { TagBonusList } from './TagBonusList'

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
  const [tagBonusesPrimary, setTagBonusesPrimary] = useState<Array<{ title: string; icon: string | null; color: string; bg: string }>>([])
  const [tagBonusesSecondary, setTagBonusesSecondary] = useState<Array<{ title: string; icon: string | null; color: string; bg: string }>>([])
  const [primaryReduction, setPrimaryReduction] = useState<number | undefined>()
  const [secondaryReduction, setSecondaryReduction] = useState<number | undefined>()


  useEffect(() => {
    async function load() {
      const [membersRes, factionRes, underdogRes, multRes, bonusRes, tagsRes] = await Promise.all([
        supabase.rpc('get_faction_members', { p_faction_id: factionId }),
        supabase.from('factions')
          .select('image_url, description, bonus_energy, bonus_conquest, bonus_construction, bonus_regen_energy, bonus_regen_conquest, bonus_regen_construction')
          .eq('id', factionId)
          .single(),
        supabase.rpc('get_underdog_faction_id'),
        supabase.from('app_settings').select('value').eq('key', 'underdog_multiplier').single(),
        supabase.from('faction_tag_bonuses').select('tag_id, cost_reduction').eq('faction_id', factionId),
        supabase.from('tags').select('id, title, icon, color, background'),
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
      if (bonusRes.data && tagsRes.data) {
        const tagMap = new Map((tagsRes.data as Array<{ id: string; title: string; icon: string | null; color: string; background: string }>).map(t => [t.id, t]))
        const primary: Array<{ title: string; icon: string | null; color: string; bg: string }> = []
        const secondary: Array<{ title: string; icon: string | null; color: string; bg: string }> = []
        for (const row of bonusRes.data as Array<{ tag_id: string; cost_reduction: number }>) {
          if (row.cost_reduction <= 0) continue
          const tag = tagMap.get(row.tag_id)
          const entry = { title: tag?.title ?? row.tag_id, icon: tag?.icon ?? null, color: tag?.color ?? '#C19A6B', bg: tag?.background ?? '#F5E6D3' }
          if (row.cost_reduction >= 50) primary.push(entry)
          else secondary.push(entry)
        }
        setTagBonusesPrimary(primary)
        setTagBonusesSecondary(secondary)
        const pRow = (bonusRes.data as Array<{ tag_id: string; cost_reduction: number }>).find(r => r.cost_reduction >= 50)
        const sRow = (bonusRes.data as Array<{ tag_id: string; cost_reduction: number }>).find(r => r.cost_reduction > 0 && r.cost_reduction < 50)
        if (pRow) setPrimaryReduction(pRow.cost_reduction)
        if (sRow) setSecondaryReduction(sRow.cost_reduction)
      }
      setLoading(false)
    }
    load()
  }, [factionId])

  function handleMemberClick(playerId: string) {
    onClose()
    useMapStore.getState().setSelectedPlayerId(playerId)
  }


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
                <TagBonusList primary={tagBonusesPrimary} secondary={tagBonusesSecondary} primaryReduction={primaryReduction} secondaryReduction={secondaryReduction} />
              </>
            )}
          </div>

          {/* Colonne droite : classement des membres */}
          <div className="faction-members-main">
            {isUnderdog && (
              <div className="faction-card-underdog" style={{ position: 'relative', marginTop: 8, marginBottom: 12, border: '1px solid rgba(255, 180, 50, 0.3)', borderRadius: 8 }}>
                <span className="faction-card-underdog-title">{'\uD83D\uDC80'} BAROUD D'HONNEUR {'\uD83D\uDC80'}</span>
                <p className="faction-card-underdog-desc">Cet héritage lutte pour sa survie ! x{underdogMultiplier} sur toutes les ressources</p>
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
