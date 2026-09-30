/**
 * QUOI     — le parcours « Ajouter un lieu » (maquette validée le 29/09, Figma « Ajouter un lieu —
 *            proposition ») : photo → où → nom, nature, époque → récit → aperçu, puis la fête.
 *            Plein écran sur téléphone, presque hors de l'app ; fenêtre au centre sur PC, la carte
 *            assombrie derrière.
 * POURQUOI — la fiche se construit sous tes yeux, une étape à la fois (Uriel, 29/09). Le brouillon
 *            s'enregistre à chaque geste ; quitter demande de le garder ou de le jeter, sauf si
 *            rien n'est commencé. Chaque étape a son adresse ; on ne va jamais plus loin que le
 *            brouillon ne le permet (une adresse en avance ramène à la bonne étape).
 * ATTENTION — posé dans la racine des feuilles (comme la feuille « Ajouter ») : il couvre toute
 *            l'app. Passer d'une étape à l'autre remplace l'adresse ; le retour du navigateur
 *            quitte donc le parcours, brouillon gardé.
 */
import { useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMutating } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router'
import { Feuille } from '@/shared/ui/Feuille'
import { Recompense } from '@/shared/ui/Recompense'
import { RacineDesFeuilles } from '@/shared/ui/racineDesFeuilles'
import type { Ajout } from '../api/lireAjout'
import { POSE } from '../hooks/useAjout'
import { useBrouillon } from '../hooks/useBrouillon'
import { useUrlDe } from '@/shared/hooks/useUrlDe'
import { derniereEtapePossible, ETAPES, type Brouillon, type Etape } from '../lib/brouillon'
import { EnTete } from './EnTete'
import { EtapeApercu } from './EtapeApercu'
import { EtapeLieu } from './EtapeLieu'
import { EtapeNom } from './EtapeNom'
import { EtapePhoto } from './EtapePhoto'
import { EtapeRecit } from './EtapeRecit'
import styles from './ParcoursAjout.module.css'

function estEtape(v: string | undefined): v is Etape {
  return ETAPES.some((e) => e === v)
}

// Un brouillon qui vaut d'être gardé : au moins une photo ou un nom.
function commence(b: Brouillon) {
  return b.photos.length > 0 || b.nom.trim() !== ''
}

// Les étapes posées sur une photo : l'en-tête passe en crème.
const SUR_PHOTO = new Set<Etape>(['photo', 'nom', 'apercu'])

export function ParcoursAjout({
  etape,
  onQuitter,
  onVoirLieu,
}: {
  etape: string | undefined
  onQuitter: () => void
  onVoirLieu: (id: string) => void
}) {
  const { brouillon, changer, jeter, enregistre } = useBrouillon()
  const racine = useContext(RacineDesFeuilles)
  const navigate = useNavigate()
  const [question, setQuestion] = useState(false)
  // Pendant la pose, on ne quitte pas : le lieu est à moitié parti.
  const enPose = useIsMutating({ mutationKey: POSE }) > 0
  const [pose, setPose] = useState<{ ajout: Ajout; nom: string; photo: Blob | undefined } | null>(
    null,
  )
  const ici: Etape = estEtape(etape) ? etape : 'photo'

  // L'étape se garde dans le brouillon : on le reprendra là.
  useEffect(() => {
    if (brouillon && brouillon.etape !== ici && commence(brouillon)) changer({ etape: ici })
  }, [brouillon, ici, changer])

  if (!brouillon) return null

  const aller = (e: Etape) => {
    void navigate(`../${e}`, { relative: 'path', replace: true })
  }
  const quitter = () => {
    if (enPose) return
    if (commence(brouillon)) setQuestion(true)
    else onQuitter()
  }

  let contenu
  if (pose) {
    contenu = (
      <Fete
        pose={pose}
        onVoirLieu={() => {
          onVoirLieu(pose.ajout.id)
        }}
        onFermer={onQuitter}
      />
    )
  } else {
    const possible = derniereEtapePossible(brouillon)
    if (ETAPES.indexOf(ici) > ETAPES.indexOf(possible)) {
      return <Navigate to={`../${possible}`} relative="path" replace />
    }
    const suivante = ETAPES[ETAPES.indexOf(ici) + 1] ?? 'apercu'
    const proprietes = {
      brouillon,
      changer,
      onSuivant: () => {
        aller(suivante)
      },
    }
    contenu = (
      <>
        {ici !== 'apercu' && (
          <EnTete
            etape={ici}
            possible={possible}
            enregistre={enregistre}
            clair={SUR_PHOTO.has(ici)}
            onQuitter={quitter}
            onAller={aller}
          />
        )}
        <div key={ici} className={styles.etape}>
          {ici === 'photo' && <EtapePhoto {...proprietes} />}
          {ici === 'lieu' && <EtapeLieu {...proprietes} />}
          {ici === 'nom' && <EtapeNom {...proprietes} />}
          {ici === 'recit' && <EtapeRecit {...proprietes} />}
          {ici === 'apercu' && (
            <EtapeApercu
              brouillon={brouillon}
              onAller={aller}
              onPose={(ajout) => {
                setPose({ ajout, nom: brouillon.nom.trim(), photo: brouillon.photos[0]?.grande })
              }}
            />
          )}
        </div>
      </>
    )
  }

  const parcours = (
    <div className={styles.parcours}>
      <div className={styles.voile} aria-hidden="true" onClick={pose ? onQuitter : quitter} />
      <div className={styles.fenetre} role="dialog" aria-modal="true" aria-label="Nouveau lieu">
        {contenu}
      </div>
      {/* Sans racine, la feuille se pose ici, au-dessus de la fenêtre : la racine des feuilles
          de l'app est sous le parcours. */}
      {question && (
        <RacineDesFeuilles.Provider value={null}>
          <Feuille
            titre="Quitter l’ajout"
            onFermer={() => {
              setQuestion(false)
            }}
          >
            <p className={styles.question}>Tu reviens plus tard ?</p>
            <p className={styles.explication}>
              Ton brouillon t’attend dans « Ajouter », à l’étape où tu l’as laissé.
            </p>
            <div className={styles.choix}>
              <button type="button" className={styles.garder} onClick={onQuitter}>
                Garder le brouillon
              </button>
              <button
                type="button"
                className={styles.jeter}
                onClick={() => {
                  void jeter().then(onQuitter)
                }}
              >
                Le jeter
              </button>
            </div>
          </Feuille>
        </RacineDesFeuilles.Provider>
      )}
    </div>
  )
  return racine ? createPortal(parcours, racine) : parcours
}

// La fête, sur la photo du lieu : la même que Découvrir (maquette 293:165).
function Fete({
  pose,
  onVoirLieu,
  onFermer,
}: {
  pose: { ajout: Ajout; nom: string; photo: Blob | undefined }
  onVoirLieu: () => void
  onFermer: () => void
}) {
  const photo = useUrlDe(pose.photo)
  const { ajout } = pose
  const rang = ajout.rang === 1 ? '1ᵉʳ' : `${String(ajout.rang)}ᵉ`
  return (
    <div className={styles.fete}>
      {photo && <img className={styles.photoFete} src={photo} alt="" />}
      <Recompense
        nom={pose.nom}
        type={null}
        phrase={`Ton ${rang} lieu ajouté${ajout.surPlace ? ' — visité, et à ton nom !' : ' !'}`}
        gain={ajout}
        libelleAcceder="Voir ta fiche"
        libelleRevenir="Revenir à la carte"
        onAcceder={onVoirLieu}
        onFermer={onFermer}
      />
    </div>
  )
}
