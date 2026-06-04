import type { CSSProperties, ReactNode } from 'react'
import TaglineSlideshow from './TaglineSlideshow'
import './LandingContent.css'

const COPY = {
  overline: "",
  title: "Apprenez. Incarnez. Explorez.",
  subtitleBody: "Pendant que le monde scrolle, un mouvement s'éveille. Des âmes anciennes, des conquérants sans guerre, partis rendre au monde sa mémoire et son souffle.",
  subtitleCallout: "Répondez à l'appel.",
  pitchA: "2 600 lieux d'Histoire et de Nature.",
  pitchB: "Une carte vivante qui s'enrichit chaque semaine.",
  ctaLabel: 'Entrer sur la carte',
} as const

interface Perk {
  text: string
  color: string
  icon: ReactNode
}

const PERKS: Perk[] = [
  {
    text: 'Libre & sans pub',
    color: '#66497e',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 12 20 22 4 22 4 12" />
        <rect x="2" y="7" width="20" height="5" />
        <line x1="12" y1="22" x2="12" y2="7" />
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </svg>
    ),
  },
  {
    text: 'Bénédictions de la Boutique',
    color: '#8a3e55',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
      </svg>
    ),
  },
  {
    text: 'Titres & Hauts-Faits',
    color: '#99794e',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
        <line x1="5" y1="20" x2="19" y2="20" />
      </svg>
    ),
  },
  {
    text: 'Coupe des Factions',
    color: '#646e2c',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    ),
  },
]

const TAGLINES = [
  'Le Pokémon Go du patrimoine.',
  'Une rébellion contre le monde moderne.',
  'Un MMORPG dans la vraie vie.',
] as const

interface LandingContentProps {
  onCtaClick: () => void
  logoUrl?: string
}

export default function LandingContent({ onCtaClick, logoUrl }: LandingContentProps) {
  return (
    <div className="landing-content">
      {logoUrl && (
        <img src={logoUrl} alt="Runes de Chêne" className="landing-content__logo" />
      )}
      <p className="landing-content__overline">{COPY.overline}</p>
      <h1 className="landing-content__title">{COPY.title}</h1>
      <p className="landing-content__subtitle">
        {COPY.subtitleBody}{' '}
        <strong className="landing-content__subtitle-callout">{COPY.subtitleCallout}</strong>
      </p>
      <p className="landing-content__pitch">
        {COPY.pitchA}
        <br />
        {COPY.pitchB}
      </p>

      <div className="landing-content__perks">
        {PERKS.map((perk, i) => (
          <div
            key={i}
            className="landing-content__perk"
            style={{
              '--perk-color': perk.color,
              '--perk-rgb': hexToRgb(perk.color),
            } as CSSProperties}
          >
            <div className="landing-content__perk-medal" aria-hidden="true">
              {perk.icon}
            </div>
            <span className="landing-content__perk-label">{perk.text}</span>
          </div>
        ))}
      </div>

      <button type="button" className="landing-content__cta" onClick={onCtaClick}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
          <line x1="9" y1="3" x2="9" y2="18" />
          <line x1="15" y1="6" x2="15" y2="21" />
        </svg>
        <span>{COPY.ctaLabel}</span>
      </button>

      <a href="https://runesdechene.com" className="landing-content__shop-link">
        Accéder à la boutique →
      </a>

      <TaglineSlideshow taglines={TAGLINES} />
    </div>
  )
}

function hexToRgb(hex: string): string {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}
