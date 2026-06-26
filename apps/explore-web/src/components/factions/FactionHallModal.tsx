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
import { readableInk, readableTextOn } from '../../lib/textFormat'
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
  const setGrades = useFactionGroupStore((s) => s.setGrades)
  const setPrimary = useFactionGroupStore((s) => s.setPrimary)
  const myFactions = useFactionGroupStore((s) => s.myFactions)
  const activeFactionId = useFactionGroupStore((s) => s.activeFactionId)

  const [detail, setDetail] = useState<FactionDetail | null>(null)
  // Vue active de la modale : roster (défaut) ou un éditeur PLEIN ÉCRAN qui remplace le contenu.
  const [view, setView] = useState<'roster' | 'grades' | 'identity'>('roster')
  const [showInvite, setShowInvite] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [settingPrimary, setSettingPrimary] = useState(false)
  const [primaryError, setPrimaryError] = useState<string | null>(null)
  const [gradeRows, setGradeRows] = useState<{ labelM: string; labelF: string; labelN: string; capacity: number | null }[]>([])
  const [govern, setGovern] = useState(2)
  const [savingGrades, setSavingGrades] = useState(false)
  const [gradeError, setGradeError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data } = await supabase.rpc('get_faction_detail', { p_faction_id: factionId })
    const d = data as FactionDetail | { error: string } | null
    if (d && !('error' in d)) setDetail(d)
  }, [factionId])

  useEffect(() => { reload() }, [reload])

  // Defaults pour les 4 grades si la Compagnie n'a pas de libellés custom.
  const GRADE_DEFAULTS: { labelM: string; labelF: string; labelN: string; capacity: number | null }[] = [
    { labelM: 'Seigneur',    labelF: 'Dame',      labelN: '', capacity: 1    },
    { labelM: 'Co-seigneur', labelF: 'Co-dame',   labelN: '', capacity: 1    },
    { labelM: 'Officier',    labelF: 'Officière', labelN: '', capacity: 3    },
    { labelM: 'Membre',      labelF: 'Membre',    labelN: '', capacity: null },
  ]

  useEffect(() => {
    if (!detail) return
    const src = detail.grades
    if (src && src.length > 0) {
      setGradeRows(src.map((g) => ({ labelM: g.labelM, labelF: g.labelF, labelN: g.labelN ?? '', capacity: g.capacity ?? null })))
    } else {
      setGradeRows(GRADE_DEFAULTS)
    }
    setGovern(detail.governGrades ?? 2)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id])

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

  async function handleSetPrimary() {
    if (!userId || !detail) return
    const ok = window.confirm(
      `Désigner « ${detail.name} » comme ta Compagnie principale ?\n\n` +
      `Tes territoires passeront à ses couleurs et tes prochains points lui reviendront. ` +
      `Tu ne pourras pas en changer avant un mois.`
    )
    if (!ok) return
    setSettingPrimary(true)
    setPrimaryError(null)
    const result = await setPrimary(userId, factionId)
    setSettingPrimary(false)
    if ('error' in result) {
      const d = result.daysRemaining ?? 30
      setPrimaryError(
        result.error === 'cooldown'
          ? `Tu as changé de Compagnie principale récemment — réessaie dans ${d} jour${d > 1 ? 's' : ''}.`
          : 'Impossible pour le moment.'
      )
      return
    }
    reload()
  }

  async function handleSaveGrades() {
    if (!detail) return
    setSavingGrades(true)
    setGradeError(null)
    const payload = gradeRows.map((r, i) => ({
      label_m: r.labelM,
      label_f: r.labelF,
      label_n: r.labelN || undefined,
      capacity: i === gradeRows.length - 1 ? null : Math.max(1, r.capacity ?? 1),
    }))
    const result = await setGrades(detail.id, payload, govern)
    setSavingGrades(false)
    if ('error' in result) {
      setGradeError(
        result.error === 'bad_grade_count' ? 'Il faut entre 2 et 6 grades.'
        : result.error === 'not_governing' ? "Tu n'as pas les pouvoirs requis."
        : result.error === 'unauthorized' ? 'Action non autorisée.'
        : "Impossible d'enregistrer pour le moment."
      )
      return
    }
    setView('roster')
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

  // Chef = membre PRINCIPAL de plus haute Coupe ; détrônable. L'allié (trié en dernier,
  // 0 point) ne peut jamais être Chef.
  const topMember = detail.members[0]
  const chefId = topMember && !topMember.isAlly ? topMember.userId : null
  const isChef = chefId !== null && chefId === userId

  // Grade du viewer → gouvernance = grades 1..governGrades (seuil réglé par le Chef).
  // Aligné sur le gate serveur (update_faction_identity / set_faction_grades / remove_member).
  const myGradeRank = detail.members.find((m) => m.userId === userId)?.gradeRank ?? 99
  const canGovern = myGradeRank <= (detail.governGrades ?? 2)

  // Rang affiché = position parmi les membres PRINCIPAUX uniquement (allié = hors classement).
  let rankCounter = 0
  const ranked = detail.members.map((m) => {
    if (!m.isAlly) rankCounter += 1
    return { m, rank: m.isAlly ? null : rankCounter }
  })
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

  // Couleur de Compagnie pour le rendu (le joueur peut choisir n'importe quelle teinte,
  // y compris le blanc) : `ink` = version lisible en texte/bordure sur le parchemin ;
  // `onColor` = texte lisible POSÉ sur une pastille pleine de la vraie couleur.
  const ink = readableInk(detail.color)
  const onColor = readableTextOn(detail.color)

  // ── VUE : éditeur de grades (remplace tout le contenu de la modale) ──
  if (view === 'grades') {
    const isCatchAll = (i: number) => i === gradeRows.length - 1
    const rankLabel = (i: number) => {
      if (i === 0) return `Grade 1 — sommet`
      if (isCatchAll(i)) return `Grade ${i + 1} — reste (tous les autres)`
      return `Grade ${i + 1}`
    }
    return createPortal(
      <div className="faction-hall-overlay" onClick={overlayClick}>
        <div className="faction-hall" style={{ borderTopColor: ink }}>
          <button className="faction-hall-close" onClick={onClose} aria-label="Fermer">×</button>
          <div className="faction-hall-subview">
            <div className="faction-hall-subhead">
              <button className="faction-hall-back" onClick={() => setView('roster')}>← Retour</button>
              <h2 className="faction-hall-subtitle">Structure des grades</h2>
            </div>
            <p className="faction-hall-subhint">
              Compose l'échelle de ta Compagnie (2 à 6 grades). Le dernier grade regroupe tous les membres non couverts par les grades supérieurs.
            </p>
            <div className="faction-hall-subbody">
              <div className="faction-hall-grade-rows">
                {gradeRows.map((row, i) => (
                  <div key={i} className="faction-hall-grade-row">
                    <div className="faction-hall-grade-row-header">
                      <span className="faction-hall-grade-rank-label">{rankLabel(i)}</span>
                      {!isCatchAll(i) && gradeRows.length > 2 && (
                        <button
                          type="button"
                          className="faction-hall-grade-remove"
                          aria-label={`Supprimer le grade ${i + 1}`}
                          onClick={() => {
                            const next = gradeRows.filter((_, idx) => idx !== i)
                            setGradeRows(next)
                            if (govern >= next.length) setGovern(next.length - 1)
                          }}
                        >✕</button>
                      )}
                    </div>
                    <div className="faction-hall-grade-inputs">
                      <label className="faction-hall-grade-field">
                        <span>Masculin</span>
                        <input type="text" className="faction-hall-grade-input" value={row.labelM} maxLength={30}
                          onChange={(e) => { const next = [...gradeRows]; next[i] = { ...next[i], labelM: e.target.value }; setGradeRows(next) }} />
                      </label>
                      <label className="faction-hall-grade-field">
                        <span>Féminin</span>
                        <input type="text" className="faction-hall-grade-input" value={row.labelF} maxLength={30}
                          onChange={(e) => { const next = [...gradeRows]; next[i] = { ...next[i], labelF: e.target.value }; setGradeRows(next) }} />
                      </label>
                      {isCatchAll(i) ? (
                        <span className="faction-hall-grade-catchall">← regroupe le reste</span>
                      ) : (
                        <label className="faction-hall-grade-field faction-hall-grade-field-cap">
                          <span>Capacité (membres max)</span>
                          <input
                            type="number"
                            min={1}
                            className="faction-hall-grade-input faction-hall-grade-input-cap"
                            value={row.capacity ?? 1}
                            onChange={(e) => {
                              const next = [...gradeRows]
                              next[i] = { ...next[i], capacity: Math.max(1, parseInt(e.target.value, 10) || 1) }
                              setGradeRows(next)
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {gradeRows.length < 6 && (
                <button
                  type="button"
                  className="faction-hall-grade-add"
                  onClick={() => {
                    const next = [...gradeRows]
                    next.splice(next.length - 1, 0, { labelM: '', labelF: '', labelN: '', capacity: 1 })
                    setGradeRows(next)
                  }}
                >
                  + Ajouter un grade
                </button>
              )}

              {isChef && (
                <div className="faction-hall-grade-govern">
                  <label className="faction-hall-grade-govern-label">
                    <span>Pouvoirs d'édition, d'invitation et d'exclusion</span>
                    <select
                      className="faction-hall-grade-govern-select"
                      value={govern}
                      onChange={(e) => setGovern(parseInt(e.target.value, 10))}
                    >
                      {Array.from({ length: gradeRows.length - 1 }, (_, idx) => idx + 1).map((n) => (
                        <option key={n} value={n}>Jusqu'au grade {n}</option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              {gradeError && <p className="faction-hall-joinerror" style={{ marginTop: 8, textAlign: 'left' }}>{gradeError}</p>}
            </div>
            <div className="faction-hall-subfooter">
              <button className="faction-hall-grade-save" onClick={handleSaveGrades} disabled={savingGrades}>
                {savingGrades ? 'Enregistrement…' : 'Enregistrer les grades'}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  // ── VUE : édition d'identité (formulaire embarqué dans la modale) ──
  if (view === 'identity' && userId) {
    return createPortal(
      <div className="faction-hall-overlay" onClick={overlayClick}>
        <div className="faction-hall" style={{ borderTopColor: ink }}>
          <button className="faction-hall-close" onClick={onClose} aria-label="Fermer">×</button>
          <div className="faction-hall-subview">
            <div className="faction-hall-subhead">
              <button className="faction-hall-back" onClick={() => setView('roster')}>← Retour</button>
            </div>
            <div className="faction-hall-subbody faction-hall-subbody-flush">
              <FactionCreateForm
                embedded
                userId={userId}
                editFaction={editFaction}
                editTags={detail.tags}
                canDelete={myGradeRank === 1 && !detail.isOfficial}
                onSuccess={() => { setView('roster'); reload() }}
                onCancel={() => setView('roster')}
                onDeleted={() => { setView('roster'); onClose() }}
              />
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  // ── VUE : roster (par défaut) ──
  return createPortal(
    <div className="faction-hall-overlay" onClick={overlayClick}>
      <div className="faction-hall" style={{ borderTopColor: ink }}>
        <button className="faction-hall-close" onClick={onClose} aria-label="Fermer">×</button>

        <div className="faction-hall-scroll">
          {/* En-tête identité */}
          <div className="faction-hall-intro">
            {onBack && (
              <button className="faction-hall-back" onClick={() => { onBack(); onClose() }}>← Retour</button>
            )}
            <div className="faction-hall-eyebrow">
              <span className="faction-hall-dot" style={{ background: detail.color, border: `1px solid ${ink}` }} />
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
                  <span key={t} className="faction-hall-tag" style={{ borderColor: ink, color: ink }}>{t}</span>
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
            <button className="faction-hall-invite" style={{ borderColor: ink, color: ink }} onClick={() => setShowInvite(true)}>
              👥 Inviter des amis
            </button>
            <h3 className="faction-hall-section-title">Classement de la Compagnie</h3>
          </div>
          <div className="faction-hall-rank">
            {detail.members.length === 0 && (
              <p className="faction-hall-rank-empty">Aucun membre.</p>
            )}
            {ranked.map(({ m, rank }) => {
              const memberIsChef = m.userId === chefId
              const sources = SOURCE_ORDER
                .filter((k) => m.breakdown && m.breakdown[k as keyof typeof m.breakdown])
                .map((k) => ({ k, pts: m.breakdown![k as keyof typeof m.breakdown] as number }))
              const openProfile = () => {
                useMapStore.getState().setSelectedPlayerId(m.userId)
                onClose()
              }
              return (
                <div key={m.userId} className="faction-hall-rank-row"
                  style={memberIsChef ? { borderColor: ink, background: `${detail.color}14` } : undefined}>
                  <span className="faction-hall-rank-num" style={memberIsChef ? { color: ink } : undefined}>{rank ?? '·'}</span>
                  <button type="button" className="faction-hall-rank-id" onClick={openProfile}
                    title={`Voir le profil de ${m.name}`}>
                    {m.avatarUrl ? (
                      <img className="faction-hall-rank-avatar" src={m.avatarUrl} alt="" />
                    ) : (
                      <span className="faction-hall-rank-avatar" style={{ background: detail.color, color: onColor, border: '1px solid rgba(61,47,32,0.15)' }}>{initials(m.name)}</span>
                    )}
                    <div className="faction-hall-rank-info">
                      <div className="faction-hall-rank-name">{m.name}</div>
                      {m.gradeLabel && (
                        <span className="faction-hall-rank-grade" style={{ color: ink }}>
                          {m.gradeRank === 1 ? '♛ ' : ''}{m.gradeLabel}
                        </span>
                      )}
                      {m.isFounder && (
                        <span className="faction-hall-rank-founder">{m.titleGender === 'f' ? 'Fondatrice' : 'Fondateur'} historique</span>
                      )}
                      {m.isAlly && (
                        <div className="faction-hall-rank-ally">🤝 Allié</div>
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
                    const conquis = m.crownsConquered ?? 0
                    return (
                      <span className="faction-hall-rank-stats">
                        🏆 {m.coupe.toLocaleString('fr-FR')}
                        {m.crownsInvested > 0 && (
                          <span title={`${m.crownsInvested} points de fondation`}>{'  '}⭐ {m.crownsInvested.toLocaleString('fr-FR')}</span>
                        )}
                        {conquis > 0 && <span title={`${conquis} couronnes conquises`}>{'  '}🪙 {conquis.toLocaleString('fr-FR')}</span>}
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
          <>
            <div className="faction-hall-footer">
              <button className="faction-hall-leave" onClick={handleLeave} disabled={leaving}>
                {leaving ? 'En cours…' : 'Quitter la Compagnie'}
              </button>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {isActive ? (
                  <span className="faction-hall-activebadge" style={{ color: ink }}>⚑ Compagnie principale</span>
                ) : (
                  <button className="faction-hall-setactive" style={{ background: detail.color, color: onColor, borderColor: ink }}
                    onClick={handleSetPrimary} disabled={settingPrimary}>
                    {settingPrimary ? '…' : '⚑ Désigner comme principale'}
                  </button>
                )}
                {canGovern && (
                  <button className="faction-hall-edit" onClick={() => setView('identity')}>✎ Éditer</button>
                )}
                {canGovern && (
                  <button className="faction-hall-edit" onClick={() => setView('grades')}>✦ Grades</button>
                )}
              </div>
            </div>
            {primaryError && (
              <p className="faction-hall-joinerror" style={{ padding: '0 16px 12px' }}>{primaryError}</p>
            )}
          </>
        ) : (
          <div className="faction-hall-joinbar">
            <button
              className="faction-hall-join-big"
              style={(atLimit || detail.locked) ? undefined : { background: detail.color, color: onColor, borderColor: ink }}
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
