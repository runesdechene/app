/**
 * QUOI     — « Voir tous les Fragments » : l'illustration et le nom de chaque Fragment visible,
 *            qui mènent à son Récit.
 * POURQUOI — le repli du scan : quand rien ne bipe, ou que la caméra est refusée (maquette 530:982).
 */
import { Link } from 'react-router'
import { aLaTaille } from '@/shared/lib/image'
import { useFragmentsVisibles } from '../hooks/useEmpreintes'
import { cheminDuRecit } from '../lib/chemin'
import styles from './ListeFragments.module.css'

export function ListeFragments({ connecte }: { connecte: boolean }) {
  const fragments = useFragmentsVisibles()
  return (
    <ul className={styles.liste}>
      {fragments?.map((f) => (
        <li key={f.id}>
          <Link className={styles.fragment} to={cheminDuRecit(f.id, connecte)}>
            {f.illustration && <img src={aLaTaille(f.illustration, 160)} alt="" loading="lazy" />}
            <span>{f.nom}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
