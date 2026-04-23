import type { CSSProperties } from 'react'
import TaglineSlideshow from './TaglineSlideshow'
import './LandingContent.css'

const COPY = {
  overline: '🎁 BIENVENUE DANS',
  title: 'RUNES DE CHÊNE.',
  subtitle: 'Une Confrérie qui explore les contrées oubliées de France.',
  pitch: '+ de 2600 lieux d\'Histoire à découvrir, une carte vivante, une communauté en marche.',
  ctaLabel: 'Accéder à la carte',
  perks: [
    { text: 'Une appli gratuite, sans pub', color: '#c8956b' },
    { text: 'Tes Fragments achetés débloquent des bonus', color: '#7a8e6f' },
  ],
} as const

const TAGLINES = [
  'Le Pokémon Go du patrimoine.',
  'Une rébellion contre le monde moderne.',
  'Un MMORPG dans la vraie vie.',
] as const

interface LandingContentProps {
  onCtaClick: () => void
}

export default function LandingContent({ onCtaClick }: LandingContentProps) {
  return (
    <div className="landing-content">
      <p className="landing-content__overline">{COPY.overline}</p>
      <h1 className="landing-content__title">{COPY.title}</h1>
      <p className="landing-content__subtitle">{COPY.subtitle}</p>
      <p className="landing-content__pitch">{COPY.pitch}</p>

      <div className="landing-content__perks">
        {COPY.perks.map((perk, i) => (
          <span
            key={i}
            className="landing-content__perk"
            style={{
              '--perk-color': perk.color,
              '--perk-rgb': hexToRgb(perk.color),
            } as CSSProperties}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span>{perk.text}</span>
          </span>
        ))}
      </div>

      <button type="button" className="landing-content__cta" onClick={onCtaClick}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="5" y="2" width="14" height="20" rx="2.5" ry="2.5" />
          <line x1="12" y1="18.5" x2="12.01" y2="18.5" />
        </svg>
        <span>{COPY.ctaLabel}</span>
      </button>

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
