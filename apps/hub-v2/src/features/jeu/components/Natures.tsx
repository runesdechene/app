/**
 * QUOI     — « Les natures » : une ligne par catégorie de lieu (icône sur sa couleur, nom, nombre de lieux) ;
 *            l'éditeur d'une nature (ou la création) s'ouvre par-dessus (route enfant).
 * POURQUOI — pas de suppression : une nature porte des lieux. Le nombre ne compte que les lieux publics.
 */
import { Link, Outlet, useLocation } from 'react-router'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import type { Nature } from '../api/natures'
import { useNatures } from '../hooks/useNatures'
import styles from './Jeu.module.css'
import natures from './Natures.module.css'
import { PastilleDeNature } from './PastilleDeNature'

function LigneDeNature({ nature }: { nature: Nature }) {
  const { search } = useLocation()
  return (
    <Link className={natures.ligne} to={{ pathname: nature.id, search }}>
      <PastilleDeNature icone={nature.icon} couleur={nature.color} fond={nature.background} />
      <span className={natures.nom}>
        <strong>{nature.title}</strong>
        <span>{`${String(nature.lieux)} lieux`}</span>
      </span>
      {nature.hors_epoque && <Balise texte="Hors époque" teinte="lieu" />}
    </Link>
  )
}

export function Natures() {
  const { data, isError } = useNatures()
  const { search } = useLocation()
  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Le jeu"
        titre="Les natures"
        aDroite={<Link className={styles.boutonContour} to={{ pathname: 'nouvelle', search }}>+ Nouvelle nature</Link>}
      />
      {isError && <p className={styles.calme}>La base ne répond pas.</p>}
      {data && <Bloc>{data.map((n) => <LigneDeNature key={n.id} nature={n} />)}</Bloc>}
      <Outlet />
    </div>
  )
}
