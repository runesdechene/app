/**
 * QUOI     — « Les Compagnies » : toutes, retirées comprises, une ligne chacune ; la fiche s'ouvre
 *            par-dessus (route enfant).
 */
import type { CSSProperties } from 'react'
import { Link, Outlet } from 'react-router'
import chevron from '@/assets/ui/chevron.svg'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { useCompagnies } from '../hooks/useCompagnies'
import styles from './Compagnies.module.css'

export function Compagnies() {
  const { data, isError } = useCompagnies()
  const actives = data?.filter((c) => !c.retiree) ?? []
  const membres = actives.reduce((somme, c) => somme + c.membres, 0)

  return (
    <div>
      <EnTeteDePage
        surtitre="Communauté"
        titre="Les Compagnies"
        phrase={data ? `${String(actives.length)} Compagnies actives, ${String(membres)} membres.` : ''}
      />
      {isError && <p>La base ne répond pas.</p>}
      {data && (
        <Bloc>
          {data.map((c) => (
            <Link key={c.id} className={c.retiree ? `${styles.ligne ?? ''} ${styles.retiree ?? ''}` : styles.ligne} to={`/communaute/compagnies/${c.id}`}>
              <span className={styles.pastille} style={{ '--couleur': c.couleur } as CSSProperties} />
              <span className={styles.qui}>
                <span className={styles.nom}>{c.nom}</span>
                <span className={styles.detail}>{c.devise ?? ''}</span>
              </span>
              <span className={styles.chiffres}>
                <span>{c.membres} membres</span>
                <span>Chef : {c.chef ?? '—'}</span>
                {c.privee && <Balise texte="Privée" teinte="boutique" />}
                {c.retiree && <Balise texte="Retirée" teinte="sommeil" />}
              </span>
              <img className={styles.chevron} src={chevron} alt="" />
            </Link>
          ))}
          {data.length === 0 && <p>Aucune Compagnie.</p>}
        </Bloc>
      )}
      <Outlet />
    </div>
  )
}
