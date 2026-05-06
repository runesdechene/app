import { useEffect, useState, useMemo, useCallback } from 'react'
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
  getExpeditionCoverUrl,
} from '../../lib/expeditionsApi'
import { useExpeditionsStore } from '../../stores/expeditionsStore'
import { usePlayerStore } from '../../stores/playerStore'
import { useMapStore } from '../../stores/mapStore'
import { ExpeditionChat } from './ExpeditionChat'
import { ExpeditionGallery } from './ExpeditionGallery'
import { ReportEditor } from './ReportEditor'
import { ExpeditionCreator } from './ExpeditionCreator'
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
  const [editorOpen, setEditorOpen] = useState(false)
  const [flagOpen, setFlagOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState<'info' | 'chat'>('info')

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

  // Ouvre le profil d'un voyageur — ferme la modale d'expédition au passage.
  const openProfile = useCallback((userId: string) => {
    if (!userId) return
    useMapStore.getState().setSelectedPlayerId(userId)
    onClose()
  }, [onClose])

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
  // Edition inline de l'appel : réservée aux validés non-chef.
  // Le chef passe par le bouton "✎ Modifier" du header (édition globale).
  const canEditCall = isValidated && !isChief && (e.status === 'published' || e.status === 'passed')
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


  const chatVisible = isMember && (e.status === 'published' || e.status === 'passed')

  return createPortal(
    <div className="expedition-modal-overlay" onClick={onClose}>
      <div
        className={`expedition-modal${chatVisible && !editorOpen ? ` mobile-tab-${mobileTab}` : ''}`}
        onClick={(ev) => ev.stopPropagation()}
      >

        {/* Tabs mobile-only — placées TOUT EN HAUT pour qu'elles soient
            l'élément de navigation principal sur mobile. Le header (titre,
            etc.) descend en dessous et n'apparaît que sur le tab Expédition.
            Cachées en mode édition — pas pertinentes. */}
        {chatVisible && !editorOpen && (
          <div className="expedition-modal-mobile-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'info'}
              className={`expedition-modal-mobile-tab${mobileTab === 'info' ? ' is-active' : ''}`}
              onClick={() => setMobileTab('info')}
            >Expédition</button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'chat'}
              className={`expedition-modal-mobile-tab${mobileTab === 'chat' ? ' is-active' : ''}`}
              onClick={() => setMobileTab('chat')}
            >Chat</button>
            <button
              type="button"
              className="expedition-modal-mobile-tab-close"
              onClick={onClose}
              aria-label="Fermer"
            >×</button>
          </div>
        )}

        {/* Topbar : visible UNIQUEMENT en mode édition (titre 'Modifier
            l'expédition' + ← retour + ×). En mode info, on n'affiche
            rien — les actions ✎ et × flottent en absolute top-right
            (cf. .expedition-modal-floating). */}
        {editorOpen && (
          <div className="expedition-modal-topbar is-editing">
            <button
              className="expedition-modal-back"
              onClick={() => setEditorOpen(false)}
              aria-label="Annuler l'édition"
              title="Annuler l'édition"
            >←</button>
            <h3 className="expedition-modal-topbar-title">Modifier l'expédition</h3>
            <button className="expedition-modal-close" onClick={onClose} aria-label="Fermer">×</button>
          </div>
        )}

        {/* Actions flottantes en absolute top-right — visibles en mode
            info uniquement. Le × est caché sur mobile-avec-chat (tabs
            l'ont déjà). */}
        {!editorOpen && (
          <div className="expedition-modal-floating">
            {isChief && e.status === 'published' && (
              <button
                className="expedition-modal-edit"
                onClick={() => setEditorOpen(true)}
                aria-label="Modifier l'expédition"
                title="Modifier l'expédition"
              >✎</button>
            )}
            <button
              className="expedition-modal-close floating-close"
              onClick={onClose}
              aria-label="Fermer"
            >×</button>
          </div>
        )}

        <div className={[
          'expedition-modal-shell',
          editorOpen && 'is-editing',
        ].filter(Boolean).join(' ')}>
        <div className="expedition-modal-left">

        <div className="expedition-modal-main">

        {editorOpen ? (
          <ExpeditionCreator
            embedded
            existing={current.expedition}
            onClose={() => setEditorOpen(false)}
            onCreated={() => {
              setEditorOpen(false)
              refresh()
            }}
          />
        ) : (
        <>
        {/* Bloc en-tête contextuel — eyebrow, titre, appel, lieu. Vit
            DANS le main scrollable (et plus dans un header sticky), pour
            que l'espace vertical visible soit maximal sur mobile. */}
        <div className="expedition-modal-intro">
          <div className="expedition-modal-eyebrow">
            {formatRelativeRdv(e.rdv_at)} · par {isChief
              ? 'toi'
              : <NameLink name={chief.display_name} onClick={() => openProfile(chief.user_id)} />}
          </div>
          <h2 className="expedition-modal-title">{e.name}</h2>

          {/* L'appel — intégré directement sous le titre, pas dans un bloc séparé */}
          {(e.call_text || canEditCall) && (
            <div className="expedition-modal-title-call">
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
                <>
                  {e.call_text && <span className="expedition-modal-call-text">« {e.call_text} »</span>}
                  {canEditCall && (
                    <button
                      className="expedition-modal-call-edit"
                      onClick={() => setEditingCall(true)}
                      title="Modifier l'appel"
                    >✎</button>
                  )}
                </>
              )}
            </div>
          )}

          {e.rdv_label && <div className="expedition-modal-when">{e.rdv_label}</div>}
        </div>

        {/* Cover image — visible si fournie. Modification via le bouton ✎ du header (chef). */}
        {e.cover_image_url && (
          <div className="expedition-modal-cover">
            <img src={getExpeditionCoverUrl(e.cover_image_url)} alt="" />
          </div>
        )}

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
            value={<NameLink name={chief.display_name} onClick={() => openProfile(chief.user_id)} />}
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
                    <Avatar
                      name={p.display_name}
                      avatarUrl={p.avatar_url}
                      factionColor={p.faction_color}
                      onClick={() => openProfile(p.user_id)}
                    />
                    <div>
                      <strong><NameLink name={p.display_name} onClick={() => openProfile(p.user_id)} /></strong>
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
                onClick={() => openProfile(chief.user_id)}
              />
              <div className="expedition-modal-companion-info">
                <div className="expedition-modal-companion-name">
                  <NameLink name={chief.display_name} onClick={() => openProfile(chief.user_id)} />
                </div>
                <div className="expedition-modal-companion-meta">
                  <span className="emm-pill-chief">Chef</span>
                </div>
              </div>
            </li>
            {validatedParticipants.map((p) => (
              <li key={p.user_id} className="expedition-modal-companion">
                <Avatar
                  name={p.display_name}
                  avatarUrl={p.avatar_url}
                  factionColor={p.faction_color}
                  onClick={() => openProfile(p.user_id)}
                />
                <div className="expedition-modal-companion-info">
                  <div className="expedition-modal-companion-name">
                    <NameLink name={p.display_name} onClick={() => openProfile(p.user_id)} />
                  </div>
                </div>
                {isChief && (
                  <button className="emm-btn-mini" onClick={() => handleEject(p.user_id)}>Éjecter</button>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Règles de l'explorateur érudit — bulles de bienséance bienveillante */}
        <section className="expedition-modal-section expedition-modal-rules">
          <h3>Règles de l'explorateur érudit</h3>
          <div className="expedition-modal-rules-grid">
            <div className="emm-rule">
              <span className="emm-rule-icon">🤝</span>
              <div>
                <strong>L'humain avant tout</strong>
                <small>Respect, bienveillance, camaraderie.</small>
              </div>
            </div>
            <div className="emm-rule">
              <span className="emm-rule-icon">🗓️</span>
              <div>
                <strong>Engagement de présence</strong>
                <small>Confirme ou retire-toi assez tôt.</small>
              </div>
            </div>
            <div className="emm-rule">
              <span className="emm-rule-icon">🚶</span>
              <div>
                <strong>Rythme du plus lent</strong>
                <small>On marche ensemble, on attend ensemble.</small>
              </div>
            </div>
            <div className="emm-rule">
              <span className="emm-rule-icon">🧭</span>
              <div>
                <strong>Le chef oriente, ne commande pas</strong>
                <small>Sécurité et rythme. Chacun reste maître de son pas.</small>
              </div>
            </div>
            <div className="emm-rule">
              <span className="emm-rule-icon">📷</span>
              <div>
                <strong>Photos avec accord</strong>
                <small>Demande avant de partager un visage.</small>
              </div>
            </div>
            <div className="emm-rule">
              <span className="emm-rule-icon">🛡️</span>
              <div>
                <strong>Retrait toujours possible</strong>
                <small>Si ça dérape, tu pars. Le chef peut éjecter.</small>
              </div>
            </div>
          </div>
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
            <ReportsList reports={reports} myUserId={myUserId} onAuthorClick={openProfile} />
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
        </>
        )}{/* /editorOpen ternary */}

          </div>{/* /expedition-modal-main */}

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
        </div>{/* /expedition-modal-left */}

        {/* Colonne droite — chat plein-hauteur (membres seulement) */}
        {chatVisible && (
          <aside className="expedition-modal-chat-col">
            <div className="expedition-modal-chat-col-header">
              <h3>Préparation · chat privé</h3>
            </div>
            <ExpeditionChat
              expeditionId={expeditionId}
              participantsById={participantsById}
              readOnly={e.status === 'passed'}
              onAuthorClick={openProfile}
            />
          </aside>
        )}
        </div>{/* /expedition-modal-shell */}

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

function Avatar({ name, avatarUrl, factionColor, onClick }: {
  name: string; avatarUrl: string | null; factionColor: string | null; onClick?: () => void
}) {
  const initials = (name || '?').slice(0, 2).toUpperCase()
  const style = factionColor
    ? { boxShadow: `0 0 0 2px #faf2dd, 0 0 0 4px ${factionColor}` }
    : undefined
  if (onClick) {
    return (
      <button
        type="button"
        className="emm-avatar emm-avatar-btn"
        style={style}
        onClick={onClick}
        title={`Voir le profil de ${name}`}
      >
        {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
      </button>
    )
  }
  return (
    <span className="emm-avatar" style={style}>
      {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
    </span>
  )
}

function NameLink({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="emm-name-link"
      onClick={onClick}
      title={`Voir le profil de ${name}`}
    >
      {name}
    </button>
  )
}

function ReportsList({ reports, myUserId, onAuthorClick }: {
  reports: ExpeditionReport[]; myUserId: string | null; onAuthorClick: (userId: string) => void
}) {
  if (reports.length === 0) {
    return <div className="emm-empty">Pas encore de compte rendu posé.</div>
  }
  return (
    <div className="emm-reports-list">
      {reports.map((r) => (
        <div key={r.user_id} className="emm-report-card">
          <div className="emm-report-author">
            <Avatar
              name={r.display_name}
              avatarUrl={r.avatar_url}
              factionColor={r.faction_color}
              onClick={() => onAuthorClick(r.user_id)}
            />
            <div>
              <strong><NameLink name={r.display_name} onClick={() => onAuthorClick(r.user_id)} /></strong>
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
