import type { CoupeFactionEntry } from '../../../types/coupe'
import './CoupeHeritages.css'

interface CoupePodiumProps {
  /** 4 factions triées par score desc (l'orchestrateur garantit length === 4). */
  factions: CoupeFactionEntry[]
  /** ID de la Maison de l'utilisateur (toujours non-null à ce stade). */
  userFactionId: string
  seasonName: string
  /** Pattern URL par factionId (depuis la table factions). */
  patternByFactionId: Record<string, string | null>
  /** Click sur marche du podium ou ligne 4ème : ouvre FactionMembersModal de cette Maison. */
  onClickFaction: (factionId: string, factionTitle: string, factionColor: string) => void
  /** Click sur titre / fond / footer : ouvre CoupeModal complète. */
  onClickAll: () => void
}

/**
 * État "user dans une Maison" — Podium I-II-III avec 4ème en pied.
 * Couronne 👑 sur le 1er si scores > 0, embl&egrave;me cerclé or pour la Maison du user.
 */
export function CoupePodium({
  factions,
  userFactionId,
  seasonName,
  patternByFactionId,
  onClickFaction,
  onClickAll,
}: CoupePodiumProps) {
  const [first, second, third, fourth] = factions
  const topScore = first?.score ?? 0
  const userFaction = factions.find(f => f.factionId === userFactionId)
  const userRank = userFaction?.rank ?? 0
  const gapToTop = topScore - (userFaction?.score ?? 0)
  const gapToPodium = (third?.score ?? 0) - (fourth?.score ?? 0)

  return (
    <>
      <h2
        className="coupe-section-title"
        onClick={onClickAll}
        style={{ cursor: 'pointer' }}
      >
        ⚜ Coupe des Héritages
        <span className="coupe-season">— {seasonName}</span>
      </h2>
      <div className="coupe-frame coupe-podium-frame">
        <div className="coupe-podium">
          {/* 2ème (gauche) */}
          <PodiumStep
            faction={second}
            position={2}
            isLeader={false}
            isMine={second.factionId === userFactionId}
            patternUrl={patternByFactionId[second.factionId] ?? null}
            onClick={() => onClickFaction(second.factionId, second.factionTitle, second.factionColor)}
          />
          {/* 1er (centre) */}
          <PodiumStep
            faction={first}
            position={1}
            isLeader={topScore > 0}
            isMine={first.factionId === userFactionId}
            patternUrl={patternByFactionId[first.factionId] ?? null}
            onClick={() => onClickFaction(first.factionId, first.factionTitle, first.factionColor)}
          />
          {/* 3ème (droite) */}
          <PodiumStep
            faction={third}
            position={3}
            isLeader={false}
            isMine={third.factionId === userFactionId}
            patternUrl={patternByFactionId[third.factionId] ?? null}
            onClick={() => onClickFaction(third.factionId, third.factionTitle, third.factionColor)}
          />
        </div>

        {/* 4ème en pied */}
        <div
          className={`coupe-outsider${fourth.factionId === userFactionId ? ' coupe-outsider-mine' : ''}`}
          onClick={() => onClickFaction(fourth.factionId, fourth.factionTitle, fourth.factionColor)}
          role="button"
          tabIndex={0}
        >
          <span
            className="coupe-outsider-emblem"
            style={{ background: fourth.factionColor }}
          >
            {patternByFactionId[fourth.factionId] && (
              <img
                src={patternByFactionId[fourth.factionId] ?? undefined}
                alt=""
                className="coupe-outsider-emblem-img"
              />
            )}
          </span>
          <span>
            <span className="coupe-outsider-name">{fourth.factionTitle}</span>
            {' · '}
            {fourth.score} pts
            {topScore > 0 && (
              <>
                {' · '}à {gapToPodium} du podium
              </>
            )}
          </span>
        </div>

        {/* Pilule identité user */}
        <div className="coupe-mine-pill-wrap">
          <span className="coupe-mine-pill">{minePillLabel(topScore, userRank, gapToTop)}</span>
        </div>

        {/* Footer "Voir le classement complet" */}
        <button type="button" className="coupe-podium-footer" onClick={onClickAll}>
          ▸ Voir le classement complet
        </button>
      </div>
    </>
  )
}

interface PodiumStepProps {
  faction: CoupeFactionEntry
  position: 1 | 2 | 3
  isLeader: boolean
  isMine: boolean
  patternUrl: string | null
  onClick: () => void
}

function PodiumStep({ faction, position, isLeader, isMine, patternUrl, onClick }: PodiumStepProps) {
  const roman = position === 1 ? 'I' : position === 2 ? 'II' : 'III'
  return (
    <div className={`coupe-step coupe-step-${position}`} onClick={onClick}>
      {isLeader ? (
        <span className="coupe-crown" aria-hidden="true">👑</span>
      ) : (
        <span className="coupe-crown-spacer" aria-hidden="true" />
      )}
      <span
        className={`coupe-step-emblem${isMine ? ' coupe-step-mine' : ''}`}
        style={{ background: faction.factionColor }}
      >
        {patternUrl && (
          <img src={patternUrl} alt="" className="coupe-step-emblem-img" />
        )}
      </span>
      <span className="coupe-step-name">{faction.factionTitle}</span>
      <span className="coupe-step-pts" style={{ color: faction.factionColor }}>{faction.score}</span>
      <span className="coupe-step-block">{roman}</span>
    </div>
  )
}

/**
 * Texte de la pilule identité selon le rang et le score.
 * - Toutes Maisons à 0 pt (début saison) → "⚜ Ta Maison · 0 pts"
 * - User 1er avec score > 0             → "⚜ Ta Maison mène la course"
 * - User 2-4e avec score > 0            → "⚜ Ta Maison est Xème · Y du sommet"
 */
function minePillLabel(topScore: number, userRank: number, gapToTop: number): string {
  if (topScore <= 0) return '⚜ Ta Maison · 0 pts'
  if (userRank === 1) return '⚜ Ta Maison mène la course'
  return `⚜ Ta Maison est ${ordinalFr(userRank)} · ${gapToTop} du sommet`
}

function ordinalFr(n: number): string {
  if (n === 1) return '1ère'
  return `${n}ème`
}
