import { useEffect, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  getExpedition,
  requestJoinExpedition,
  respondJoinRequest,
  withdrawFromExpedition,
  ejectExpeditionParticipant,
  cancelExpedition,
  updateExpeditionCall,
  flagExpedition,
} from '../../lib/expeditionsApi'
import { useExpeditionsStore } from '../../stores/expeditionsStore'
import { usePlayerStore } from '../../stores/playerStore'
import { ExpeditionChat } from './ExpeditionChat'
import { ExpeditionGallery } from './ExpeditionGallery'
import { ReportEditor } from './ReportEditor'
import { formatRelativeRdv } from '../../lib/expeditionDateFormat'
import type { ExpeditionReport } from '../../types/expedition'
import './ExpeditionModal.css'

interface Props {
  expeditionId: string
  onClose: () => void
}

export function ExpeditionModal({ expeditionId, onClose }: Props) {
  const myUserId = usePlayerStore((s) => s.userId)
  const current = useExpeditionsStore((s) => s.current)
  const setCurrent = useExpeditionsStore((s) => s.setCurrent)
  const [loading, setLoading] = useState(true)
  const [requestMessage, setRequestMessage] = useState('')
  const [editingCall, setEditingCall] = useState(false)
  const [callDraft, setCallDraft] = useState('')
  const [reportEditorOpen, setReportEditorOpen] = useState(false)
  const [flagOpen, setFlagOpen] = useState(false)

  // Charge le détail à l'ouverture / refresh
  async function refresh() {
    try {
      const payload = await getExpedition(expeditionId)
      setCurrent(payload)
      setCallDraft(payload.expedition.call_text ?? '')
    } catch {
      // l'expé n'est plus accessible
      onClose()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    refresh()
    return () => setCurrent(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expeditionId])

  // Lookup participants pour le chat (avatar + faction)
  const participantsById = useMemo(() => {
    if (!current) return {}
    const map: Record<string, { display_name: string; avatar_url: string | null; faction_color: string | null }> = {}
    if (current.chief && current.chief.user_id) {
      map[current.chief.user_id] = {
        display_name: current.chief.display_name,
        avatar_url: current.chief.avatar_url,
        faction_color: current.chief.faction_color,
      }
    }
    const validated = current.validated_participants ?? []
    for (const p of validated) {
      if (!p || !p.user_id) continue
      map[p.user_id] = {
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        faction_color: p.faction_color,
      }
    }
    return map
  }, [current])

  if (loading || !current || !current.expedition || !current.chief) {
    return createPortal(
      <div className="expedition-modal-overlay" onClick={onClose}>
        <div className="expedition-modal-loading">Chargement…</div>
      </div>,
      document.body,
    )
  }

  const e = current.expedition
  const chief = current.chief
  const validatedParticipants = current.validated_participants ?? []
  const pendingParticipants = current.pending_participants ?? []
  const reports = current.reports ?? []
  const isChief = current.my_status === 'chief'
  const isValidated = current.my_status === 'validated'
  const isPending = current.my_status === 'pending'
  const isMember = isChief || isValidated
  const canEditCall = isMember && (e.status === 'published' || e.status === 'passed')
  const canRequest = !isChief && !isValidated && !isPending && e.status === 'published'
  const validatedCount = validatedParticipants.length + 1 // chef inclus
  const isFull = !e.slots_open && e.slots_max != null && validatedCount >= e.slots_max
  const myReport = reports.find((r) => r.user_id === myUserId) ?? null

  async function handleAccept(targetUserId: string) {
    await respondJoinRequest(expeditionId, targetUserId, 'accept')
    refresh()
  }
  async function handleReject(targetUserId: string) {
    await respondJoinRequest(expeditionId, targetUserId, 'reject')
    refresh()
  }
  async function handleEject(targetUserId: string) {
    if (!confirm('Éjecter ce voyageur ?')) return
    await ejectExpeditionParticipant(expeditionId, targetUserId)
    refresh()
  }
  async function handleRequest() {
    const r = await requestJoinExpedition(expeditionId, requestMessage.trim() || null)
    if (r.success) refresh()
  }
  async function handleWithdraw() {
    if (!confirm('Te retirer de cette expédition ?')) return
    await withdrawFromExpedition(expeditionId)
    onClose()
  }
  async function handleCancel() {
    if (!confirm('Annuler définitivement cette expédition ?')) return
    await cancelExpedition(expeditionId)
    onClose()
  }
  async function handleSaveCall() {
    await updateExpeditionCall(expeditionId, callDraft.trim() || null)
    setEditingCall(false)
    refresh()
  }
  function onReportSaved() {
    setReportEditorOpen(false)
    refresh()
  }

  return createPortal(
    <div className="expedition-modal-overlay" onClick={onClose}>
      <div className="expedition-modal" onClick={(ev) => ev.stopPropagation()}>
        <header className="expedition-modal-header">
          <div className="expedition-modal-pin" />
          <div>
            <div className="expedition-modal-eyebrow">
              {isChief ? 'Ton expédition' : 'Expédition'} · {formatRelativeRdv(e.rdv_at)}
            </div>
            <h2 className="expedition-modal-title">{e.name}</h2>
            {e.rdv_label && <div className="expedition-modal-when">{e.rdv_label}</div>}
          </div>
          <button className="expedition-modal-close" onClick={onClose} aria-label="Fermer">×</button>
        </header>

        {/* L'appel */}
        {(e.call_text || canEditCall) && (
          <section className="expedition-modal-call">
            <div className="expedition-modal-call-label">
              L'appel
              {canEditCall && !editingCall && (
                <button className="expedition-modal-call-edit" onClick={() => setEditingCall(true)}>
                  ✎ modifier
                </button>
              )}
            </div>
            {editingCall ? (
              <div className="expedition-modal-call-edit-row">
                <textarea
                  value={callDraft}
                  maxLength={200}
                  onChange={(ev) => setCallDraft(ev.target.value)}
                  placeholder="Une phrase qui dit pourquoi on y va…"
                />
                <div className="expedition-modal-call-actions">
                  <button onClick={() => setEditingCall(false)}>Annuler</button>
                  <button onClick={handleSaveCall} className="is-primary">Enregistrer</button>
                </div>
              </div>
            ) : (
              <div className="expedition-modal-call-text">
                « {e.call_text} »
              </div>
            )}
          </section>
        )}

        {/* Body 2 colonnes : main (gauche, 70%) + chat (droite, 30%, si membre) */}
        <div className="expedition-modal-body">
          <div className="expedition-modal-main">

        {/* Description */}
        {e.description && (
          <section className="expedition-modal-description">{e.description}</section>
        )}

        {/* Bloc info */}
        <section className="expedition-modal-info">
          <InfoRow icon="📅" label="Date" value={
            e.rdv_at
              ? new Date(e.rdv_at).toLocaleString('fr-FR', {
                  weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                })
              : 'À définir avec les compagnons'
          } />
          <InfoRow
            icon="👤"
            label="Chef"
            value={
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {chief.display_name}
                {chief.faction_title && chief.faction_color && (
                  <HeritageTag title={chief.faction_title} color={chief.faction_color} />
                )}
              </span>
            }
          />
          <InfoRow icon="👥" label="Compagnons" value={
            e.slots_open
              ? `${validatedCount} inscrits (ouvert)`
              : `${validatedCount} / ${e.slots_max}`
          } />
          <InfoRow icon="🔒" label="Inscription" value={
            e.validation_mode === 'manual' ? 'Validation du chef' : 'Inscription libre'
          } />
        </section>

        {/* Pending (chef) */}
        {isChief && pendingParticipants.length > 0 && (
          <section className="expedition-modal-section">
            <h3>Demandes en attente · {pendingParticipants.length}</h3>
            <ul className="expedition-modal-pending-list">
              {pendingParticipants.map((p) => (
                <li key={p.user_id} className="expedition-modal-pending-card">
                  <div className="expedition-modal-pending-head">
                    <Avatar name={p.display_name} avatarUrl={p.avatar_url} factionColor={p.faction_color} />
                    <div>
                      <strong>{p.display_name}</strong>
                      {p.faction_title && p.faction_color && (
                        <div style={{ marginTop: 2 }}>
                          <HeritageTag title={p.faction_title} color={p.faction_color} />
                        </div>
                      )}
                    </div>
                  </div>
                  {p.request_message && (
                    <div className="expedition-modal-pending-msg">« {p.request_message} »</div>
                  )}
                  <div className="expedition-modal-pending-actions">
                    <button
                      className="emm-btn-mini emm-btn-accept"
                      onClick={() => handleAccept(p.user_id)}
                      disabled={isFull}
                    >
                      {isFull ? 'Complet' : 'Accepter'}
                    </button>
                    <button className="emm-btn-mini" onClick={() => handleReject(p.user_id)}>Décliner</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Validés */}
        <section className="expedition-modal-section">
          <h3>Compagnons validés · {validatedCount}</h3>
          <ul className="expedition-modal-companions-list">
            <li className="expedition-modal-companion">
              <Avatar
                name={chief.display_name}
                avatarUrl={chief.avatar_url}
                factionColor={chief.faction_color}
              />
              <div className="expedition-modal-companion-info">
                <div className="expedition-modal-companion-name">{chief.display_name}</div>
                <div className="expedition-modal-companion-meta">
                  <span className="emm-pill-chief">Chef</span>
                  {chief.faction_title && chief.faction_color && (
                    <HeritageTag title={chief.faction_title} color={chief.faction_color} />
                  )}
                </div>
              </div>
            </li>
            {validatedParticipants.map((p) => (
              <li key={p.user_id} className="expedition-modal-companion">
                <Avatar name={p.display_name} avatarUrl={p.avatar_url} factionColor={p.faction_color} />
                <div className="expedition-modal-companion-info">
                  <div className="expedition-modal-companion-name">{p.display_name}</div>
                  {p.faction_title && p.faction_color && (
                    <HeritageTag title={p.faction_title} color={p.faction_color} />
                  )}
                </div>
                {isChief && (
                  <button className="emm-btn-mini" onClick={() => handleEject(p.user_id)}>Éjecter</button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Demande à rejoindre (non-membre) */}
        {canRequest && (
          <section className="expedition-modal-request">
            <label>
              Un mot pour le chef (optionnel · 280 caractères)
            </label>
            <textarea
              value={requestMessage}
              maxLength={280}
              onChange={(ev) => setRequestMessage(ev.target.value)}
              placeholder="« J'apporte un thermos de café et un peu de pain noir. »"
            />
            <button className="emm-btn-primary" onClick={handleRequest}>
              {e.validation_mode === 'free' ? 'Rejoindre' : 'Demander à rejoindre'}
            </button>
          </section>
        )}
        {isPending && (
          <section className="expedition-modal-status">
            Demande envoyée — en attente du chef
          </section>
        )}

        {/* Comptes rendus (date passée) */}
        {(e.status === 'passed' || e.status === 'archived') && (
          <section className="expedition-modal-section">
            <h3>Comptes rendus · galerie</h3>
            <ExpeditionGallery reports={reports} />
            <ReportsList reports={reports} myUserId={myUserId} />
            {isMember && !reportEditorOpen && (
              <button className="emm-btn-primary" onClick={() => setReportEditorOpen(true)}>
                {myReport ? 'Modifier mon compte rendu' : 'Laisser mon compte rendu'}
              </button>
            )}
            {reportEditorOpen && (
              <ReportEditor
                expeditionId={expeditionId}
                existingReport={myReport}
                onSaved={onReportSaved}
                onCancel={() => setReportEditorOpen(false)}
              />
            )}
          </section>
        )}

          </div>{/* /expedition-modal-main */}

          {/* Colonne droite : chat (membres seulement, status published/passed) */}
          {isMember && (e.status === 'published' || e.status === 'passed') && (
            <aside className="expedition-modal-chat-col">
              <div className="expedition-modal-chat-col-header">
                <h3>Préparation · chat privé</h3>
              </div>
              <ExpeditionChat
                expeditionId={expeditionId}
                participantsById={participantsById}
                readOnly={e.status === 'passed'}
              />
            </aside>
          )}
        </div>{/* /expedition-modal-body */}

        {/* Footer */}
        <footer className="expedition-modal-footer">
          <button className="expedition-modal-flag" onClick={() => setFlagOpen(true)}>
            Signaler
          </button>
          {isValidated && e.status === 'published' && (
            <button className="emm-btn-secondary" onClick={handleWithdraw}>Se retirer</button>
          )}
          {isChief && e.status === 'published' && (
            <button className="emm-btn-cancel" onClick={handleCancel}>Annuler l'expédition</button>
          )}
        </footer>

        {flagOpen && (
          <FlagDialog
            expeditionId={expeditionId}
            onClose={() => setFlagOpen(false)}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}

// ─────────── Sub-components inline ───────────

function InfoRow({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="emm-info-row">
      <span className="emm-info-icon">{icon}</span>
      <div>
        <span className="emm-info-label">{label}</span>
        <span className="emm-info-value">{value}</span>
      </div>
    </div>
  )
}

function HeritageTag({ title, color }: { title: string; color: string }) {
  return (
    <span
      className="emm-heritage-tag"
      style={{ background: `${color}22`, color }}
    >
      <span className="emm-heritage-dot" style={{ background: color }} />
      {title}
    </span>
  )
}

function Avatar({ name, avatarUrl, factionColor }: {
  name: string; avatarUrl: string | null; factionColor: string | null
}) {
  const initials = (name || '?').slice(0, 2).toUpperCase()
  const style = factionColor
    ? { boxShadow: `0 0 0 2px #faf2dd, 0 0 0 4px ${factionColor}` }
    : undefined
  return (
    <span className="emm-avatar" style={style}>
      {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
    </span>
  )
}

function ReportsList({ reports, myUserId }: { reports: ExpeditionReport[]; myUserId: string | null }) {
  if (reports.length === 0) {
    return <div className="emm-empty">Pas encore de compte rendu posé.</div>
  }
  return (
    <div className="emm-reports-list">
      {reports.map((r) => (
        <div key={r.user_id} className="emm-report-card">
          <div className="emm-report-author">
            <Avatar name={r.display_name} avatarUrl={r.avatar_url} factionColor={r.faction_color} />
            <div>
              <strong>{r.display_name}</strong>
              {r.faction_title && r.faction_color && (
                <div style={{ marginTop: 2 }}>
                  <HeritageTag title={r.faction_title} color={r.faction_color} />
                </div>
              )}
            </div>
            {r.is_public && <span className="emm-report-badge">Public</span>}
            {r.user_id === myUserId && <span className="emm-report-badge emm-report-badge-mine">Toi</span>}
          </div>
          {r.text_content && <div className="emm-report-text">{r.text_content}</div>}
        </div>
      ))}
    </div>
  )
}

function FlagDialog({ expeditionId, onClose }: { expeditionId: string; onClose: () => void }) {
  const [reason, setReason] = useState<'spam' | 'inappropriate' | 'other'>('spam')
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSend() {
    setSending(true)
    await flagExpedition(expeditionId, reason, comment.trim() || null)
    setSending(false)
    setDone(true)
    setTimeout(onClose, 1500)
  }

  return (
    <div className="emm-flag-dialog" onClick={(e) => e.stopPropagation()}>
      <h4>Signaler cette expédition</h4>
      {done ? (
        <div className="emm-flag-done">Merci, signalement envoyé.</div>
      ) : (
        <>
          <div className="emm-flag-options">
            {([
              ['spam', 'Spam / publicité'],
              ['inappropriate', 'Contenu inapproprié'],
              ['other', 'Autre'],
            ] as const).map(([val, label]) => (
              <label key={val} className="emm-flag-radio">
                <input
                  type="radio"
                  name="flag-reason"
                  value={val}
                  checked={reason === val}
                  onChange={() => setReason(val)}
                />
                {label}
              </label>
            ))}
          </div>
          <textarea
            value={comment}
            maxLength={500}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Précisions (optionnel)"
          />
          <div className="emm-flag-actions">
            <button onClick={onClose}>Annuler</button>
            <button onClick={handleSend} disabled={sending} className="is-primary">
              {sending ? 'Envoi…' : 'Envoyer le signalement'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
