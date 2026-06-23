// Page publique « plaque tournante » (style Linktree) atteinte par le QR /flyer.
// Réutilise le système parchemin de l'app (palette + Bebas Neue, chargées par index.html).

type LinkItem = {
  emoji: string
  label: string
  href: string
  external?: boolean
  primary?: boolean
}

const C = {
  parchment: '#f7ede1',
  parchmentDark: '#E8D5BE',
  ink: '#4A3728',
  inkLight: '#7D5A3C',
  sepia: '#C19A6B',
  sepiaDark: '#A0784C',
}

const LINKS: LinkItem[] = [
  { emoji: '🛒', label: 'La boutique', href: 'https://runesdechene.com', external: true, primary: true },
  { emoji: '📱', label: "L'application", href: 'https://app.runesdechene.com', external: true },
  { emoji: '🎁', label: 'Ton cadeau de bienvenue', href: '/flyercadeau' },
  { emoji: '📸', label: 'Instagram', href: 'https://www.instagram.com/runesdechene', external: true },
]

export function FlyerLinks() {
  return (
    <div style={page}>
      <div style={column}>
        <div style={header}>
          <img src="/logo-marron.webp" alt="Runes de Chêne" style={emblem} />
          <p style={tagline}>Pendant que le monde scrolle, un mouvement s'éveille.</p>
        </div>

        <nav style={links}>
          {LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              style={link.primary ? linkPrimary : linkSecondary}
            >
              <span style={{ fontSize: 20 }}>{link.emoji}</span>
              <span>{link.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}

const page: React.CSSProperties = {
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px 20px',
  boxSizing: 'border-box',
  fontFamily: "'Cabin', sans-serif",
  background: `url(/fond-explore.webp) center / cover no-repeat`,
}
const column: React.CSSProperties = {
  width: '100%',
  maxWidth: 420,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
}
// Halo parcheminé clair derrière l'en-tête : lisibilité du texte marron foncé
// directement sur le fond, sans overlay sombre.
const header: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px 28px 24px',
  marginBottom: 26,
  borderRadius: 28,
  background: 'radial-gradient(ellipse at center, rgba(247,237,225,0.88) 0%, rgba(247,237,225,0.55) 48%, rgba(247,237,225,0) 78%)',
}
const emblem: React.CSSProperties = {
  height: 92,
  width: 'auto',
  objectFit: 'contain',
  marginBottom: 12,
  opacity: 0.9,
}
const tagline: React.CSSProperties = {
  fontSize: 16,
  lineHeight: 1.4,
  color: C.ink,
  margin: 0,
  textShadow: '0 1px 8px rgba(247,237,225,0.95)',
}
const links: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}
const linkBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  width: '100%',
  boxSizing: 'border-box',
  padding: '16px 18px',
  borderRadius: 12,
  fontSize: 18,
  fontFamily: "'Cabin Condensed', sans-serif",
  fontWeight: 600,
  letterSpacing: '0.03em',
  textDecoration: 'none',
  boxShadow: '0 6px 18px rgba(20, 12, 6, 0.28)',
}
const linkPrimary: React.CSSProperties = {
  ...linkBase,
  background: C.ink,
  color: C.parchment,
  border: `1px solid ${C.ink}`,
}
const linkSecondary: React.CSSProperties = {
  ...linkBase,
  background: C.parchment,
  color: C.ink,
  border: `1px solid ${C.sepia}`,
}
