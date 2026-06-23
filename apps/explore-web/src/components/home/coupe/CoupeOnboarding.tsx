import type { CoupeFactionEntry } from '../../../types/coupe'
import './CoupeHeritages.css'

interface CoupeOnboardingProps {
  factions: CoupeFactionEntry[]
  /** Nom de la saison courante (ex. "Saison du Renouveau"). Affiché en sous-titre. */
  seasonName: string
  /** Pattern URL par factionId (depuis la table factions, pas dans CoupeFactionEntry). */
  patternByFactionId: Record<string, string | null>
  /** Ouvre la FactionModal de sélection. Source : Outlet context (MobileLayout). */
  openFactionModal: () => void
}

/**
 * État "user sans Maison" — présentation neutre des héritages.
 * Pas de scores, pas de classement (anti-bandwagon volontaire, cf. spec §1).
 */
export function CoupeOnboarding({
  factions,
  seasonName,
  patternByFactionId,
  openFactionModal,
}: CoupeOnboardingProps) {
  return (
    <>
      <h2 className="coupe-section-title">
        ⚜ Coupe des Classes
        <span className="coupe-season">— {seasonName}</span>
      </h2>
      <div className="coupe-frame coupe-onboarding-frame">
        <div className="coupe-cup-wrap">
          <div className="coupe-cup-halo" />
          <CoupeCupSvg />
        </div>
        <div className="coupe-tagline">Une saison. Quatre classes.</div>
        <div className="coupe-blurb">
          Chaque énigme résolue, chaque lieu visité, chaque récit partagé fait grandir ta classe. À la fin de la saison, l'une d'elles soulève la Coupe.
        </div>
        <div className="coupe-banners">
          {factions.map(f => (
            <button
              key={f.factionId}
              type="button"
              className="coupe-banner"
              onClick={openFactionModal}
              aria-label={`En savoir plus sur ${f.factionTitle}`}
            >
              <span
                className="coupe-banner-emblem"
                style={{ background: f.factionColor }}
              >
                {patternByFactionId[f.factionId] && (
                  <img
                    src={patternByFactionId[f.factionId] ?? undefined}
                    alt=""
                    className="coupe-banner-emblem-img"
                  />
                )}
              </span>
              <span className="coupe-banner-name">{f.factionTitle}</span>
            </button>
          ))}
        </div>
        <button type="button" className="coupe-cta" onClick={openFactionModal}>
          ⚜ Choisir ma Faction
        </button>
      </div>
    </>
  )
}

/**
 * SVG de coupe doré inline (86×86 quand rendu via .coupe-cup).
 */
function CoupeCupSvg() {
  return (
    <svg className="coupe-cup" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="coupe-cup-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f0d987" />
          <stop offset="50%" stopColor="#d4a857" />
          <stop offset="100%" stopColor="#9a7008" />
        </linearGradient>
        <linearGradient id="coupe-cup-shine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff5cf" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#fff5cf" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Anses */}
      <path d="M 22 32 Q 8 32 8 50 Q 8 62 22 60" fill="none" stroke="url(#coupe-cup-gold)" strokeWidth="4" strokeLinecap="round" />
      <path d="M 78 32 Q 92 32 92 50 Q 92 62 78 60" fill="none" stroke="url(#coupe-cup-gold)" strokeWidth="4" strokeLinecap="round" />
      {/* Vasque */}
      <path d="M 22 28 L 78 28 L 74 60 Q 50 70 26 60 Z" fill="url(#coupe-cup-gold)" stroke="#7a5008" strokeWidth="1.5" />
      {/* Reflet */}
      <path d="M 28 32 L 38 32 L 36 56 Q 32 56 30 54 Z" fill="url(#coupe-cup-shine)" />
      {/* Bandeau central */}
      <path d="M 30 40 L 70 40 L 68 48 L 32 48 Z" fill="#7a5008" opacity="0.4" />
      {/* Fleur de lys au centre */}
      <text x="50" y="48" textAnchor="middle" fontSize="11" fontFamily="serif" fill="#fff5cf" fontWeight="700">⚜</text>
      {/* Pied colonne */}
      <rect x="44" y="68" width="12" height="14" fill="url(#coupe-cup-gold)" stroke="#7a5008" strokeWidth="1" />
      {/* Base */}
      <ellipse cx="50" cy="84" rx="22" ry="4" fill="url(#coupe-cup-gold)" stroke="#7a5008" strokeWidth="1" />
      <rect x="28" y="84" width="44" height="6" fill="url(#coupe-cup-gold)" stroke="#7a5008" strokeWidth="1" />
      <ellipse cx="50" cy="90" rx="22" ry="3" fill="#9a7008" />
    </svg>
  )
}
