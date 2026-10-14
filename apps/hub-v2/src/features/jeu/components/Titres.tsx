/**
 * QUOI     — « Les titres » : trois sections (les chemins, les connaissances, les autres) ; l'éditeur d'un titre
 *            (ou la création) s'ouvre par-dessus (route enfant).
 * POURQUOI — les titres de Compagnie de la V1 ne sont plus utilisés : on n'en montre que le nombre.
 */
import type { ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { Titre } from '../api/titres'
import { useTitres } from '../hooks/useTitres'
import { CHEMINS, genreDeTitre, lireCondition } from '../lib/titre'
import styles from './Jeu.module.css'
import titres from './Titres.module.css'

function LigneDeTitre({ titre, detail }: { titre: Titre; detail: string }) {
  const { search } = useLocation()
  return (
    <Link className={titres.ligne} to={{ pathname: String(titre.id), search }}>
      <span aria-hidden="true">{titre.icon}</span>
      <strong>{titre.name}</strong>
      <span className={titres.detail}>{detail}</span>
    </Link>
  )
}

function Groupe({ nom, children }: { nom: string; children: ReactNode }) {
  return (
    <>
      <p className={titres.groupe}>{nom}</p>
      {children}
    </>
  )
}

const parSeuil = (cle: 'min' | 'palier') => (a: Titre, b: Titre) =>
  (lireCondition(a.condition)[cle] ?? 0) - (lireCondition(b.condition)[cle] ?? 0)

export function Titres() {
  const { data, isError } = useTitres()
  const { search } = useLocation()
  const tous = data?.titres ?? []
  const chemins = tous.filter((t) => genreDeTitre(t) === 'chemin')
  const connaissances = tous.filter((t) => genreDeTitre(t) === 'connaissance')
  const cultures = [...new Set(connaissances.map((t) => lireCondition(t.condition).theme ?? ''))].sort()
  const autres = tous.filter((t) => ['polymathe', 'autre'].includes(genreDeTitre(t)))
  const compagnieV1 = data?.compagnieV1 ?? 0

  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Le jeu"
        titre="Les titres"
        aDroite={<Link className={styles.boutonContour} to={{ pathname: 'nouveau', search }}>+ Nouveau titre</Link>}
      />
      {isError && <p className={styles.calme}>La base ne répond pas.</p>}
      {data && (
        <>
          <TitreDeSection titre="Les chemins" />
          <Bloc>
            {Object.entries(CHEMINS).map(([stat, nom]) => (
              <Groupe key={stat} nom={nom}>
                {chemins.filter((t) => lireCondition(t.condition).stat === stat).sort(parSeuil('min')).map((t) => (
                  <LigneDeTitre key={t.id} titre={t} detail={`dès ${String(lireCondition(t.condition).min ?? 0)}`} />
                ))}
              </Groupe>
            ))}
          </Bloc>
          <TitreDeSection titre="Les connaissances" />
          <Bloc>
            {cultures.map((culture) => (
              <Groupe key={culture} nom={culture}>
                {connaissances.filter((t) => lireCondition(t.condition).theme === culture).sort(parSeuil('palier')).map((t) => (
                  <LigneDeTitre key={t.id} titre={t} detail={`palier ${String(lireCondition(t.condition).palier ?? '?')}`} />
                ))}
              </Groupe>
            ))}
          </Bloc>
          <TitreDeSection titre="Autres" />
          <Bloc>{autres.map((t) => <LigneDeTitre key={t.id} titre={t} detail={t.description ?? ''} />)}</Bloc>
          {compagnieV1 > 0 && <p className={styles.calme}>{`${String(compagnieV1)} titres de Compagnie de la V1 ne sont plus utilisés.`}</p>}
        </>
      )}
      <Outlet />
    </div>
  )
}
