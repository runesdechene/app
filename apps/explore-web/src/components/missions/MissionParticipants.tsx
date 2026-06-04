import { useMapStore } from '../../stores/mapStore'
import type { MissionParticipant } from '../../types/mission'

/**
 * Rangée d'avatars des engagés d'une mission — la « vie » de la fiche.
 * Visible dans les deux états (avant/après le pacte). Chaque avatar est
 * cliquable → ouvre le profil du joueur (même geste que le Salon).
 * Source : RPC get_mission_participants (mig 208).
 */
export function MissionParticipants({
  participants,
  total,
  sealed,
  hideLabel,
}: {
  participants: MissionParticipant[]
  total: number
  sealed: boolean
  /** N'afficher que la pile d'avatars (pour l'insérer dans la bannière « Pacte scellé »). */
  hideLabel?: boolean
}) {
  if (total === 0) {
    return hideLabel ? null : (
      <div className="mission-engaged-row mission-engaged-empty">Sois le premier à relever ce défi.</div>
    )
  }

  const extra = total - participants.length

  const avatars = (
    <div className="mission-engaged-avs">
      {participants.map((p) => (
        <button
          key={p.userId}
          className="mission-engaged-av-btn"
          onClick={() => useMapStore.getState().setSelectedPlayerId(p.userId)}
          aria-label={p.name ?? 'Engagé'}
          title={p.name ?? 'Engagé'}
        >
          {p.avatar ? (
            <img className="mission-engaged-av" src={p.avatar} alt="" />
          ) : (
            <span className="mission-engaged-av mission-engaged-av-fb">
              {(p.name ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
        </button>
      ))}
      {extra > 0 && <span className="mission-engaged-av mission-engaged-more">+{extra}</span>}
    </div>
  )

  if (hideLabel) return avatars

  return (
    <div className="mission-engaged-row">
      {avatars}
      <span className="mission-engaged-label">
        {sealed
          ? `${total} engagé${total > 1 ? 's' : ''}`
          : `Déjà ${total} engagé${total > 1 ? 's' : ''} — rejoins-${total > 1 ? 'les' : 'le'}`}
      </span>
    </div>
  )
}
