/**
 * QUOI     — écrire dans le Carnet de passage : « Laisse un mot sur ce lieu… », l'appareil pour y
 *            joindre jusqu'à quatre photos, « Envoyer » dès qu'il y a un mot. En réponse, le même
 *            champ, plus petit, sous le mot auquel on répond.
 * POURQUOI — un seul champ pour écrire et répondre ; chaque photo est réduite dès qu'elle est
 *            choisie, comme à l'ajout d'un lieu. Un refus se dit en clair ; le mot reste écrit.
 */
import { useState } from 'react'
import appareil from '@/assets/ui/appareil-photo.svg'
import { useUrlDe } from '@/shared/hooks/useUrlDe'
import { preparerPhoto, type PhotoAEnvoyer } from '@/shared/lib/photo'
import type { Ecrit } from '../hooks/useCarnet'
import styles from './Carnet.module.css'

const MAX_PHOTOS = 4

function messageDeRefus(erreur: unknown): string {
  const indice =
    typeof erreur === 'object' && erreur !== null && 'hint' in erreur ? erreur.hint : null
  if (indice === 'decouvrir') return 'Découvre ce lieu sur la carte avant d’y laisser un mot.'
  if (indice === 'limite') return 'Trente mots aujourd’hui : reviens demain.'
  return 'Le mot n’est pas parti. Réessaie dans un instant : il t’attend.'
}

export function EcrireAuCarnet({
  parent = null,
  indication = 'Laisse un mot sur ce lieu…',
  onEcrire,
  enCours,
  erreur,
  onEcrit,
}: {
  parent?: number | null
  indication?: string
  onEcrire: (ecrit: Ecrit, options: { onSuccess: () => void }) => void
  enCours: boolean
  erreur: unknown
  onEcrit?: () => void
}) {
  const [texte, setTexte] = useState('')
  const [photos, setPhotos] = useState<PhotoAEnvoyer[]>([])
  const [enPreparation, setEnPreparation] = useState(0)

  async function joindre(fichiers: FileList | null) {
    const choisis = [...(fichiers ?? [])].slice(0, MAX_PHOTOS - photos.length)
    setEnPreparation(choisis.length)
    for (const fichier of choisis) {
      try {
        const preparee = await preparerPhoto(fichier)
        setPhotos((avant) => [...avant, { id: crypto.randomUUID(), ...preparee }])
      } catch {
        // Une photo illisible est laissée de côté ; les autres partent.
      }
      setEnPreparation((n) => n - 1)
    }
  }

  const envoyer = () => {
    onEcrire(
      { texte: texte.trim(), photos, parent },
      {
        onSuccess: () => {
          setTexte('')
          setPhotos([])
          onEcrit?.()
        },
      },
    )
  }

  return (
    <div className={styles.ecrire} data-reponse={parent !== null || undefined}>
      <div className={styles.champ}>
        <textarea
          className={styles.texte}
          aria-label={indication}
          placeholder={indication}
          maxLength={2000}
          rows={texte === '' ? 1 : 3}
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value)
          }}
        />
        {photos.length < MAX_PHOTOS && (
          <label className={styles.appareil} aria-label="Joindre des photos">
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              disabled={enCours || enPreparation > 0}
              onChange={(e) => {
                void joindre(e.target.files)
                e.target.value = ''
              }}
            />
            <img src={appareil} alt="" />
          </label>
        )}
      </div>
      {photos.length > 0 && (
        <ul className={styles.jointes} aria-label="Photos jointes">
          {photos.map((p) => (
            <Jointe
              key={p.id}
              photo={p}
              onRetirer={() => {
                setPhotos((avant) => avant.filter((q) => q.id !== p.id))
              }}
            />
          ))}
        </ul>
      )}
      {erreur !== null && erreur !== undefined && (
        <p className={styles.refus} role="alert">
          {messageDeRefus(erreur)}
        </p>
      )}
      {texte.trim() !== '' && (
        <button
          type="button"
          className={styles.envoyer}
          disabled={enCours || enPreparation > 0}
          onClick={envoyer}
        >
          {enCours ? 'Envoi…' : 'Envoyer'}
        </button>
      )}
    </div>
  )
}

function Jointe({ photo, onRetirer }: { photo: PhotoAEnvoyer; onRetirer: () => void }) {
  const url = useUrlDe(photo.vignette)
  return (
    <li className={styles.jointe}>
      {url && <img src={url} alt="" />}
      <button type="button" className={styles.retirer} aria-label="Retirer" onClick={onRetirer}>
        ×
      </button>
    </li>
  )
}
