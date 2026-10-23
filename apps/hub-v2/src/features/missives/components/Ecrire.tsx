/**
 * QUOI     — « Écrire une Missive » (maquette 753:2529) : les réglages à gauche, l'e-mail à droite tel qu'il
 *            partira, à 600 px, où l'on écrit directement — un titre, un texte, une photo se touchent pour
 *            se changer. En bas des réglages : programmer, s'envoyer un essai, garder le brouillon.
 * POURQUOI — Uriel veut écrire dans le modèle entier, pas remplir un formulaire (22/10). L'e-mail affiché
 *            est le composant même que rend l'envoi (@runes/missives), en mode édition.
 * ATTENTION — une photo se penche et se pose sur le fond du moment (lib/pencher) : changer les couleurs
 *             après coup demande de la reposer.
 */
import { Carnet, Fragment, Missive, contrasteSuffisant, deduireCouleurs, type Edition } from '@runes/missives'
import { useRef, useState, type MouseEvent } from 'react'
import { useParams } from 'react-router'
import { verifierFichier } from '@/shared/lib/envoi'
import { Bouton } from '@/shared/ui/Bouton'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { deposerPhoto } from '../api/missives'
import { useListes } from '../hooks/useListes'
import { useMissive } from '../hooks/useMissive'
import { changerZone, indicationsRestantes, type Brouillon } from '../lib/brouillon'
import { placeDePhoto } from '../lib/liens'
import { pencher } from '../lib/pencher'
import styles from './Ecrire.module.css'
import { Pastilles } from './Pastilles'
import { Reglages } from './Reglages'

const nombre = new Intl.NumberFormat('fr-FR')
const PHOTOS = { types: ['image/jpeg', 'image/png', 'image/webp'], maxOctets: 20 * 1024 * 1024 }

function Lettre({ b, edition }: { b: Brouillon; edition: Edition }) {
  const props = { couleurs: b.couleurs, apercu: b.apercu, edition }
  if (b.lettre.modele === 'missive') return <Missive {...props} contenu={b.lettre.contenu} />
  if (b.lettre.modele === 'fragment') return <Fragment {...props} contenu={b.lettre.contenu} />
  return <Carnet {...props} contenu={b.lettre.contenu} />
}

/** Une adresse, une Missive : changer d'adresse repart de zéro, sans garder la lettre précédente en mémoire. */
export function EcrireMissive() {
  const { id } = useParams()
  return <Ecrire key={id ?? 'neuve'} id={id ? Number(id) : null} />
}

export function Ecrire({ id = null }: { id?: number | null }) {
  const missive = useMissive(id)
  const listes = useListes()
  const [quand, setQuand] = useState<'maintenant' | 'plus-tard'>('maintenant')
  const [heure, setHeure] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const choixDePhoto = useRef<HTMLInputElement>(null)
  const zoneDePhoto = useRef<string | null>(null)
  const b = missive.brouillon

  if (missive.erreurDeLecture) return <p role="alert">Cette Missive n’a pas pu se charger : {missive.erreurDeLecture.message}</p>
  if (!b) return <p>Un instant…</p>

  const changer = (suivant: Brouillon) => {
    setMessage(null)
    missive.changer(suivant)
  }
  const edition: Edition = {
    onChange: (zone, valeur) => {
      changer(changerZone(b, zone, valeur))
    },
  }
  const personnes = listes.data?.find((l) => l.cle === b.liste)?.avecAccord ?? 0
  const restes = indicationsRestantes(b.lettre)
  const pret =
    contrasteSuffisant(b.couleurs) && restes.length === 0 && b.liste !== null && b.objet.trim() !== '' && (quand === 'maintenant' || heure !== '')
  const enCours = missive.programmer.isPending || missive.essai.isPending || missive.enregistrer.isPending
  const erreur = missive.programmer.error ?? missive.essai.error ?? missive.enregistrer.error

  // Dans l'e-mail, un lien ne mène nulle part (son adresse se règle à gauche) ; une photo se remplace.
  function toucher(e: MouseEvent) {
    if (!(e.target instanceof Element)) return
    if (e.target.closest('a')) e.preventDefault()
    const photo = e.target.closest('img[data-zone]')
    if (photo) {
      zoneDePhoto.current = photo.getAttribute('data-zone')
      choixDePhoto.current?.click()
    }
  }

  async function poserPhoto(fichier: File | undefined) {
    const zone = zoneDePhoto.current
    if (!fichier || !zone || !b) return
    const refus = verifierFichier(fichier, PHOTOS)
    if (refus) {
      setMessage(refus)
      return
    }
    setMessage('La photo se prépare…')
    try {
      const place = placeDePhoto(b.lettre, zone)
      const couleurs = deduireCouleurs(b.couleurs)
      const url = await deposerPhoto(await pencher(fichier, place.degres, place.sur === 'rupture' ? couleurs.rupture : couleurs.fond))
      changer(changerZone(b, zone, url))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'La photo n’a pas pu être posée.')
    }
  }

  const boutons = (
    <div className={styles.boutons}>
      <Bouton
        sorte="secondaire"
        disabled={enCours}
        onClick={() => {
          missive.enregistrer.mutate(b, { onSuccess: () => { setMessage('Brouillon enregistré.') } })
        }}
      >
        Enregistrer le brouillon
      </Bouton>
      <Bouton
        sorte="secondaire"
        disabled={enCours}
        onClick={() => {
          missive.essai.mutate(b, { onSuccess: () => { setMessage('L’essai est parti vers ta boîte.') } })
        }}
      >
        M’envoyer un essai
      </Bouton>
      <Bouton
        disabled={!pret || enCours}
        onClick={() => {
          missive.programmer.mutate(
            { b, quand: quand === 'maintenant' ? null : new Date(heure).toISOString() },
            { onSuccess: () => { setMessage(quand === 'maintenant' ? 'Elle part dans les cinq minutes.' : 'Programmée.') } },
          )
        }}
      >
        {`Programmer pour ${nombre.format(personnes)} personne${personnes > 1 ? 's' : ''}`}
      </Bouton>
    </div>
  )

  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Missives"
        titre="Écrire une Missive"
        phrase="Tu écris directement dans l’e-mail : touche un titre, un texte ou une photo pour le changer."
        aDroite={boutons}
      />
      {(restes.length > 0 || message || erreur) && (
        <div className={styles.etat}>
          {restes.length > 0 && <p className={styles.aide}>Reste à remplacer : {restes.join(', ')}.</p>}
          {message && <p className={styles.aide} role="status">{message}</p>}
          {erreur && <p className={styles.alerte} role="alert">{erreur.message}</p>}
        </div>
      )}
      <div className={styles.atelier}>
        <aside className={styles.reglages}>
          <Reglages b={b} onChange={changer} listes={listes.data} />
          <section className={styles.carte}>
            <Pastilles
              nom="Quand"
              options={[{ valeur: 'maintenant', libelle: 'Maintenant' }, { valeur: 'plus-tard', libelle: 'Plus tard' }]}
              choisi={quand}
              onChoix={setQuand}
            />
            {quand === 'plus-tard' && (
              <label className={styles.champ}>
                <span className={styles.rubrique}>Le jour et l’heure</span>
                <input type="datetime-local" value={heure} onChange={(e) => { setHeure(e.target.value) }} />
              </label>
            )}
          </section>
        </aside>
        <div className={styles.lettre} onClickCapture={toucher}>
          <Lettre b={b} edition={edition} />
        </div>
      </div>
      <input
        ref={choixDePhoto}
        type="file"
        accept={PHOTOS.types.join(',')}
        hidden
        onChange={(e) => {
          void poserPhoto(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
