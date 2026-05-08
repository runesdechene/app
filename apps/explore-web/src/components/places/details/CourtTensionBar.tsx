import './CourtTensionBar.css'
import type { CourtStatus, CourtVeilleur, Patron } from '../../../types/court'
import { useMapStore } from '../../../stores/mapStore'

interface CourtTensionBarProps {
  scoreVeilleur: number
  menaceHaute: number
  /** V0.7.6 (8/05) — bonus IRL "faveur" du plant_flag. Pour info sémantique
   *  uniquement (la barre ne sépare plus visuellement faveur vs invest depuis
   *  la refonte avatars/cluster). Conservé en prop pour rétrocompat. */
  defenseFavorPoints?: number
  /** V0.7.6 — top patrons (max 5) retournés par get_place_court_state.
   *  Filtrés en runtime par defenseTotal>0 / attackTotal>0 pour identifier
   *  défenseurs et attaquants — un patron peut figurer dans les deux camps. */
  patrons?: Patron[]
  /** V0.7.6 — le veilleur lui-même (leader de l'expé) s'affiche toujours en
   *  premier à gauche avec sa couronne, MÊME s'il n'a investi aucune Couronne
   *  en défense. C'est lui le défenseur primaire (par sa veille). */
  veilleur?: CourtVeilleur | null
  /** @deprecated V086 — le statut est désormais dans la pilule top-right de PlaceCourtView */
  status?: CourtStatus
}

const initials = (name: string): string =>
  name?.trim().charAt(0).toUpperCase() || '?'

interface AvatarChipProps {
  patron: Patron
  side: 'defense' | 'attack'
  decoration: 'leader' | 'threat' | 'none'
}

function AvatarChip({ patron, side, decoration }: AvatarChipProps) {
  const setSelectedPlayerId = useMapStore(s => s.setSelectedPlayerId)
  const score = side === 'defense' ? patron.defenseTotal : patron.attackTotal
  const tooltip = `${patron.displayName} · ${score} 🪙${decoration === 'leader' ? ' (mécène principal)' : decoration === 'threat' ? ' (challenger leader)' : ''}`
  return (
    <button
      type="button"
      className={`ctb-av${decoration === 'leader' ? ' ctb-av-leader' : ''}${decoration === 'threat' ? ' ctb-av-threat' : ''}`}
      style={{
        // V0.7.6 — borderColor toujours faction (visible quand vrai avatar uploadé).
        // Background fallback faction pour le cas sans avatar (initiale lisible).
        backgroundColor: patron.factionColor ?? '#5a4f8a',
        borderColor: patron.factionColor ?? '#5a4f8a',
      }}
      onClick={(e) => {
        e.stopPropagation()
        setSelectedPlayerId(patron.userId)
      }}
      title={tooltip}
      aria-label={tooltip}
    >
      {decoration === 'leader' && <span className="ctb-crown" aria-hidden>👑</span>}
      {patron.avatarUrl
        ? <img src={patron.avatarUrl} alt="" className="ctb-av-img" />
        : <span className="ctb-av-initial">{initials(patron.displayName)}</span>
      }
    </button>
  )
}

export function CourtTensionBar({ scoreVeilleur, menaceHaute, patrons, veilleur }: CourtTensionBarProps) {
  const total = scoreVeilleur + menaceHaute
  const veilleurPct = total > 0 ? Math.round((scoreVeilleur / total) * 100) : 100
  const showVeilleurNumber = veilleurPct >= 18
  const showMenaceNumber = menaceHaute > 0 && (100 - veilleurPct) >= 18
  const isCritical = scoreVeilleur > 0 && menaceHaute >= scoreVeilleur / 2

  const list = patrons ?? []
  const defendersFromPatrons = list
    .filter(p => p.defenseTotal > 0)
    .sort((a, b) => b.defenseTotal - a.defenseTotal)
  const attackers = list
    .filter(p => p.attackTotal > 0)
    .sort((a, b) => b.attackTotal - a.attackTotal)

  // V0.7.6 — le veilleur (leader de l'expé) est TOUJOURS le défenseur principal,
  // même sans investissement Couronnes (il défend par sa veille). On le préfixe.
  // Si déjà présent dans defendersFromPatrons, on dédup.
  const defenders: Patron[] = (() => {
    if (!veilleur || !veilleur.leaderUserId) return defendersFromPatrons
    const leaderInList = defendersFromPatrons.find(p => p.userId === veilleur.leaderUserId)
    if (leaderInList) {
      // Le leader a investi : on le promeut en tête (déjà via tri si plus gros score)
      return [leaderInList, ...defendersFromPatrons.filter(p => p.userId !== veilleur.leaderUserId)]
    }
    // Le leader n'a pas investi : on le synthétise comme défenseur primaire (defenseTotal = 0)
    const synthLeader: Patron = {
      userId: veilleur.leaderUserId,
      displayName: veilleur.leaderName,
      avatarUrl: veilleur.leaderAvatarUrl,
      total: 0,
      defenseTotal: 0,
      attackTotal: 0,
      factionId: veilleur.factionId,
      factionColor: veilleur.factionColor,
      factionPattern: veilleur.factionPattern,
    }
    return [synthLeader, ...defendersFromPatrons]
  })()

  // Limites d'affichage : 3 sur mobile, 5 sur desktop. Géré via CSS — on en
  // rend toujours 5 max et on cache les surnuméraires en CSS.
  const MAX_VISIBLE = 5
  const defLeader = defenders[0]
  const defOthers = defenders.slice(1, MAX_VISIBLE)
  const defOverflow = Math.max(0, defenders.length - MAX_VISIBLE)
  const atkLeader = attackers[0]
  const atkOthers = attackers.slice(1, MAX_VISIBLE)
  const atkOverflow = Math.max(0, attackers.length - MAX_VISIBLE)

  const atkLeaderIsThreat = !!atkLeader && atkLeader.attackTotal >= scoreVeilleur / 2

  return (
    <div className="ctb-wrap">
      <div
        className="ctb-bar"
        role="img"
        aria-label={`Faveur veilleur ${scoreVeilleur}, menace ${menaceHaute}${isCritical ? ' (bascule imminente)' : ''}`}
      >
        <div className="ctb-fill ctb-defense" style={{ width: `${veilleurPct}%` }}>
          {showVeilleurNumber && <span className="ctb-num">{scoreVeilleur}</span>}
        </div>
        <div className="ctb-fill ctb-attack" style={{ width: `${100 - veilleurPct}%` }}>
          {showMenaceNumber && <span className="ctb-num">{menaceHaute}</span>}
        </div>
        {isCritical && <div className="ctb-critical-hint" aria-hidden />}
      </div>

      {(defenders.length > 0 || attackers.length > 0) && (
        <div className="ctb-clusters">
          <div className="ctb-cluster ctb-cluster-left">
            {defLeader && <AvatarChip key={defLeader.userId} patron={defLeader} side="defense" decoration="leader" />}
            {defOthers.map(p => <AvatarChip key={p.userId} patron={p} side="defense" decoration="none" />)}
            {defOverflow > 0 && (
              <span className="ctb-overflow" aria-label={`${defOverflow} autres mécènes en défense`}>
                +{defOverflow}
              </span>
            )}
          </div>
          <div className="ctb-cluster ctb-cluster-right">
            {atkOverflow > 0 && (
              <span className="ctb-overflow" aria-label={`${atkOverflow} autres mécènes en attaque`}>
                +{atkOverflow}
              </span>
            )}
            {atkOthers.slice().reverse().map(p => <AvatarChip key={p.userId} patron={p} side="attack" decoration="none" />)}
            {atkLeader && <AvatarChip patron={atkLeader} side="attack" decoration={atkLeaderIsThreat ? 'threat' : 'none'} />}
          </div>
        </div>
      )}
    </div>
  )
}
