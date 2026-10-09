/**
 * QUOI     — la feuille du « + » : ajouter sur la carte un lieu, un point d'intérêt ou un pin GPS
 *            (maquette 201:216) ; et, si un brouillon attend, le reprendre (maquette 294:244).
 * POURQUOI — l'en-tête est commun à tous les onglets : on ajoute de partout (Uriel, 28/09).
 *            « Un lieu » ouvre le parcours à la place de la feuille (l'adresse est remplacée : le
 *            retour ramène à l'onglet, pas à la feuille). Un brouillon se reprend à l'étape où on
 *            l'a laissé.
 * ATTENTION — « Un pin GPS » ouvre /<onglet>/ajouter/pin (écran plein cadre, hors du parcours) ;
 *            seul le point d'intérêt viendra plus tard : désactivé, il le dit (« bientôt »).
 *            « Tes pins » arrive par `enTete`, posé par la route : la zone ajout ne connaît pas
 *            la zone pin (règle ESLint).
 */
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import chevron from '@/assets/ui/chevron.svg'
import lieu from '@/assets/ui/lieu.svg'
import pinGps from '@/assets/ui/pin-gps.svg'
import pointInteret from '@/assets/ui/point-interet.svg'
import { Feuille } from '@/shared/ui/Feuille'
import { useUrlDe } from '@/shared/hooks/useUrlDe'
import { chargerBrouillon, etapeDeReprise, type Brouillon, type Etape } from '../lib/brouillon'
import styles from './AjouterFeuille.module.css'

const PLUS_TARD = [
  {
    titre: 'Un point d’intérêt',
    texte:
      'Anecdote, objet, curiosité locale, établissement dans l’esprit de la marque... trop petit pour être un lieu, mais qui mérite d’être partagé aux autres membres.',
    icone: pointInteret,
  },
] as const

const CE_QUI_RESTE: Record<Etape, string> = {
  photo: 'il te reste la photo',
  lieu: 'il te reste à le placer',
  nom: 'il te reste son nom',
  recit: 'il te reste le récit',
  apercu: 'il ne reste qu’à le poser',
}

// Un brouillon qui vaut d'être repris : au moins une photo, un nom, ou le pin qu'il complète.
function aReprendre(b: Brouillon | null): b is Brouillon {
  return b !== null && (b.photos.length > 0 || b.nom.trim() !== '' || b.pin !== null)
}

// `enTete` : ce que la route pose sous le titre (« Tes pins », zone pin) ; un filet le sépare.
export function AjouterFeuille({ onFermer, enTete }: { onFermer: () => void; enTete?: ReactNode }) {
  const navigate = useNavigate()
  const { data: brouillon = null } = useQuery({
    queryKey: ['ajout', 'brouillon'],
    queryFn: chargerBrouillon,
    staleTime: 0,
    gcTime: 0,
  })
  const ouvrir = (etape: Etape) => {
    void navigate(`lieu/${etape}`, { relative: 'path', replace: true })
  }

  return (
    <Feuille titre="Ajouter sur la carte" onFermer={onFermer}>
      <p className={styles.titre}>Ajouter sur la carte</p>
      {enTete && (
        <>
          {enTete}
          <hr className={styles.filet} />
        </>
      )}
      {aReprendre(brouillon) && <Reprendre brouillon={brouillon} onReprendre={ouvrir} />}
      <button
        type="button"
        className={styles.choix}
        onClick={() => {
          ouvrir('photo')
        }}
      >
        <img className={styles.icone} src={lieu} alt="" />
        <span className={styles.texte}>
          <span className={styles.nom}>Un lieu</span>
          <span className={styles.description}>
            Un lieu oublié que tu veux faire connaître : photo, récit, position.
          </span>
        </span>
        <img className={styles.chevron} src={chevron} alt="" />
      </button>
      <button
        type="button"
        className={styles.choix}
        onClick={() => {
          void navigate('pin', { relative: 'path', replace: true })
        }}
      >
        <img className={styles.icone} src={pinGps} alt="" />
        <span className={styles.texte}>
          <span className={styles.nom}>Un pin GPS</span>
          <span className={styles.description}>
            Marque ta position maintenant, et complète le plus tard. Idéal pour aller vite et profiter
            de ton explo.
          </span>
        </span>
        <img className={styles.chevron} src={chevron} alt="" />
      </button>
      {PLUS_TARD.map((c) => (
        <button key={c.titre} type="button" className={styles.choix} disabled>
          <img className={styles.icone} src={c.icone} alt="" />
          <span className={styles.texte}>
            <span className={styles.nom}>
              {c.titre} <span className={styles.bientot}>bientôt</span>
            </span>
            <span className={styles.description}>{c.texte}</span>
          </span>
          <img className={styles.chevron} src={chevron} alt="" />
        </button>
      ))}
    </Feuille>
  )
}

function Reprendre({
  brouillon,
  onReprendre,
}: {
  brouillon: Brouillon
  onReprendre: (etape: Etape) => void
}) {
  const vignette = useUrlDe(brouillon.photos[0]?.vignette)
  const etape = etapeDeReprise(brouillon)
  const nom = brouillon.nom.trim() || 'Ton lieu'
  return (
    <button
      type="button"
      className={styles.reprendre}
      onClick={() => {
        onReprendre(etape)
      }}
    >
      {vignette ? (
        <img className={styles.vignette} src={vignette} alt="" />
      ) : (
        <span className={styles.vignette} aria-hidden="true" />
      )}
      <span className={styles.texte}>
        <span className={styles.nom}>Reprendre ton brouillon</span>
        <span className={styles.reste}>
          {nom} · {CE_QUI_RESTE[etape]}
        </span>
      </span>
    </button>
  )
}
