import './CollectiveCounter.css'

interface Props {
  lieuxSortisOubli: number
  lieuxVisites: number
  enigmesPercees: number
}

const fmt = (n: number) => n.toLocaleString('fr-FR')

/**
 * Compteur collectif « Ensemble contre l'Oubli » — actions agrégées de la saison
 * (toute la communauté), en liste lisible (emoji + chiffre + libellé). Purement
 * informatif : recadre la Coupe comme reliée aux actions réelles. Aucun impact sur
 * le score. Bandeau pour la modale Coupe + la section Coupe de l'accueil.
 */
export function CollectiveCounter({ lieuxSortisOubli, lieuxVisites, enigmesPercees }: Props) {
  return (
    <div className="collective-counter">
      <div className="collective-counter-title">⚜ Ensemble, les Compagnies ont</div>
      <div className="collective-counter-pills">
        <span className="cc-pill">🏛️ Sorti <b>{fmt(lieuxSortisOubli)}</b> lieux de l'Oubli</span>
        <span className="cc-pill">📍 Visité <b>{fmt(lieuxVisites)}</b> lieux</span>
        <span className="cc-pill">📜 Validé <b>{fmt(enigmesPercees)}</b> énigmes</span>
      </div>
    </div>
  )
}
