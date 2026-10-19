/**
 * QUOI     — la feuille « J'y suis allé » (maquette 649:1678) : le mois et l'année du passage, une
 *            photo et un mot pour le Carnet de passage (facultatifs), « Ajouter à mon passeport ».
 * POURQUOI — un lieu visité avant Explore rejoint le passeport sans jamais se revendiquer (spec
 *            2026-10-19). La feuille ne propose que des mois passés, comme la base l'exige.
 * ATTENTION — le carnet veut un mot : une photo seule ne part pas, on le dit sous le champ.
 */
import { useState } from 'react'
import { useUrlDe } from '@/shared/hooks/useUrlDe'
import { preparerPhoto, type PhotoAEnvoyer } from '@/shared/lib/photo'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import { useSouvenir } from '../hooks/useSouvenir'
import { anneesPossibles, jySuisAlle, MOIS, moisPasse } from '../lib/souvenir'
import styles from './FeuilleJySuisAlle.module.css'

export function FeuilleJySuisAlle({
  id,
  genre,
  onFermer,
}: {
  id: string
  genre: 'm' | 'f'
  onFermer: () => void
}) {
  const maintenant = new Date()
  const [mois, setMois] = useState<number | null>(null)
  const [annee, setAnnee] = useState(maintenant.getFullYear())
  const [mot, setMot] = useState('')
  const [photo, setPhoto] = useState<PhotoAEnvoyer | null>(null)
  const [motPerdu, setMotPerdu] = useState(false)
  const { declarer, enCours, erreur } = useSouvenir(id)
  const titre = jySuisAlle(genre)

  const dateValide = mois !== null && moisPasse(annee, mois, maintenant)
  const photoSansMot = photo !== null && mot.trim() === ''

  async function joindre(fichier: File | undefined) {
    if (!fichier) return
    try {
      setPhoto({ id: crypto.randomUUID(), ...(await preparerPhoto(fichier)) })
    } catch {
      // Une photo illisible est laissée de côté.
    }
  }

  function envoyer() {
    if (mois === null) return
    declarer({ annee, mois, mot: mot.trim(), photo }).then(
      (r) => {
        if (r.motPerdu) setMotPerdu(true)
        else onFermer()
      },
      () => undefined,
    ) // le refus est écrit par `erreur`
  }

  if (motPerdu) {
    return (
      <Feuille titre={titre} onFermer={onFermer}>
        <h2 className={styles.titre}>C’est noté</h2>
        <p className={styles.consigne}>
          Ton souvenir est dans ton passeport. Ton mot n’est pas parti : laisse-le depuis le Carnet
          de passage du lieu.
        </p>
        <Button kind="doux" onClick={onFermer}>
          Fermer
        </Button>
      </Feuille>
    )
  }

  return (
    <Feuille titre={titre} onFermer={onFermer}>
      <h2 className={styles.titre}>{titre}</h2>
      <p className={styles.consigne}>
        Un lieu que tu as visité avant Explore ? Il rejoint ton passeport. Pour le revendiquer, il
        faudra y retourner.
      </p>

      <p className={styles.etiquette}>Quand ? Au mois près</p>
      <div className={styles.quand}>
        <select
          className={styles.champ}
          aria-label="Mois"
          value={mois ?? ''}
          onChange={(e) => {
            setMois(e.target.value === '' ? null : Number(e.target.value))
          }}
        >
          <option value="">Mois</option>
          {MOIS.map((nom, i) => (
            <option key={nom} value={i + 1} disabled={!moisPasse(annee, i + 1, maintenant)}>
              {nom.charAt(0).toUpperCase() + nom.slice(1)}
            </option>
          ))}
        </select>
        <select
          className={styles.champ}
          aria-label="Année"
          value={annee}
          onChange={(e) => {
            setAnnee(Number(e.target.value))
          }}
        >
          {anneesPossibles(maintenant).map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <p className={styles.etiquette}>Une photo de ton passage (facultatif)</p>
      {photo ? (
        <Apercu
          photo={photo}
          onRetirer={() => {
            setPhoto(null)
          }}
        />
      ) : (
        <label className={styles.photo}>
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              void joindre(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          ＋ Ajouter une photo
        </label>
      )}

      <p className={styles.etiquette}>Un mot pour le Carnet de passage (facultatif)</p>
      <textarea
        className={styles.champ}
        aria-label="Un mot pour le Carnet de passage"
        placeholder="Ce jour-là…"
        maxLength={2000}
        rows={3}
        value={mot}
        onChange={(e) => {
          setMot(e.target.value)
        }}
      />
      {photoSansMot && <p className={styles.aide}>Un mot accompagne ta photo dans le carnet.</p>}

      {erreur && (
        <p className={styles.refus} role="alert">
          {erreur}
        </p>
      )}
      <Button disabled={!dateValide || photoSansMot || enCours} onClick={envoyer}>
        {enCours ? 'Envoi…' : 'Ajouter à mon passeport'}
      </Button>
    </Feuille>
  )
}

function Apercu({ photo, onRetirer }: { photo: PhotoAEnvoyer; onRetirer: () => void }) {
  const url = useUrlDe(photo.vignette)
  return (
    <div className={styles.apercu}>
      {url && <img src={url} alt="" />}
      <button type="button" className={styles.retirer} onClick={onRetirer}>
        Retirer
      </button>
    </div>
  )
}
