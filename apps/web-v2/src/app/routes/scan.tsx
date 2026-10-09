/**
 * QUOI     — /scan (le scanner), /scan/fragments (tous les Fragments), /scan/fragment/:id (le Récit
 *            d'un visiteur arrivé par le scan).
 * POURQUOI — publiques, avant la garde d'accès : un QR du stand y mène sans compte (spec
 *            2026-10-09-v2-scan). Le scanner se charge à part : il tire le modèle de vision.
 */
import { lazy, Suspense } from 'react'
import { Link, useParams } from 'react-router'
import { RecitFragment } from '@/features/fragments/components/RecitFragment'
import { useConnecte } from '@/features/vitrine/hooks/useVitrine'
import { ListeFragments } from '@/features/scan/components/ListeFragments'
import fleche from '@/assets/ui/fleche-retour.svg'
import styles from './scan.module.css'

const ScanScreenCharge = lazy(() =>
  import('@/features/scan/components/ScanScreen').then((m) => ({ default: m.ScanScreen })),
)

export function RouteScan() {
  const connecte = useConnecte()
  return (
    <Suspense fallback={null}>
      <ScanScreenCharge connecte={connecte} />
    </Suspense>
  )
}

export function RouteScanFragment() {
  const id = Number(useParams().id)
  return (
    <main className={styles.page}>
      <Link className={styles.retour} to="/scan" aria-label="Scanner un autre Fragment">
        <img src={fleche} alt="" />
      </Link>
      <RecitFragment key={id} id={id} />
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
