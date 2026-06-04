import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getMissionState, getMissionSubmissions, getMySubmissionStatus, getMissionParticipants, joinMission } from '../../lib/missionsApi'
import type { MissionState, MissionSubmission, MySubmissionStatus, MissionParticipantsPayload } from '../../types/mission'
import { MissionSalon } from './MissionSalon'
import { MissionParticipants } from './MissionParticipants'
import { useToastStore } from '../../stores/toastStore'
import './MissionModal.css'

export function MissionModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [m, setM] = useState<MissionState | null>(null)
  const [subs, setSubs] = useState<MissionSubmission[]>([])
  const [myStatus, setMyStatus] = useState<MySubmissionStatus>(null)
  const [tab, setTab] = useState<'mission' | 'salon'>('mission')
  const [loading, setLoading] = useState(true)
  const [sealing, setSealing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [engaged, setEngaged] = useState<MissionParticipantsPayload>({ total: 0, participants: [] })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const state = await getMissionState(slug)
      if (cancelled) return
      if (state) {
        const [sList, st, eng] = await Promise.all([
          getMissionSubmissions(slug),
          getMySubmissionStatus(slug),
          getMissionParticipants(slug),
        ])
        if (cancelled) return
        setSubs(sList); setMyStatus(st); setEngaged(eng)
      }
      setM(state)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [slug])

  async function sealPact(openShop: boolean) {
    if (!m || sealing) return
    if (openShop && m.ctaUrl) {
      window.open(m.ctaUrl, '_blank', 'noopener,noreferrer')
    }
    setSealing(true)
    try {
      await joinMission(m.slug)
      setM({ ...m, isParticipant: true })
      setEngaged(await getMissionParticipants(m.slug))
    } catch {
      useToastStore.getState().addToast({
        type: 'error',
        message: 'Le pacte n\'a pas pu être scellé. Réessaie.',
        timestamp: Date.now(),
      })
    } finally {
      setSealing(false)
    }
  }

  function handlePactClick() {
    if (!m) return
    if (m.ctaUrl) { setConfirming(true); return }
    void sealPact(false)
  }

  if (loading || !m) {
    return createPortal(
      <div className="mission-modal-overlay" onClick={onClose}>
        <div className="mission-modal-loading">Chargement…</div>
      </div>,
      document.body,
    )
  }

  const daysLeft = m.endsAt ? Math.max(0, Math.ceil((new Date(m.endsAt).getTime() - Date.now()) / 86400000)) : null
  const readOnlySalon = m.status !== 'published'

  return createPortal(
    <div className="mission-modal-overlay" onClick={onClose}>
      <div className="mission-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mission-modal-tabs" role="tablist">
          <button className={tab === 'mission' ? 'is-active' : ''} onClick={() => setTab('mission')}>Mission</button>
          <button
            className={tab === 'salon' ? 'is-active' : ''}
            onClick={() => m.isParticipant && setTab('salon')}
            disabled={!m.isParticipant}
          >{m.isParticipant ? 'Salon' : '🔒 Salon'}</button>
          <button className="mission-modal-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>

        {tab === 'mission' ? (
          <>
            <div className="mission-modal-main">
              <div className="mission-modal-intro">
                <div className="mission-modal-eyebrow">{m.eyebrow ?? 'Mission'}</div>
                <h2 className="mission-modal-title">{m.title}</h2>
                {m.call && <div className="mission-modal-call">« {m.call} »</div>}
                {m.isParticipant ? (
                  <div className="mission-modal-engaged">
                    <span className="mission-modal-engaged-stamp">✓</span>
                    <div className="mission-modal-engaged-text">
                      <strong>Pacte scellé.</strong>
                      <span>Tu es l'un des {engaged.total} engagés.</span>
                    </div>
                    <MissionParticipants participants={engaged.participants} total={engaged.total} sealed hideLabel />
                  </div>
                ) : (
                  <MissionParticipants participants={engaged.participants} total={engaged.total} sealed={false} />
                )}
              </div>
              <div
                className="mission-modal-cover"
                style={m.coverImageUrl ? { backgroundImage: `url(${m.coverImageUrl})` } : undefined}
              >
                {daysLeft != null && <span className="mission-modal-jx">J-{daysLeft}</span>}
                {!m.coverImageUrl && <span className="mission-modal-emblem">{m.emblem}</span>}
              </div>

              {m.brief && (
                <section className="mission-modal-section">
                  <h3>L'ordre</h3>
                  <p className="mission-modal-brief">{m.brief}</p>
                  {m.ctaUrl && (
                    <a className="mission-modal-cta" href={m.ctaUrl} target="_blank" rel="noopener noreferrer">
                      🛒 {m.ctaLabel ?? 'Voir le produit'}
                    </a>
                  )}
                </section>
              )}

              <section className="mission-modal-section">
                <h3>Butin</h3>
                <div className="mission-modal-rewards">
                  <span className="mm-rw">🎖️ Gloire</span>
                  <span className="mm-rw">🪙 Couronnes</span>
                  {m.rewardHint && <span className="mm-rw gold">{m.rewardHint}</span>}
                </div>
                <p className="mission-modal-butin-note">Récompense fixée à la validation, selon la qualité de ta contribution.</p>
              </section>

              {m.isParticipant && (
                <>
                  {myStatus === 'pending' && (
                    <div className="mission-modal-status">
                      ⏳ Ton offrande est en cours d'examen par l'État-Major.
                    </div>
                  )}

                  <section className="mission-modal-section">
                    <h3>Les contributions · {subs.length}</h3>
                    <div className="mission-modal-gallery">
                      {subs.map((s) => (
                        <div
                          key={s.submissionId}
                          className="mission-modal-tile"
                          style={{ backgroundImage: `url(${s.imageUrl})` }}
                        >
                          <span className="mission-modal-tile-name">{s.submitterName}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {m.status === 'published' && (
                    <a
                      className="mission-modal-primary"
                      href={`https://hub.runesdechene.com/soumettre-contenu?quete=${m.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      📷 Ajouter ma contribution
                    </a>
                  )}
                </>
              )}
            </div>
            {!m.isParticipant && m.status === 'published' && (
              <div className="mission-modal-pactbar">
                <button className="mission-modal-pact" onClick={handlePactClick} disabled={sealing}>
                  <span className="mission-modal-pact-seal">⚔</span> Je relève ce défi
                </button>
              </div>
            )}
          </>
        ) : (
          <MissionSalon slug={m.slug} intro={m.salonIntro} readOnly={readOnlySalon} />
        )}

        {confirming && m.ctaUrl && (
          <div className="mission-modal-confirm-dim" onClick={() => !sealing && setConfirming(false)}>
            <div className="mission-modal-confirm" onClick={(e) => e.stopPropagation()}>
              <div className="mission-modal-confirm-top">
                <div
                  className="mission-modal-confirm-thumb"
                  style={m.coverImageUrl ? { backgroundImage: `url(${m.coverImageUrl})` } : undefined}
                >
                  {!m.coverImageUrl && <span>{m.emblem}</span>}
                </div>
                <div className="mission-modal-confirm-q">
                  <div className="mission-modal-confirm-lbl">Avant de sceller</div>
                  <div className="mission-modal-confirm-txt">
                    As-tu déjà <strong>{m.ctaLabel ?? 'le matériel'}</strong> pour accomplir ta mission ?
                  </div>
                </div>
              </div>
              <div className="mission-modal-confirm-acts">
                <button
                  className="mission-modal-confirm-yes"
                  disabled={sealing}
                  onClick={() => { void sealPact(false).then(() => setConfirming(false)) }}
                >⚔ Oui — je scelle le pacte</button>
                <button
                  className="mission-modal-confirm-no"
                  disabled={sealing}
                  onClick={() => { void sealPact(true).then(() => setConfirming(false)) }}
                >🛒 Pas encore — montre-moi la boutique</button>
                <div className="mission-modal-confirm-note">Dans les deux cas, te voilà engagé.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
