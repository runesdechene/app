/**
 * QUOI     — le scanner (maquettes 530:915, 530:946, 530:982) : la caméra derrière un viseur, l'analyse
 *            en continu, le bip qui montre le Fragment puis ouvre son Récit ; au bout de 8 s, un conseil
 *            et « Voir tous les Fragments » ; pour les admins, la feuille « Apprendre cette vue » (530:1013).
 * POURQUOI — comme un QR code, sans QR code (spec 2026-10-09-v2-scan). Arrivé sans avoir touché
 *            l'écran (un QR du stand), le son n'est pas débloqué : un grand bouton « Scanner » d'abord.
 * ATTENTION — la caméra ne s'allume qu'une fois le son débloqué ; elle s'éteint en quittant l'écran.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { aLaTaille } from '@/shared/lib/image'
import fleche from '@/assets/ui/fleche-retour-claire.svg'
import { noterScan } from '../api/scan'
import { useAnalyse } from '../hooks/useAnalyse'
import { useCamera } from '../hooks/useCamera'
import { useEmpreintes } from '../hooks/useEmpreintes'
import { cheminDuRecit } from '../lib/chemin'
import { SEUIL } from '../lib/regleDuBip'
import { biper, debloquerSon, sonDebloque } from '../lib/son'
import { FeuilleApprendre } from './FeuilleApprendre'
import styles from './ScanScreen.module.css'

const CONSEIL_MS = 8000
const VERS_LE_RECIT_MS = 600

export function ScanScreen({ connecte, admin }: { connecte: boolean; admin: boolean }) {
  const navigate = useNavigate()
  const video = useRef<HTMLVideoElement>(null)
  const [demarre, setDemarre] = useState(sonDebloque)
  const camera = useCamera(video, demarre)
  const { fragments, erreur: erreurEmpreintes } = useEmpreintes()
  const references = useMemo(
    () =>
      fragments?.flatMap((f) => f.empreintes.map((e) => ({ fragment: f.id, vecteur: e.vecteur }))),
    [fragments],
  )
  const [reconnu, setReconnu] = useState<number | null>(null)
  const analyse = useAnalyse(
    video,
    references,
    camera === 'en-marche' && reconnu === null,
    (id) => {
      biper()
      noterScan(id)
      setReconnu(id)
    },
  )
  const [conseil, setConseil] = useState(false)

  // Le conseil ne compte qu'à partir du moment où l'on peut vraiment reconnaître : à la première
  // ouverture, le modèle se télécharge (plusieurs Mo) et rien n'est encore analysé.
  const vise = camera === 'en-marche' && analyse.pret && references !== undefined
  useEffect(() => {
    if (!vise || reconnu !== null) return
    const minuteur = window.setTimeout(() => {
      setConseil(true)
    }, CONSEIL_MS)
    return () => {
      window.clearTimeout(minuteur)
    }
  }, [vise, reconnu])

  useEffect(() => {
    if (reconnu === null) return
    const minuteur = window.setTimeout(() => {
      // Le Récit remplace le scanner : le retour ne rouvre pas la caméra devant le t-shirt.
      void navigate(cheminDuRecit(reconnu, connecte), { replace: true })
    }, VERS_LE_RECIT_MS)
    return () => {
      window.clearTimeout(minuteur)
    }
  }, [reconnu, connecte, navigate])

  const fragment = fragments?.find((f) => f.id === reconnu)
  const echec = analyse.erreur || erreurEmpreintes

  return (
    <main className={styles.ecran}>
      <video ref={video} className={styles.video} playsInline muted />
      <header className={styles.entete}>
        <Link
          className={styles.retour}
          to={connecte ? '/accueil' : '/bienvenue'}
          aria-label="Retour"
        >
          <img src={fleche} alt="" />
        </Link>
        <h1 className={styles.titre}>Scanner un Fragment</h1>
      </header>

      <div className={styles.viseur} data-reconnu={reconnu !== null}>
        <span /> <span /> <span /> <span />
        {reconnu === null && camera === 'en-marche' && <i className={styles.lecture} />}
      </div>

      {!demarre ? (
        <button
          type="button"
          className={styles.demarrer}
          onClick={() => {
            debloquerSon()
            setDemarre(true)
          }}
        >
          Scanner
        </button>
      ) : camera === 'refusee' ? (
        <div className={styles.consigne}>
          <p>
            La caméra est refusée. Autorise-la dans les réglages du navigateur pour ce site, puis
            reviens.
          </p>
          <Link className={styles.lien} to="/scan/fragments">
            Voir tous les Fragments
          </Link>
        </div>
      ) : echec ? (
        <div className={styles.consigne}>
          <p>Le scan n’a pas pu se préparer.</p>
          <Link className={styles.lien} to="/scan/fragments">
            Voir tous les Fragments
          </Link>
        </div>
      ) : fragment ? (
        <div className={styles.reconnu}>
          {fragment.illustration && <img src={aLaTaille(fragment.illustration, 104)} alt="" />}
          <div>
            <p className={styles.etiquette}>Fragment reconnu</p>
            <p className={styles.nom}>{fragment.nom}</p>
          </div>
        </div>
      ) : !vise ? (
        <div className={styles.consigne}>
          <p>Préparation du scan…</p>
        </div>
      ) : (
        <div className={styles.consigne}>
          <p>
            {conseil
              ? 'Pas encore reconnu.\nRapproche-toi, sans reflet.'
              : 'Vise le motif, de près. Ça bipe tout seul.'}
          </p>
          {conseil && (
            <Link className={styles.lien} to="/scan/fragments">
              Voir tous les Fragments
            </Link>
          )}
        </div>
      )}
      {!connecte && <p className={styles.pied}>Aucun compte nécessaire</p>}
      {admin && camera === 'en-marche' && reconnu === null && (
        <FeuilleApprendre
          suggestion={
            analyse.meilleur && analyse.meilleur.ressemblance >= SEUIL
              ? analyse.meilleur.fragment
              : null
          }
          empreinteActuelle={analyse.empreinteActuelle}
        />
      )}
    </main>
  )
}
