/**
 * QUOI     — /<onglet>/fragment/<id> : la fiche d'un Fragment (maquettes C et D, spec du Codex) ;
 *            /<onglet>/fragment/<id>/histoire : son histoire entière, à lire ou à écouter (le Récit).
 * POURQUOI — la zone ne connaît pas la coquille (règle ESLint) : c'est ici que la fiche reçoit le
 *            cadre de détail, et le skin (le signe du profil, zone Compte). La maquette n'a pas de
 *            barre de titre : la flèche se pose sur le parchemin (`titreCache`), le scanner en face.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router'
import scanner from '@/assets/ui/scanner.svg'
import { useChoisirSigne } from '@/features/compte/hooks/useChoisirSigne'
import { useMonIdentifiant } from '@/features/compte/hooks/useMonIdentifiant'
import { FicheFragment } from '@/features/fragments/components/FicheFragment'
import { RecitFragment } from '@/features/fragments/components/RecitFragment'
import { cleMonFragment } from '@/features/fragments/hooks/useMonFragment'
import { lireArrivee } from '@/features/fragments/lib/arrivee'
import { useRecit } from '@/features/fragments/hooks/useRecit'
import { debloquerSon } from '@/shared/lib/son'
import { DetailPane } from '../shell/DetailPane'
import styles from './fragments.module.css'

// Le scanner de la coquille, en haut à droite de la fiche (maquettes C et D).
function Scanner() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className={styles.scanner}
      aria-label="Scanner un Fragment"
      onClick={() => {
        debloquerSon() // ce toucher débloque le son du bip (Safari)
        void navigate('/scan')
      }}
    >
      <img src={scanner} alt="" />
    </button>
  )
}

export function RouteFragment() {
  const id = Number(useParams().id)
  const { recit } = useRecit(id)
  const { choisir } = useChoisirSigne(useMonIdentifiant() ?? '')
  const client = useQueryClient()
  // Ouverte par un scan, la fiche reçoit son arrivée (ScanScreen) : elle en tire l'anecdote.
  const arrivee = lireArrivee(useLocation().state)

  async function equiper(fragment: number) {
    await choisir(fragment)
    await client.invalidateQueries({ queryKey: cleMonFragment(fragment) })
  }

  return (
    <DetailPane title={recit?.nom ?? 'Fragment'} titreCache actions={<Scanner />}>
      <FicheFragment key={id} id={id} connecte equiper={equiper} arrivee={arrivee} />
    </DetailPane>
  )
}

export function RouteHistoireFragment() {
  const id = Number(useParams().id)
  const { recit } = useRecit(id)
  return (
    <DetailPane title={recit?.nom ?? 'Fragment'} titreCache>
      <RecitFragment key={id} id={id} />
    </DetailPane>
  )
}
