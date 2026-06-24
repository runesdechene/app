import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'
import { useFactionGroupStore } from '../../stores/factionGroupStore'
import { useFactionHallStore } from '../../stores/factionHallStore'
import { FactionCreateForm } from './FactionCreateForm'
import { CompanyInviteModal } from './CompanyInviteModal'
import { CompanyEmblem } from './CompanyEmblem'
import type { FactionDetail, MyFaction } from '../../stores/factionGroupStore'
import './FactionHallModal.css'

// Sources de points pour le détail par membre (icône + libellé).
const SOURCE_META: Record<string, { icon: string; label: string }> = {
  enigmes: { icon: '📜', label: 'énigmes' },
  visites: { icon: '📍', label: 'visites GPS' },
  ajouts:  { icon: '🏛️', label: 'lieux ajoutés' },
  veilles: { icon: '⚑', label: 'veilles' },
  photos:  { icon: '📷', label: 'photos' },
}
const SOURCE_ORDER = ['enigmes', 'visites', 'ajouts', 'veilles', 'photos']

interface Props {
  factionId: string
  onClose: () => void
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase()
}

/**
 * Rend la mission en n'autorisant QUE le gras <b> et les sauts de ligne — tout
 * le reste est échappé (pas d'injection HTML possible depuis un texte joueur).
 */
function renderMission(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .replace(/&lt;b&gt;/gi, '<b>')
    .replace(/&lt;\/b&gt;/gi, '</b>')
    .replace(/&lt;i&gt;/gi, '<i>')
    .replace(/&lt;\/i&gt;/gi, '</i>')
    .replace(/\n/g, '<br>')
}

/**
 * Hall de Compagnie — variante C (empilé, une colonne) : identité + mission +
 * classement (par Coupe ; le 1er = Chef, détrônable) + footer (Quitter / Éditer).
 * Mécanique = faction ; user-facing = « Compagnie ». Détail via get_faction_detail.
 */
export function FactionHallModal({ factionId, onClose }: Props) {
  const userId = usePlayerStore((s) => s.userId)
  const onBack = useFactionHallStore((s) => s.onBack)
  const leave = useFactionGroupStore((s) => s.leave)
  const join = useFactionGroupStore((s) => s.join)
  const removeMember = useFactionGroupStore((s) => s.removeMember)
  const switchBanner = useFactionGroupStore((s) => s.switchBanner)
  const myFactions = useFactionGroupStore((s) => s.myFactions)
  const activeFactionId = useFactionGroupStore((s) => s.activeFactionId)

  const [detail, setDetail] = useState<FactionDetail | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data } = await supabase.rpc('get_faction_detail', { p_faction_id: factionId })
    const d = data as FactionDetail | { error: string } | null
    if (d && !('error' in d)) setDetail(d)
  }, [factionId])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleLeave() {
    if (!userId) return
    setLeaving(true)
    const result = await leave(userId, factionId)
    setLeaving(false)
    if ('success' in result) onClose()
  }

  async function handleJoin() {
    if (!userId) return
    setJoining(true)
    setJoinError(null)
    const result = await join(userId, factionId)
    setJoining(false)
    if ('error' in result) {
      setJoinError(
        result.error === 'too_many' ? 'Tu fais déjà partie de 2 Compagnies.'
        : result.error === 'already_member' ? 'Tu es déjà membre.'
        : result.error === 'faction_full' ? 'Cette Compagnie est au complet pour l’instant — d’autres ont besoin de toi.'
        : 'Impossible de rejoindre pour le moment.'
      )
      return
    }
    reload()
  }

  async function handleRemove(targetId: string) {
    if (!userId) return
    setRemovingId(targetId)
    await removeMember(userId, factionId, targetId)
    setRemovingId(null)
    reload()
  }

  const overlayClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose() }

  if (!detail) {
    return createPortal(
      <div className="faction-hall-overlay" onClick={overlayClick}>
        <div className="faction-hall-loading">Chargement de la Compagnie…</div>
      </div>,
      document.body,
    )
  }

  // Chef = membre de plus haute Coupe (rang 1) ; détrônable.
  const chefId = detail.members[0]?.userId ?? null
  const isChef = chefId === userId
  const isMember = detail.members.some((m) => m.userId === userId)
  const atLimit = !isMember && myFactions.length >= 2
  const isActive = activeFactionId === factionId

  // Objet MyFaction minimal pour le formulaire d'édition.
  const editFaction: MyFaction = {
    id: detail.id, name: detail.name, color: detail.color, imageUrl: detail.imageUrl,
    emblemIcon: detail.emblemIcon, emblemMono: detail.emblemMono,
    description: detail.description, isOfficial: detail.isOfficial,
    memberCount: detail.memberCount, isActive: false, isFounder: isChef,
  }

  return createPortal(
    <div className="faction-hall-overlay" onClick={overlayClick}>
      <div className="faction-hall" style={{ borderTopColor: detail.color }}>
        <button className="faction-hall-close" onClick={onClose} aria-label="Fermer">×</button>

        <div className="faction-hall-scroll">
          {/* En-tête identité */}
          <div className="faction-hall-intro">
            {onBack && (
              <button className="faction-hall-back" onClick={() => { onBack(); onClose() }}>← Retour</button>
            )}
            <div className="faction-hall-eyebrow">
              <span className="faction-hall-dot" style={{ background: detail.color }} />
              Compagnie
            </div>
            <div className="faction-hall-head">
              <CompanyEmblem
                color={detail.color} name={detail.name} imageUrl={detail.imageUrl}
                emblemIcon={detail.emblemIcon} emblemMono={detail.emblemMono}
                size={56} radius={13}
              />
              <h2 className="faction-hall-name">{detail.name}</h2>
            </div>
            <div className="faction-hall-totals">
              <span>👥 <b>{detail.memberCount}</b> membre{detail.memberCount !== 1 ? 's' : ''}</span>
              <span>🏆 <b>{detail.totalCoupe.toLocaleString('fr-FR')}</b> coupe</span>
              {detail.totalCrowns > 0 && (
                <span>🪙 <b>{detail.totalCrowns.toLocaleString('fr-FR')}</b> investies</span>
              )}
            </div>
            {detail.tags && detail.tags.length > 0 && (
              <div className="faction-hall-tags">
                {detail.tags.map(t => (
                  <span key={t} className="faction-hall-tag" style={{ borderColor: detail.color, color: detail.color }}>{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Mission */}
          <div className="faction-hall-section">
            <h3 className="faction-hall-section-title">La mission</h3>
            {detail.description ? (
              <p className="faction-hall-mission-text"
                 dangerouslySetInnerHTML={{ __html: renderMission(detail.description) }} />
            ) : (
              <p className="faction-hall-mission-empty">Cette Compagnie n'a pas encore écrit sa mission.</p>
            )}
          </div>

          {/* Classement */}
          <div className="faction-hall-section" style={{ paddingBottom: 0 }}>
            <button className="faction-hall-invite" style={{ borderColor: detail.color, color: detail.color }} onClick={() => setShowInvite(true)}>
              👥 Inviter des amis
            </button>
            <h3 className="faction-hall-section-title">Classement de la Compagnie</h3>
          </div>
          <div className="faction-hall-rank">
            {detail.members.length === 0 && (
              <p className="faction-hall-rank-empty">Aucun membre.</p>
            )}
            {detail.members.map((m, i) => {
              const memberIsChef = i === 0
              const sources = SOURCE_ORDER
                .filter((k) => m.breakdown && m.breakdown[k as keyof typeof m.breakdown])
                .map((k) => ({ k, pts: m.breakdown![k as keyof typeof m.breakdown] as number }))
              const openProfile = () => {
                useMapStore.getState().setSelectedPlayerId(m.userId)
                onClose()
              }
              return (
                <div key={m.userId} className="faction-hall-rank-row"
                  style={memberIsChef ? { borderColor: detail.color, background: `${detail.color}14` } : undefined}>
                  <span className="faction-hall-rank-num" style={memberIsChef ? { color: detail.color } : undefined}>{i + 1}</span>
                  <button type="button" className="faction-hall-rank-id" onClick={openProfile}
                    title={`Voir le profil de ${m.name}`}>
                    {m.avatarUrl ? (
                      <img className="faction-hall-rank-avatar" src={m.avatarUrl} alt="" />
                    ) : (
                      <span className="faction-hall-rank-avatar" style={{ background: detail.color }}>{initials(m.name)}</span>
                    )}
                    <div className="faction-hall-rank-info">
                      <div className="faction-hall-rank-name">{m.name}</div>
                      {memberIsChef && (
                        <div className="faction-hall-rank-chef" style={{ color: detail.color }}>♛ Chef de Compagnie</div>
                      )}
                      {sources.length > 0 && (
                        <div className="faction-hall-rank-sources">
                          {sources.map(({ k, pts }) => (
                            <span key={k} className="faction-hall-rank-src" title={`${pts} pt${pts > 1 ? 's' : ''} — ${SOURCE_META[k].label}`}>
                              {SOURCE_META[k].icon} {pts}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                  {(() => {
                    const tresor = m.crownsInvested + (m.crownsConquered ?? 0)
                    return (
                      <span className="faction-hall-rank-stats">
                        🏆 {m.coupe.toLocaleString('fr-FR')}
                        {tresor > 0 && <>{'  '}🪙 {tresor.toLocaleString('fr-FR')}</>}
                      </span>
                    )
                  })()}
                  {isChef && !memberIsChef && m.userId !== userId && (
                    <button className="faction-hall-rank-remove" onClick={() => handleRemove(m.userId)}
                      disabled={removingId === m.userId} aria-label={`Exclure ${m.name}`}>
                      {removingId === m.userId ? '…' : '✕'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Bas du Hall : rejoindre (non-membre) = gros CTA central ; sinon footer discret */}
        {isMember ? (
          <div className="faction-hall-footer">
            <button className="faction-hall-leave" onClick={handleLeave} disabled={leaving}>
              {leaving ? 'En cours…' : 'Quitter la Compagnie'}
            </button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {isActive ? (
                <span className="faction-hall-activebadge" style={{ color: detail.color }}>⚑ Bannière active</span>
              ) : (
                <button className="faction-hall-setactive" style={{ background: detail.color }}
                  onClick={async () => { if (userId) await switchBanner(userId, factionId) }}>
                  ⚑ Porter ces couleurs
                </button>
              )}
              {isChef && (
                <button className="faction-hall-edit" onClick={() => setShowEdit(true)}>✎ Éditer</button>
              )}
            </div>
          </div>
        ) : (
          <div className="faction-hall-joinbar">
            <button
              className="faction-hall-join-big"
              style={{ background: (atLimit || detail.locked) ? undefined : detail.color }}
              onClick={handleJoin}
              disabled={joining || atLimit || !!detail.locked}
            >
              {joining ? 'En cours…'
                : atLimit ? 'Tu fais déjà partie de 2 Compagnies'
                : detail.locked ? '🔒 Compagnie complète'
                : '⚔️ Rejoindre cette Compagnie'}
            </button>
            {detail.locked && !atLimit && (
              <p className="faction-hall-joinerror">Cette Compagnie est au complet pour l’instant — d’autres ont besoin de toi.</p>
            )}
            {joinError && <p className="faction-hall-joinerror">{joinError}</p>}
          </div>
        )}
      </div>

      {/* Édition (Chef) */}
      {showEdit && isChef && userId && (
        <FactionCreateForm
          userId={userId}
          editFaction={editFaction}
          editTags={detail.tags}
          canDelete={detail.createdBy === userId}
          onSuccess={() => { setShowEdit(false); reload() }}
          onCancel={() => setShowEdit(false)}
          onDeleted={() => { setShowEdit(false); onClose() }}
        />
      )}

      {showInvite && (
        <CompanyInviteModal
          factionId={detail.id}
          shareKey={detail.publicSlug ?? detail.id}
          factionName={detail.name}
          color={detail.color}
          isChef={isChef}
          isMember={isMember}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>,
    document.body,
  )
}
