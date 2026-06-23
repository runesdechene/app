// Page publique « plaque tournante » (style Linktree) atteinte par le QR /flyer.
// Tout le style vit dans FlyerLinks.css (éditable directement). Ici : le contenu.
import './FlyerLinks.css'

type LinkItem = {
  emoji: string
  label: string
  href: string
  external?: boolean
  primary?: boolean
}

const LINKS: LinkItem[] = [
  { emoji: '🛒', label: 'La boutique', href: 'https://runesdechene.com', external: true, primary: true },
  { emoji: '📱', label: "L'application", href: 'https://app.runesdechene.com', external: true },
  { emoji: '🎁', label: 'Ton cadeau de bienvenue', href: '/flyercadeau' },
  { emoji: '📸', label: 'Instagram', href: 'https://www.instagram.com/runesdechene', external: true },
]

export function FlyerLinks() {
  return (
    <div className="flyer-links-page">
      <div className="flyer-links-column">
        <div className="flyer-links-header">
          <img src="/logo-slogan.webp" alt="Runes de Chêne — Portez l'Histoire" className="flyer-links-emblem" />
        </div>

        <nav className="flyer-links-nav">
          {LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              {...(link.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className={`flyer-link ${link.primary ? 'flyer-link--primary' : 'flyer-link--secondary'}`}
            >
              <span className="flyer-link__emoji">{link.emoji}</span>
              <span>{link.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}
