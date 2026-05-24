import './PatronsList.css'
import { useState } from 'react'
import { useMapStore } from '../../../stores/mapStore'
import type { Patron, Challenger } from '../../../types/court'

interface PatronsListProps {
  patrons: Patron[]
  currentUserId?: string
  /** V0.7.7 (10/05) — désagrégation : permet d'identifier le mécène et les soutiens. */
  veilleurUserId?: string | null
  /** Score agrégé du mécène (= scoreVeilleur du state). Affiché à côté du nom. */
  scoreVeilleur?: number
  /** V173 — liste user-centric des attaquants soutenables (cibles à dépasser). */
  challengers?: Challenger[]
  /** V173 — clic « Soutenir » sur un challenger. */
  onSupportChallenger?: (c: Challenger) => void
}

interface PatronRowProps {
  patron: Patron
  side: 'defense' | 'attack'
  rank: string
  isYou: boolean
  onOpen: (userId: string) => void
  className?: string
}

function PatronRow({ patron, side, rank, isYou, onOpen, className }: PatronRowProps) {
  const score = side === 'defense' ? patron.defenseTotal : patron.attackTotal
  return (
    <div className={`patron-row${className ? ' ' + className : ''}${isYou ? ' is-you' : ''}`}>
      <span className="patron-rank">{rank}</span>
      <button
        type="button"
        className="patron-name"
        onClick={() => onOpen(patron.userId)}
        title={`Voir le profil de ${patron.displayName}`}
      >
        {patron.displayName}
        {patron.factionPattern && patron.factionColor && (
          <span
            className="patron-faction-icon"
            style={{
              backgroundColor: patron.factionColor,
              WebkitMaskImage: `url(${patron.factionPattern})`,
              maskImage: `url(${patron.factionPattern})`,
            }}
            aria-hidden
          />
        )}
        {isYou && <span className="patron-you">(vous)</span>}
      </button>
      <span className="patron-breakdown">
        <span
          className={`patron-side ${side === 'defense' ? 'patron-side-support' : 'patron-side-influence'}`}
          title={side === 'defense' ? 'Soutien' : 'Influence'}
        >
          {side === 'defense' ? '🛡' : '⚔'} {score}
        </span>
      </span>
    </div>
  )
}

export function PatronsList({ patrons, currentUserId, veilleurUserId, scoreVeilleur, challengers = [], onSupportChallenger }: PatronsListProps) {
  const [open, setOpen] = useState(false)

  if (patrons.length === 0) return null

  const openProfile = (userId: string) => {
    useMapStore.getState().setSelectedPlayerId(userId)
  }

  const mecenePatron = veilleurUserId ? patrons.find(p => p.userId === veilleurUserId) ?? null : null
  const supporters = patrons
    .filter(p => p.userId !== veilleurUserId && p.defenseTotal > 0)
    .sort((a, b) => b.defenseTotal - a.defenseTotal)

  const meceneScore = scoreVeilleur ?? mecenePatron?.defenseTotal ?? 0
  const participantCount = patrons.length

  return (
    <div className={`patrons-list${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="patrons-toggle"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls="patrons-list-content"
      >
        <span className="patrons-toggle-icon">🪙</span>
        <span className="patrons-toggle-label">Mécènes du lieu</span>
        <span className="patrons-toggle-count">({participantCount})</span>
        <span className={`patrons-toggle-chevron${open ? ' open' : ''}`} aria-hidden>▾</span>
      </button>

      {open && (
        <div id="patrons-list-content" className="patrons-list-content">
      {veilleurUserId && (
        <>
          <div className={`patron-row first${currentUserId === veilleurUserId ? ' is-you' : ''}`}>
            <span className="patron-rank">#1</span>
            {mecenePatron ? (
              <button
                type="button"
                className="patron-name"
                onClick={() => openProfile(mecenePatron.userId)}
                title={`Voir le profil de ${mecenePatron.displayName}`}
              >
                {mecenePatron.displayName}
                {mecenePatron.factionPattern && mecenePatron.factionColor && (
                  <span
                    className="patron-faction-icon"
                    style={{
                      backgroundColor: mecenePatron.factionColor,
                      WebkitMaskImage: `url(${mecenePatron.factionPattern})`,
                      maskImage: `url(${mecenePatron.factionPattern})`,
                    }}
                    aria-hidden
                  />
                )}
                <span className="patron-title">Mécène Principal</span>
                {currentUserId === mecenePatron.userId && <span className="patron-you">(vous)</span>}
              </button>
            ) : (
              <span className="patron-name">
                <span className="patron-title">Mécène Principal</span>
              </span>
            )}
            <span className="patron-breakdown">
              <span className="patron-side patron-side-support" title="Score de la veille">🛡 {meceneScore}</span>
            </span>
          </div>

          {supporters.length > 0 && (
            <>
              <div className="patrons-section-label patrons-section-supporters">↳ Soutiens</div>
              {supporters.map(p => (
                <PatronRow
                  key={p.userId}
                  patron={p}
                  side="defense"
                  rank="·"
                  isYou={currentUserId === p.userId}
                  onOpen={openProfile}
                  className="patron-row-supporter"
                />
              ))}
            </>
          )}
        </>
      )}

      {challengers.length > 0 && (
        <>
          <div className="patrons-section-label patrons-section-challengers">⚔ Challengers</div>
          {challengers.map((c, i) => (
            <div
              key={c.userId}
              className={`patron-row patron-row-challenger${currentUserId === c.userId ? ' is-you' : ''}`}
            >
              <span className="patron-rank">{`#${i + 1}`}</span>
              <button
                type="button"
                className="patron-name"
                onClick={() => openProfile(c.userId)}
                title={`Voir le profil de ${c.displayName}`}
              >
                {c.displayName}
                {c.factionPattern && c.factionColor && (
                  <span
                    className="patron-faction-icon"
                    style={{
                      backgroundColor: c.factionColor,
                      WebkitMaskImage: `url(${c.factionPattern})`,
                      maskImage: `url(${c.factionPattern})`,
                    }}
                    aria-hidden
                  />
                )}
                {currentUserId === c.userId && <span className="patron-you">(vous)</span>}
              </button>
              <span className="patron-breakdown">
                <span className="patron-side patron-side-influence" title="Score d'attaque">⚔ {c.score}</span>
              </span>
              {onSupportChallenger && currentUserId !== c.userId && c.expeditionId && (
                <button
                  type="button"
                  className="patron-support-btn"
                  onClick={() => onSupportChallenger(c)}
                  title={`Soutenir ${c.displayName}`}
                >
                  🪙 Soutenir
                </button>
              )}
            </div>
          ))}
        </>
      )}

          <div className="patrons-footer">
            Plus de couronnes sont investies sur ce lieu, plus ce lieu rayonne sur la carte.
          </div>
        </div>
      )}
    </div>
  )
}
