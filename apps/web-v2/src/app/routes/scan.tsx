/**
 * QUOI     — /scan (le scanner), /scan/fragments (tous les Fragments), /scan/fragment/:id (la fiche
 *            d'un Fragment pour un visiteur arrivé par le scan : la préhistoire, le mot de l'artiste, ce
 *            qu'on gagne en le portant, et l'invitation à commencer sa collection).
 * POURQUOI — publiques, avant la garde d'accès : un QR du stand y mène sans compte (spec
 *            2026-10-09-v2-scan). Le scanner se charge à part : il tire le modèle de vision.
 */
import { lazy, Suspense } from 'react'
import { Link, useParams } from 'react-router'
import { FicheFragment } from '@/features/fragments/components/FicheFragment'
import { useConnecte } from '@/features/vitrine/hooks/useVitrine'
import { ListeFragments } from '@/features/scan/components/ListeFragments'
import fleche from '@/assets/ui/fleche-retour.svg'
import { useApprendre } from './droitsDuScanner'
import styles from './scan.module.css'

const ScanScreenCharge = lazy(() =>
  import('@/features/scan/components/ScanScreen').then((m) => ({ default: m.ScanScreen })),
)

export function RouteScan() {
  const connecte = useConnecte()
  const apprendre = useApprendre()
  return (
    <Suspense fallback={null}>
      <ScanScreenCharge connecte={connecte} apprendre={apprendre} />
    </Suspense>
  )
}

// Sans compte, pas de skin à équiper : la fiche ne propose « Équiper » qu'au Porteur.
const sansCompte = () => Promise.resolve()

export function RouteScanFragment() {
  const id = Number(useParams().id)
  return (
    <main className={styles.page}>
      <Link className={styles.retour} to="/scan" aria-label="Scanner un autre Fragment">
        <img src={fleche} alt="" />
      </Link>
      <FicheFragment key={id} id={id} connecte={false} equiper={sansCompte} />
      {/* Sans compte, le scan montre tout mais ne garde rien (spec du Codex, 02/11). */}
      <Link className={styles.inviter} to="/bienvenue">
        Crée ton compte pour commencer ta collection
      </Link>
    </main>
  )
}

export function RouteScanFragments() {
  const connecte = useConnecte()
  return (
    <main className={styles.page}>
      <Link className={styles.retour} to="/scan" aria-label="Retour au scanner">
        <img src={fleche} alt="" />
      </Link>
      <h1 className={styles.titre}>Tous les Fragments</h1>
      <ListeFragments connecte={connecte} />
    </main>
  )
}
