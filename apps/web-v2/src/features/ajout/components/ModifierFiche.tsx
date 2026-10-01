/**
 * QUOI     — « Modifier la fiche » (maquette « Lieu — modifier la fiche », 30/09) : la photo et sa
 *            lisière, les champs de l'ajout (nom, natures, époque, année), le récit dans son
 *            carnet, les photos (celles du lieu, puis « ＋ Ajouter des photos »), un mot sur ce qui
 *            a changé, « Enregistrer les changements ».
 * POURQUOI — faire vivre un lieu : ouvert à qui l'a découvert, chaque enregistrement est une
 *            version (mig 387) qu'on retrouve dans « L'histoire de la fiche » ; les photos ajoutées
 *            rejoignent la fiche (mig 388). Les champs sont ceux de l'ajout (ChampsDuLieu) : les
 *            deux écrans ne divergent jamais.
 * ATTENTION — le formulaire naît une fois la fiche lue : ses valeurs de départ ne bougent plus.
 *            `onModifie` dit à la route s'il y a quelque chose à perdre (« Abandonner ? »).
 */
import { aLaTaille } from '@/shared/lib/image'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ajouterPhotosLieu, fetchFicheAModifier, modifierLieu } from '../api/ajout'
import type { Fiche } from '../api/lireAjout'
import { useUrlDe } from '@/shared/hooks/useUrlDe'
import type { PhotoBrouillon } from '../lib/brouillon'
import { preparerPhoto } from '@/shared/lib/photo'
import { ChampsDuLieu } from './ChampsDuLieu'
import nom from './EtapeNom.module.css'
import recit from './EtapeRecit.module.css'
import styles from './ModifierFiche.module.css'

// La base refuse avec un indice (migs 387, 388) : chacun a sa phrase.
function messageDeRefus(erreur: unknown): string {
  const indice =
    typeof erreur === 'object' && erreur !== null && 'hint' in erreur ? erreur.hint : null
  if (indice === 'rien') return 'Rien n’a changé : touche un champ avant d’enregistrer.'
  if (indice === 'decouvrir') return 'Découvre ce lieu sur la carte avant de le modifier.'
  if (indice === 'limite') return 'Beaucoup de changements aujourd’hui : reviens demain.'
  if (indice === 'plein') return 'Ce lieu a déjà trente photos : c’est le plafond.'
  return 'Les changements n’ont pas pu être enregistrés. Vérifie les champs, puis réessaie.'
}

export function ModifierFiche({
  id,
  onFini,
  onModifie,
}: {
  id: string
  onFini: () => void
  onModifie: (modifie: boolean) => void
}) {
  const fiche = useQuery({
    queryKey: ['ajout', 'modifier', id],
    queryFn: () => fetchFicheAModifier(id),
    staleTime: 0,
  })
  if (fiche.isError) return <EmptyState>La fiche n’a pas pu être chargée</EmptyState>
  if (fiche.data === undefined) return <div className={styles.chargement} aria-busy="true" />
  if (fiche.data === null)
    return <EmptyState>Ce lieu n’existe pas ou n’est plus visible</EmptyState>
  return <Formulaire id={id} depart={fiche.data} onFini={onFini} onModifie={onModifie} />
}

function Formulaire({
  id,
  depart,
  onFini,
  onModifie,
}: {
  id: string
  depart: Fiche
  onFini: () => void
  onModifie: (modifie: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [valeur, setValeur] = useState(depart)
  const [nouvelles, setNouvelles] = useState<PhotoBrouillon[]>([])
  const [note, setNote] = useState('')
  const photo = aLaTaille(depart.photos[0]?.url ?? null, 430)

  const champsChanges =
    valeur.nom.trim() !== depart.nom ||
    valeur.natures.join() !== depart.natures.join() ||
    valeur.epoque !== depart.epoque ||
    valeur.annee !== depart.annee ||
    valeur.recit.trim() !== depart.recit
  const modifie = champsChanges || nouvelles.length > 0 || note.trim() !== ''
  const complet =
    valeur.nom.trim() !== '' && valeur.natures.length > 0 && valeur.recit.trim() !== ''

  // La route demande « Abandonner ? » seulement s'il y a quelque chose à perdre.
  useEffect(() => {
    onModifie(modifie)
  }, [modifie, onModifie])

  const enregistrer = useMutation({
    mutationFn: async () => {
      if (nouvelles.length > 0) await ajouterPhotosLieu(id, nouvelles)
      if (champsChanges) {
        await modifierLieu(
          id,
          { ...valeur, nom: valeur.nom.trim(), recit: valeur.recit.trim() },
          note,
        )
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lieu', id] })
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
      onModifie(false)
      onFini()
    },
  })

  return (
    <div className={styles.modifier}>
      <div className={nom.photo}>{photo && <img src={photo} alt="" />}</div>
      <div className={nom.corps}>
        <ChampsDuLieu
          valeur={valeur}
          changer={(partiel) => {
            setValeur((avant) => ({ ...avant, ...partiel }))
          }}
        />

        <h2 className={nom.etiquette}>Son récit</h2>
        <div className={recit.carnet}>
          <textarea
            className={recit.texte}
            aria-label="Son récit"
            maxLength={5000}
            value={valeur.recit}
            onChange={(e) => {
              setValeur((avant) => ({ ...avant, recit: e.target.value }))
            }}
          />
          <span className={recit.compte}>{valeur.recit.length} signes</span>
        </div>

        <h2 className={nom.etiquette}>Ses photos</h2>
        <Photos
          existantes={depart.photos}
          nouvelles={nouvelles}
          changer={setNouvelles}
          desactive={enregistrer.isPending}
        />
      </div>

      <div className={styles.pied}>
        <input
          className={styles.note}
          aria-label="Ce que tu as changé"
          placeholder="Ce que tu as changé, en un mot (facultatif)"
          maxLength={140}
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
          }}
        />
        {enregistrer.isError && (
          <p className={styles.refus} role="alert">
            {messageDeRefus(enregistrer.error)}
          </p>
        )}
        <Button
          disabled={!complet || !(champsChanges || nouvelles.length > 0) || enregistrer.isPending}
          onClick={() => {
            enregistrer.mutate()
          }}
        >
          {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer les changements'}
        </Button>
      </div>
    </div>
  )
}

// Les photos : celles du lieu (on les voit), puis les nouvelles (on peut les retirer avant
// d'enregistrer). Chaque photo choisie est réduite aussitôt, comme à l'ajout.
function Photos({
  existantes,
  nouvelles,
  changer,
  desactive,
}: {
  existantes: Fiche['photos']
  nouvelles: PhotoBrouillon[]
  changer: (f: (avant: PhotoBrouillon[]) => PhotoBrouillon[]) => void
  desactive: boolean
}) {
  const [enPreparation, setEnPreparation] = useState(0)
  const [illisible, setIllisible] = useState(false)
  const place = Math.max(0, 30 - existantes.length - nouvelles.length)

  async function ajouter(fichiers: FileList | null) {
    const choisis = [...(fichiers ?? [])].slice(0, Math.min(10 - nouvelles.length, place))
    if (choisis.length === 0) return
    setIllisible(false)
    setEnPreparation(choisis.length)
    for (const fichier of choisis) {
      try {
        const preparee = await preparerPhoto(fichier)
        changer((avant) => [...avant, { id: crypto.randomUUID(), ...preparee }])
      } catch {
        setIllisible(true)
      }
      setEnPreparation((n) => n - 1)
    }
  }

  return (
    <div className={styles.photos}>
      <ul className={styles.vignettes} aria-label="Ses photos">
        {existantes.map((p) => (
          <li key={p.url} className={styles.vignette}>
            <img src={aLaTaille(p.vignette, 64)} alt="" loading="lazy" decoding="async" />
          </li>
        ))}
        {nouvelles.map((p) => (
          <Nouvelle
            key={p.id}
            photo={p}
            desactive={desactive || enPreparation > 0}
            onRetirer={() => {
              changer((avant) => avant.filter((q) => q.id !== p.id))
            }}
          />
        ))}
      </ul>
      {enPreparation > 0 && (
        <p className={styles.etat} role="status">
          Préparation de {enPreparation > 1 ? `${String(enPreparation)} photos` : 'la photo'}…
        </p>
      )}
      {illisible && (
        <p className={styles.etat} role="alert">
          Une photo n’a pas pu être lue. Essaie avec une autre.
        </p>
      )}
      {place > 0 && nouvelles.length < 10 && (
        <label className={styles.ajouter}>
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            disabled={desactive || enPreparation > 0}
            onChange={(e) => {
              void ajouter(e.target.files)
              e.target.value = '' // la même photo peut être reprise plus tard
            }}
          />
          ＋ Ajouter des photos
        </label>
      )}
    </div>
  )
}

function Nouvelle({
  photo,
  desactive,
  onRetirer,
}: {
  photo: PhotoBrouillon
  desactive: boolean
  onRetirer: () => void
}) {
  const url = useUrlDe(photo.vignette)
  return (
    <li className={styles.vignette} data-nouvelle>
      {url && <img src={url} alt="" />}
      <button
        type="button"
        className={styles.retirer}
        aria-label="Retirer cette photo"
        disabled={desactive}
        onClick={onRetirer}
      >
        ×
      </button>
    </li>
  )
}
