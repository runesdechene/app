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
  /** Click sur une marche : ouvre FactionMembersModal de cette Maison. */
  onClickFaction: (factionId: string, factionTitle: string, factionColor: string) => void
  /** Click sur titre / footer : ouvre CoupeModal complète. */
  onClickAll: () => void
}

/**
 * État "user dans une Maison" — Podium 4 marches proportionnelles.
 *
 * Ordre des colonnes : 3-1-2-4 (le leader occupe la 2e colonne, presque-au-centre,
 * crée une silhouette en cloche : 3e descend, 1er culmine, 2e reste haute, 4e basse).
 *
 * Hauteur de chaque marche = max(score/topScore × 80px, 12px).
 * Le 12px minimum garantit que toutes les marches restent visibles même à 0 pt
 * (début de saison).
 *
 * - Couronne 👑 sur le 1er si scores > 0
 * - Embl&egrave;me cerclé or pour la Maison du user (où qu'elle soit)
 * - Marche du 1er en gradient or
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
  const topScore = first.score
  const userFaction = factions.find(f => f.factionId === userFactionId)
  const userRank = userFaction?.rank ?? 0
  const gapToTop = topScore - (userFaction?.score ?? 0)

  // Ordre d'affichage 3-1-2-4 (silhouette en cloche, leader presque-au-centre)
  const displayOrder: Array<{ faction: CoupeFactionEntry; position: 1 | 2 | 3 | 4 }> = [
    { faction: third, position: 3 },
    { faction: first, position: 1 },
    { faction: second, position: 2 },
    { faction: fourth, position: 4 },
  ]

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
          {displayOrder.map(({ faction, position }) => (
            <PodiumStep
              key={faction.factionId}
              faction={faction}
              position={position}
              isLeader={position === 1 && topScore > 0}
              isMine={faction.factionId === userFactionId}
              patternUrl={patternByFactionId[faction.factionId] ?? null}
              blockHeight={blockHeightPx(faction.score, topScore)}
              onClick={() => onClickFaction(faction.factionId, faction.factionTitle, faction.factionColor)}
            />
          ))}
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
  position: 1 | 2 | 3 | 4
  isLeader: boolean
  isMine: boolean
  patternUrl: string | null
  blockHeight: number
  onClick: () => void
}

function PodiumStep({ faction, position, isLeader, isMine, patternUrl, blockHeight, onClick }: PodiumStepProps) {
  const roman = position === 1 ? 'I' : position === 2 ? 'II' : position === 3 ? 'III' : 'IV'
  return (
    <div
      className={`coupe-step${isLeader ? ' coupe-step-leader' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
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
      <span className="coupe-step-block" style={{ height: `${blockHeight}px` }}>{roman}</span>
    </div>
  )
}

/**
 * Hauteur de marche en pixels, proportionnelle au score relatif.
 * Plancher 12px pour garantir que la marche reste visible (cas début saison à 0 pt).
 */
function blockHeightPx(score: number, topScore: number): number {
  if (topScore <= 0) return 12
  return Math.max(Math.round((score / topScore) * 80), 12)
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
