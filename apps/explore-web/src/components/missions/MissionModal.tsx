import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { getMissionState, getMissionSubmissions, getMySubmissionStatus, joinMission } from '../../lib/missionsApi'
import type { MissionState, MissionSubmission, MySubmissionStatus } from '../../types/mission'
import { MissionSalon } from './MissionSalon'
import './MissionModal.css'

export function MissionModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [m, setM] = useState<MissionState | null>(null)
  const [subs, setSubs] = useState<MissionSubmission[]>([])
  const [myStatus, setMyStatus] = useState<MySubmissionStatus>(null)
  const [tab, setTab] = useState<'mission' | 'salon'>('mission')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const state = await getMissionState(slug)
      if (cancelled) return
      if (state) {
        if (!state.isParticipant) { await joinMission(slug); state.isParticipant = true }
        const [sList, st] = await Promise.all([getMissionSubmissions(slug), getMySubmissionStatus(slug)])
        if (cancelled) return
        setSubs(sList); setMyStatus(st)
      }
      setM(state)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [slug])

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
          <button className={tab === 'salon' ? 'is-active' : ''} onClick={() => setTab('salon')}>Salon</button>
          <button className="mission-modal-close" onClick={onClose} aria-label="Fermer">×</button>
        </div>

        {tab === 'mission' ? (
          <div className="mission-modal-main">
            <div className="mission-modal-intro">
              <div className="mission-modal-eyebrow">{m.eyebrow ?? 'Mission'} · {m.participantsCount} engagés</div>
              <h2 className="mission-modal-title">{m.title}</h2>
              {m.call && <div className="mission-modal-call">« {m.call} »</div>}
            </div>
            <div
              className="mission-modal-cover"
              style={m.coverImageUrl ? { backgroundImage: `url(${m.coverImageUrl})` } : undefined}
            >
              {daysLeft != null && <span className="mission-modal-jx">J-{daysLeft}</span>}
              {!m.coverImageUrl && <span className="mission-modal-emblem">{m.emblem}</span>}
            </div>

            <section className="mission-modal-section">
              <h3>Butin</h3>
              <div className="mission-modal-rewards">
                {m.floor.glory > 0 && <span className="mm-rw">🎖️ {m.floor.glory} Gloire</span>}
                {m.floor.crowns > 0 && <span className="mm-rw">🪙 {m.floor.crowns} Couronnes</span>}
                {m.rewardHint && <span className="mm-rw gold">{m.rewardHint}</span>}
              </div>
            </section>

            {m.brief && (
              <section className="mission-modal-section">
                <h3>La mission</h3>
                <p className="mission-modal-brief">{m.brief}</p>
                {m.ctaUrl && (
                  <a className="mission-modal-cta" href={m.ctaUrl} target="_blank" rel="noopener noreferrer">
                    🛒 {m.ctaLabel ?? 'Voir le produit'}
                  </a>
                )}
              </section>
            )}

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
                📷 Présenter mon livrable
              </a>
            )}
          </div>
        ) : (
          <MissionSalon slug={m.slug} intro={m.salonIntro} readOnly={readOnlySalon} />
        )}
      </div>
    </div>,
    document.body,
  )
}
