/**
 * QUOI     — le scanner (maquettes 530:915, 530:946, 530:982) : la caméra derrière un viseur, l'analyse
 *            en continu, le bip qui montre le Fragment puis ouvre son Récit ; au bout de 8 s, un conseil
 *            et « Voir tous les Fragments » ; pour les Porteurs et les admins, la feuille « Apprendre cette vue » (530:1013).
 *            En bas, toujours, « Découvrir l'appli » : le QR du dépliant mène ici, souvent sans vêtement.
 *            Un membre qui rescanne un motif déjà connu choisit sur la caméra (maquette 929:3010) :
 *            l'anecdote du jour (ou en creuser une, 2 énergies), son histoire, ou sa fiche.
 * POURQUOI — comme un QR code, sans QR code (spec 2026-10-09-v2-scan). Arrivé sans avoir touché
 *            l'écran (un QR du stand), le son n'est pas débloqué : un grand bouton « Scanner » d'abord.
 * ATTENTION — la caméra ne s'allume qu'une fois le son débloqué ; elle s'éteint en quittant l'écran.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { aLaTaille } from '@/shared/lib/image'
import eclair from '@/assets/ui/eclair.svg'
import fleche from '@/assets/ui/fleche-retour-claire.svg'
import { biper, debloquerSon, sonDebloque } from '@/shared/lib/son'
import { fetchRescan, noterScan, type Rescan } from '../api/scan'
import { useAnalyse } from '../hooks/useAnalyse'
import { useCamera } from '../hooks/useCamera'
import { useEmpreintes } from '../hooks/useEmpreintes'
import { cheminDuRecit } from '../lib/chemin'
import { SEUIL } from '../lib/regleDuBip'
import { FeuilleApprendre } from './FeuilleApprendre'
import styles from './ScanScreen.module.css'
import type { Apprendre } from '../api/scan'

const CONSEIL_MS = 8000
const VERS_LE_RECIT_MS = 600

export function ScanScreen({ connecte, apprendre }: { connecte: boolean; apprendre: Apprendre }) {
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
  const client = useQueryClient()
  const [reconnu, setReconnu] = useState<number | null>(null)
  const [note, setNote] = useState(false)
  const [rescan, setRescan] = useState<Rescan | null>(null)
  // Les motifs écartés par « Ce n'est pas lui » : plus de bip pour eux sur cet écran, le temps de
  // viser le bon (et, pour un Porteur, d'apprendre sa vue).
  const ecartes = useRef(new Set<number>())
  const analyse = useAnalyse(
    video,
    references,
    camera === 'en-marche' && reconnu === null,
    (id) => {
      if (ecartes.current.has(id)) return
      biper()
      // Le Codex et la fiche du Fragment se relisent une fois le scan noté (clés de leurs hooks).
      void noterScan(id)
        // Un membre qui connaît déjà ce motif choisit ici ; sinon (ou en cas d'échec), la fiche s'ouvre.
        .then(() => (connecte ? fetchRescan(id).catch(() => null) : null))
        .then((offre) => {
          void client.invalidateQueries({ queryKey: ['codex'] })
          void client.invalidateQueries({ queryKey: ['mon-fragment', id] })
          setRescan(offre)
          setNote(true)
        })
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

  // La fiche attend le scan noté : sinon, sur un réseau lent, elle le croirait le premier.
  useEffect(() => {
    if (reconnu === null || !note || rescan) return
    const minuteur = window.setTimeout(() => {
      // Le Récit remplace le scanner : le retour ne rouvre pas la caméra devant le t-shirt.
      // L'heure du scan suit : la fiche tire l'anecdote de ce scan, une fois.
      void navigate(cheminDuRecit(reconnu, connecte), {
        replace: true,
        state: { scan: Date.now() },
      })
    }, VERS_LE_RECIT_MS)
    return () => {
      window.clearTimeout(minuteur)
    }
  }, [reconnu, note, rescan, connecte, navigate])

  // Le scan a confondu deux motifs : on oublie ce bip, on écarte ce motif, et l'on vise encore.
  function viserEncore() {
    if (reconnu !== null) ecartes.current.add(reconnu)
    setReconnu(null)
    setRescan(null)
    setNote(false)
  }

  // Un choix du rescan remplace le scanner, comme le bip ; seule l'anecdote emporte l'heure du scan.
  function ouvrir(chemin: string, anecdote?: { creuser: boolean }) {
    void navigate(chemin, {
      replace: true,
      state: anecdote ? { scan: Date.now(), creuser: anecdote.creuser } : null,
    })
  }

  const fragment = fragments?.find((f) => f.id === reconnu)
  const echec = analyse.erreur || erreurEmpreintes
  const accueil = connecte ? '/accueil' : '/bienvenue'

  return (
    <main className={styles.ecran}>
      <video ref={video} className={styles.video} playsInline muted />
      <header className={styles.entete}>
        <Link className={styles.retour} to={accueil} aria-label="Retour">
          <img src={fleche} alt="" />
        </Link>
        <h1 className={styles.titre}>Scanner un Fragment</h1>
      </header>

      <div className={styles.viseur} data-reconnu={reconnu !== null} data-connu={rescan !== null}>
        <span /> <span /> <span /> <span />
        {rescan && fragment && <p className={styles.accroche}>{fragment.nom}</p>}
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
      ) : rescan && fragment && reconnu !== null ? (
        <Choix
          rescan={rescan}
          fiche={cheminDuRecit(reconnu, connecte)}
          ouvrir={ouvrir}
          viserEncore={viserEncore}
        />
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
      <footer className={styles.pied}>
        {reconnu === null && (
          <p className={styles.sortie}>
            Pas de vêtement sous la main ?
            <Link className={styles.lien} to={accueil}>
              Découvrir l’appli →
            </Link>
          </p>
        )}
        {!connecte && <p className={styles.mention}>Aucun compte nécessaire</p>}
      </footer>
      {apprendre !== 'non' && camera === 'en-marche' && reconnu === null && (
        <FeuilleApprendre
          suggestion={
            analyse.meilleur && analyse.meilleur.ressemblance >= SEUIL
              ? analyse.meilleur.fragment
              : null
          }
          empreinteActuelle={analyse.empreinteActuelle}
          retirer={apprendre === 'admin'}
        />
      )}
    </main>
  )
}

// Les choix d'un rescan, posés sur la caméra sous le motif accroché.
function Choix({
  rescan,
  fiche,
  ouvrir,
  viserEncore,
}: {
  rescan: Rescan
  fiche: string
  ouvrir: (chemin: string, anecdote?: { creuser: boolean }) => void
  viserEncore: () => void
}) {
  const { porte, restantes, gratuiteDuJour } = rescan
  return (
    <div className={styles.choix}>
      <p className={styles.connu}>
        {gratuiteDuJour ? 'Tu le connais' : 'Ton anecdote du jour est trouvée'}
        {restantes > 0 && ` · ${String(restantes)} anecdote${restantes > 1 ? 's' : ''} à découvrir`}
      </p>
      {restantes > 0 && (
        <button
          type="button"
          className={styles.anecdote}
          onClick={() => {
            debloquerSon() // dans le geste : les applaudissements de la révélation pourront jouer
            ouvrir(fiche, { creuser: !gratuiteDuJour })
          }}
        >
          {gratuiteDuJour ? 'Découvrir l’anecdote du jour' : 'Creuser une anecdote'}
          <span className={styles.cout}>
            {gratuiteDuJour ? (
              'gratuite'
            ) : (
              <>
                <img src={eclair} alt="" />2
              </>
            )}
          </span>
        </button>
      )}
      <button
        type="button"
        className={styles.principal}
        onClick={() => {
          ouvrir(porte ? `${fiche}/histoire` : fiche)
        }}
      >
        {porte ? 'Lire son histoire →' : 'Voir sa fiche →'}
      </button>
      {porte && (
        <button
          type="button"
          className={styles.fiche}
          onClick={() => {
            ouvrir(fiche)
          }}
        >
          Voir sa fiche
        </button>
      )}
      <button type="button" className={styles.fiche} onClick={viserEncore}>
        Ce n’est pas lui ? Viser encore
      </button>
    </div>
  )
}
