interface Props {
  url: string | null
  label: string | null
}

/**
 * Gros bouton call-to-action affiché en fin d'annonce (après le corps, avant
 * le bloc social). Rendu uniquement si une URL est définie. Ouvre en nouvel
 * onglet : les liens pointent vers la boutique, on ne sort pas de la PWA.
 */
export function AnnouncementCta({ url, label }: Props) {
  if (!url) return null
  return (
    <a className="article-cta" href={url} target="_blank" rel="noopener noreferrer">
      {(label?.trim() || 'Découvrir')} →
    </a>
  )
}
