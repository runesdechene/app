/**
 * QUOI     — l'aperçu (maquette 293:146) : la fiche telle qu'elle paraîtra — la photo et la lisière,
 *            les vignettes, le nom, la nature principale, l'époque et les autres natures,
 *            l'endroit, le récit. En bas, la Charte en une phrase et « Poser le lieu sur la carte ».
 * POURQUOI — « Voilà ta fiche » : on la retouche en touchant la partie à changer (elle ramène à
 *            son étape). La Charte, signée à l'entrée, n'est plus trois cases à cocher : une
 *            phrase au moment de poser. Un refus se dit en clair, avec quoi faire.
 */
import { useUrlDe } from '../hooks/useUrlDe'
import { useEpoques, useNatures, usePoser } from '../hooks/useAjout'
import type { Ajout } from '../api/lireAjout'
import type { Brouillon, Etape } from '../lib/brouillon'
import styles from './EtapeApercu.module.css'

// La base refuse avec un indice (hint) ou un code (migration 381) : chacun a sa phrase.
function messageDeRefus(erreur: unknown): string {
  const indice = typeof erreur === 'object' && erreur !== null && 'hint' in erreur ? erreur.hint : null
  const code = typeof erreur === 'object' && erreur !== null && 'code' in erreur ? erreur.code : null
  if (indice === 'decouvertes') {
    return 'Découvre d’abord trois lieux sur la carte : ils t’apprennent ce qu’on y cherche. Ton brouillon t’attend.'
  }
  if (indice === 'limite') {
    return 'Vingt lieux posés aujourd’hui : c’est le plafond. Ton brouillon t’attend demain.'
  }
  if (code === '22023') {
    return 'Un détail de la fiche ne passe pas. Relis le nom, les natures et le récit, puis réessaie.'
  }
  return 'Le lieu n’a pas pu être posé. Vérifie ta connexion, puis réessaie : rien n’est perdu.'
}

export function EtapeApercu({
  brouillon,
  onAller,
  onPose,
}: {
  brouillon: Brouillon
  onAller: (etape: Etape) => void
  onPose: (ajout: Ajout) => void
}) {
  const natures = useNatures()
  const epoques = useEpoques()
  const poser = usePoser()
  const photo = useUrlDe(brouillon.photos[0]?.grande)
  const [principale, ...autres] = brouillon.natures.map((id) => natures.find((n) => n.id === id))
  const epoque = epoques.find((e) => e.id === brouillon.epoque)
  const annee =
    brouillon.annee === null
      ? null
      : brouillon.annee < 0
        ? `${String(-brouillon.annee)} av. J.-C.`
        : String(brouillon.annee)
  const faits = [epoque?.nom, annee, ...autres.map((n) => n?.nom)].filter(Boolean).join(' · ')
  const endroit = brouillon.endroit
    ? [brouillon.endroit.titre, brouillon.endroit.detail].filter(Boolean).join(', ')
    : null

  return (
    <div className={styles.apercu}>
      <div className={styles.defile}>
        <div className={styles.photo}>
          {photo && <img src={photo} alt="" />}
          <button
            type="button"
            className={styles.retour}
            aria-label="Revenir au récit"
            onClick={() => {
              onAller('recit')
            }}
          >
            <span className={styles.fleche} aria-hidden="true" />
          </button>
          <p className={styles.mention}>Voilà ta fiche · touche une partie pour la retoucher</p>
          <button
            type="button"
            className={styles.retoucherPhoto}
            aria-label="Retoucher les photos"
            onClick={() => {
              onAller('photo')
            }}
          />
        </div>

        <div className={styles.corps}>
          <Vignettes brouillon={brouillon} />
          <button
            type="button"
            className={styles.partie}
            aria-label="Retoucher le nom et la nature"
            onClick={() => {
              onAller('nom')
            }}
          >
            <h1 className={styles.nom}>{brouillon.nom.trim()}</h1>
            {principale && (
              <span
                className={styles.badge}
                style={principale.couleur ? { '--type': principale.couleur } : undefined}
              >
                {principale.nom}
              </span>
            )}
            {faits && <span className={styles.faits}>{faits}</span>}
          </button>

          {endroit && (
            <button
              type="button"
              className={styles.partie}
              aria-label="Retoucher l’endroit"
              onClick={() => {
                onAller('lieu')
              }}
            >
              <span className={styles.endroit}>
                <span className={styles.repere} aria-hidden="true" />
                {endroit}
              </span>
            </button>
          )}

          <button
            type="button"
            className={styles.partie}
            aria-label="Retoucher le récit"
            onClick={() => {
              onAller('recit')
            }}
          >
            <span className={styles.aPropos}>À propos</span>
            <span className={styles.recit}>{brouillon.recit.trim()}</span>
          </button>
        </div>
      </div>

      <div className={styles.pied}>
        {poser.isError ? (
          <p className={styles.refus} role="alert">
            {messageDeRefus(poser.error)}
          </p>
        ) : (
          <p className={styles.charte}>
            En le posant, je garantis un lieu réel et un récit juste, selon la Charte que j’ai
            signée.
          </p>
        )}
        <button
          type="button"
          className={styles.poser}
          disabled={poser.isPending}
          onClick={() => {
            poser.mutate(brouillon, {
              onSuccess: (ajout) => {
                onPose(ajout)
              },
            })
          }}
        >
          {poser.isPending ? 'Envoi des photos…' : 'Poser le lieu sur la carte'}
        </button>
      </div>
    </div>
  )
}

function Vignettes({ brouillon }: { brouillon: Brouillon }) {
  if (brouillon.photos.length < 2) return null
  return (
    <div className={styles.vignettes}>
      {brouillon.photos.map((p) => (
        <Vignette key={p.id} blob={p.vignette} />
      ))}
    </div>
  )
}

function Vignette({ blob }: { blob: Blob }) {
  const url = useUrlDe(blob)
  return url ? <img className={styles.vignette} src={url} alt="" /> : null
}
