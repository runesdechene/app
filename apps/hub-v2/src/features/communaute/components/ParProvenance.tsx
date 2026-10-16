/**
 * QUOI     — « Par provenance » : pour l'appli, la boutique en ligne, le stand et le flyer, les comptes,
 *            ceux créés depuis la sortie de la V1 (mars 2026), ceux connectés à la V1 ou à la V2, les
 *            autres, et le total (Uriel, 16/10).
 * POURQUOI — sur toute la base (mig 527), sans les filtres de la liste ; « Pas connectés » se déduit.
 */
import { Bloc } from '@/shared/ui/Bloc'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { ListeDeComptes } from '../api/comptes'
import { PROVENANCES } from '../lib/provenances'
import styles from './Communaute.module.css'

const nombre = new Intl.NumberFormat('fr-FR')

type Ligne = { libelle: string; comptes: number; crees_v1: number; connectes: number }

export function ParProvenance({ lignes }: { lignes: ListeDeComptes['par_provenance'] }) {
  const total = lignes.reduce<Ligne>((t, l) => ({
    libelle: 'Total', comptes: t.comptes + l.comptes, crees_v1: t.crees_v1 + l.crees_v1, connectes: t.connectes + l.connectes,
  }), { libelle: 'Total', comptes: 0, crees_v1: 0, connectes: 0 })
  const rangees: Ligne[] = lignes.map((l) => ({
    ...l, libelle: l.provenance ? (PROVENANCES[l.provenance] ?? l.provenance) : 'Inconnue',
  }))

  return (
    <>
      <TitreDeSection titre="Par provenance" />
      <Bloc>
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th scope="col">Provenance</th><th scope="col">Comptes</th><th scope="col">Créés depuis la V1 (mars 2026)</th>
              <th scope="col">Connectés V1/V2</th><th scope="col">Pas connectés V1/V2</th>
            </tr>
          </thead>
          <tbody>
            {[...rangees, total].map((l) => (
              <tr key={l.libelle}>
                <th scope="row">{l.libelle}</th>
                <td>{nombre.format(l.comptes)}</td>
                <td>{nombre.format(l.crees_v1)}</td>
                <td>{nombre.format(l.connectes)}</td>
                <td>{nombre.format(l.comptes - l.connectes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloc>
    </>
  )
}
