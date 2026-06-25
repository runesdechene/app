import './CollectiveCounter.css'

interface Props {
  lieuxSortisOubli: number
  lieuxVisites: number
  enigmesPercees: number
  /** 'full' = bandeau (modale/home) ; 'compact' = 1 ligne (scoreboard carte). */
  variant?: 'full' | 'compact'
}

const fmt = (n: number) => n.toLocaleString('fr-FR')

/**
 * Compteur collectif « Ensemble contre l'Oubli » — actions agrégées de la saison
 * (toute la communauté). Purement informatif : recadre la Coupe comme reliée aux
 * actions réelles, pas à la possession. Aucun impact sur le score.
 */
export function CollectiveCounter({ lieuxSortisOubli, lieuxVisites, enigmesPercees, variant = 'full' }: Props) {
  if (variant === 'compact') {
    if (lieuxSortisOubli + lieuxVisites + enigmesPercees === 0) return null
    return (
      <div className="collective-counter collective-counter-compact" title="Cette saison, ensemble contre l'Oubli">
        <span>🏛️ {fmt(lieuxSortisOubli)}</span>
        <span>📍 {fmt(lieuxVisites)}</span>
        <span>📜 {fmt(enigmesPercees)}</span>
      </div>
    )
  }
  return (
    <div className="collective-counter collective-counter-full">
      <div className="collective-counter-title">⚜ Cette saison, ensemble</div>
      <div className="collective-counter-metrics">
        <span>🏛️ <b>{fmt(lieuxSortisOubli)}</b> lieux sortis de l'Oubli</span>
        <span>📍 <b>{fmt(lieuxVisites)}</b> visités</span>
        <span>📜 <b>{fmt(enigmesPercees)}</b> énigmes percées</span>
      </div>
    </div>
  )
}
