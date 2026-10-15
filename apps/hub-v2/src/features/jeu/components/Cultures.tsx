/**
 * QUOI     — « Les cultures » : une ligne par culture (icône, nom, titre, chiffres) ; l'éditeur d'une
 *            culture s'ouvre par-dessus (route enfant).
 * POURQUOI — ni création ni suppression : l'ancien Hub n'en avait pas, et les énigmes les référencent.
 */
import { Link, Outlet, useLocation } from 'react-router'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import type { CultureDuHub } from '@/shared/cultures/api'
import { useCulturesDuHub } from '@/shared/cultures/useCulturesDuHub'
import styles from './Cultures.module.css'
import { IconeDeCulture } from './IconeDeCulture'
import jeu from './Jeu.module.css'

function LigneDeCulture({ culture }: { culture: CultureDuHub }) {
  const { search } = useLocation()
  return (
    <Link className={styles.ligne} to={{ pathname: culture.id, search }}>
      <IconeDeCulture icone={culture.icone} couleur={culture.couleur} />
      <span className={styles.nom}>
        <strong>{culture.label}</strong>
        {culture.complement && <span>Sage {culture.complement}</span>}
        <span>{`${String(culture.stock)} énigmes en stock · ${String(culture.total)} points · ${String(culture.eveils.length)} « ? » éveillés`}</span>
      </span>
      {!culture.active && <Balise texte="Inactive" teinte="sommeil" />}
    </Link>
  )
}

export function Cultures() {
  const { data, isError } = useCulturesDuHub()
  return (
    <div className={jeu.ecran}>
      <EnTeteDePage surtitre="Le jeu" titre="Les cultures" phrase="" />
      {isError && <p className={jeu.calme}>La base ne répond pas.</p>}
      {data && <Bloc>{data.map((c) => <LigneDeCulture key={c.id} culture={c} />)}</Bloc>}
      <Outlet />
    </div>
  )
}
