import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { usePlayerStore } from '../../stores/playerStore'
import { useCompanyStore } from '../../stores/companyStore'
import { CompanyCreateForm } from './CompanyCreateForm'
import { CompanyChatPanel } from './CompanyChatPanel'
import type { CompanyDetail } from '../../stores/companyStore'
import './CompanyHallModal.css'

interface Props {
  companyId: string
  onClose: () => void
}

function initials(name: string): string {
  return name.trim().slice(0, 2).toUpperCase()
}

/**
 * Hall de la Compagnie — version B. Modale centrale 2 colonnes (design repris
 * de la modale d'événement) : identité + mission à gauche, CLASSEMENT des
 * membres (par gloire ; le 1er = Chef de Compagnie, détrônable) à droite.
 * Le chat vit dans l'onglet Tchat (canal company_id) ; ici un bouton l'ouvre.
 * Mobile : onglets Infos / Classement.
 */
export function CompanyHallModal({ companyId, onClose }: Props) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const userId = usePlayerStore((s) => s.userId)
  const leave = useCompanyStore((s) => s.leave)
  const removeMember = useCompanyStore((s) => s.removeMember)

  const [tab, setTab] = useState<'info' | 'rank'>('info')
  const [detail, setDetail] = useState<CompanyDetail | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data } = await supabase.rpc('get_company', { p_company_id: companyId })
    const d = data as CompanyDetail | { error: string } | null
    if (d && !('error' in d)) setDetail(d)
  }, [companyId])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleLeave() {
    if (!userId) return
    setLeaving(true)
    const result = await leave(userId, companyId)
    setLeaving(false)
    if ('success' in result) onClose()
  }

  async function handleRemove(targetId: string) {
    if (!userId) return
    setRemovingId(targetId)
    await removeMember(userId, companyId, targetId)
    setRemovingId(null)
    reload()
  }

  const overlayClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose() }

  if (!detail) {
    return (
      <div className="company-hall-overlay" onClick={overlayClick}>
        <div className="company-hall-loading">Chargement du Hall…</div>
      </div>
    )
  }

  const isFounder = detail.founderUserId === userId
  const showInfo = !isMobile || tab === 'info'
  const showRank = !isMobile || tab === 'rank'

  return (
    <div className="company-hall-overlay" onClick={overlayClick}>
      <div className="company-hall" style={{ borderTopColor: detail.color }}>
        <button className="company-hall-close" onClick={onClose} aria-label="Fermer">×</button>

        {isMobile && (
          <div className="company-hall-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'info'}
              className={`company-hall-tab${tab === 'info' ? ' is-active' : ''}`}
              onClick={() => setTab('info')}>Infos</button>
            <button role="tab" aria-selected={tab === 'rank'}
              className={`company-hall-tab${tab === 'rank' ? ' is-active' : ''}`}
              onClick={() => setTab('rank')}>Classement</button>
          </div>
        )}

        <div className="company-hall-shell">

          {/* ===== GAUCHE : identité + mission ===== */}
          {showInfo && (
            <div className="company-hall-left">
              <div className="company-hall-main">
                <div className="company-hall-intro">
                  <div className="company-hall-eyebrow">
                    <span className="company-hall-eyebrow-dot" style={{ background: detail.color }} />
                    {detail.isOfficial ? 'Compagnie officielle' : 'Compagnie'}
                  </div>
                  <div className="company-hall-head">
                    {detail.imageUrl ? (
                      <img className="company-hall-emblem" src={detail.imageUrl} alt="" />
                    ) : (
                      <div className="company-hall-emblem company-hall-emblem-fallback" style={{ background: detail.color }}>
                        {detail.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <h2 className="company-hall-name">{detail.name}</h2>
                  </div>
                  <div className="company-hall-totals">
                    <span>👥 <b>{detail.memberCount}</b> membre{detail.memberCount !== 1 ? 's' : ''}</span>
                    <span>🏆 <b>{detail.totalGloire.toLocaleString('fr-FR')}</b> gloire</span>
                  </div>
                </div>

                <div className="company-hall-mission">
                  <h3 className="company-hall-section-title">La mission</h3>
                  {detail.description ? (
                    <p className="company-hall-mission-text">{detail.description}</p>
                  ) : (
                    <p className="company-hall-mission-empty">Cette Compagnie n'a pas encore écrit sa mission.</p>
                  )}
                </div>
              </div>

              <div className="company-hall-footer">
                <button className="company-hall-leave" onClick={handleLeave} disabled={leaving}>
                  {leaving ? 'En cours…' : 'Quitter la Compagnie'}
                </button>
                {isFounder && (
                  <button className="company-hall-edit" onClick={() => setShowEdit(true)}>✎ Éditer l'identité</button>
                )}
              </div>
            </div>
          )}

          {/* ===== DROITE : classement ===== */}
          {showRank && (
            <div className="company-hall-rank">
              <div className="company-hall-rank-header">
                <h3 className="company-hall-section-title">Classement de la Compagnie</h3>
                <div className="company-hall-rank-sub">le statut se gagne par les actes</div>
              </div>

              <div className="company-hall-rank-list">
                {detail.members.map((m, i) => {
                  const isChef = i === 0
                  return (
                    <div key={m.userId} className={`company-hall-rank-row${isChef ? ' is-chef' : ''}`}
                      style={isChef ? { borderColor: detail.color, background: `${detail.color}14` } : undefined}>
                      <span className="company-hall-rank-num" style={isChef ? { color: detail.color } : undefined}>{i + 1}</span>
                      <span className="company-hall-rank-avatar">{initials(m.name)}</span>
                      <div className="company-hall-rank-info">
                        <div className="company-hall-rank-name">{m.name}</div>
                        {isChef && (
                          <div className="company-hall-rank-chef" style={{ color: detail.color }}>♛ Chef de Compagnie</div>
                        )}
                        <div className="company-hall-rank-stats">🏆 {m.gloire.toLocaleString('fr-FR')} gloire</div>
                      </div>
                      {isFounder && !m.isFounder && m.userId !== userId && (
                        <button className="company-hall-rank-remove" onClick={() => handleRemove(m.userId)}
                          disabled={removingId === m.userId} aria-label={`Exclure ${m.name}`}>
                          {removingId === m.userId ? '…' : '✕'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="company-hall-rank-footer">
                <button className="company-hall-chat-link" onClick={() => setShowChat(true)}>💬 Ouvrir le canal de la Compagnie</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Édition (fondateur) */}
      {showEdit && isFounder && userId && (
        <CompanyCreateForm
          userId={userId}
          editCompany={{
            id: detail.id, name: detail.name, color: detail.color, imageUrl: detail.imageUrl,
            description: detail.description, isOfficial: detail.isOfficial, memberCount: detail.memberCount,
            isActive: false, isFounder: true,
          }}
          onSuccess={() => { setShowEdit(false); reload() }}
          onCancel={() => setShowEdit(false)}
        />
      )}

      {/* Canal (en attendant l'onglet Tchat) */}
      {showChat && (
        <div className="company-hall-chat-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowChat(false) }}>
          <div className="company-hall-chat-box">
            <button className="company-hall-close" onClick={() => setShowChat(false)} aria-label="Fermer">×</button>
            <CompanyChatPanel companyId={companyId} members={detail.members} accentColor={detail.color} fill />
          </div>
        </div>
      )}
    </div>
  )
}
