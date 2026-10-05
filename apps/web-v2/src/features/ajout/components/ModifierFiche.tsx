/**
 * QUOI     — « Modifier la fiche » (maquettes 304:397, 379:523, 381:236) : la photo et sa lisière, les
 *            champs de l'ajout (nom, natures, époque, année), puis deux onglets `Segments` — « Le
 *            récit » (son carnet) et « Infos en plus » (accès, quand y aller, bon à savoir, bivouac
 *            toléré ; Uriel, 05/10) —, les photos, « Un mot sur ta modification », « Enregistrer les
 *            changements » : un seul enregistrement, une seule version.
 * POURQUOI — faire vivre un lieu : ouvert à qui l'a découvert, chaque enregistrement est une
 *            version (mig 387) qu'on retrouve dans « L'histoire de la fiche » ; les photos ajoutées
 *            rejoignent la fiche (mig 388). Les champs sont ceux de l'ajout (ChampsDuLieu) : les
 *            deux écrans ne divergent jamais.
 * ATTENTION — le formulaire naît une fois la fiche lue : ses valeurs de départ ne bougent plus.
 *            `onModifie` dit à la route s'il y a quelque chose à perdre (« Abandonner ? »).
 */
import acces from '@/assets/ui/acces.svg'
import bivouac from '@/assets/ui/bivouac.svg'
import bonASavoir from '@/assets/ui/bon-a-savoir.svg'
import quand from '@/assets/ui/quand.svg'
import { aLaTaille } from '@/shared/lib/image'
import { useEffect, useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Segments } from '@/shared/ui/Segments'
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
  const code =
    typeof erreur === 'object' && erreur !== null && 'code' in erreur ? erreur.code : null
  if (code === '22023') return 'Un champ est trop long : 1 000 signes au plus par rubrique.'
  return 'Les changements n’ont pas pu être enregistrés. Vérifie les champs, puis réessaie.'
}

const ONGLETS = [
  { id: 'recit', libelle: 'Le récit' },
  { id: 'infos', libelle: 'Infos en plus' },
] as const

const RUBRIQUES = [
  {
    cle: 'acces',
    titre: 'Accès',
    icone: acces,
    exemple: 'Comment y aller : « vingt minutes à pied depuis le hameau »',
  },
  {
    cle: 'quand',
    titre: 'Quand y aller',
    icone: quand,
    exemple: 'La saison, le moment : « au printemps, tôt le matin »',
  },
  {
    cle: 'bonASavoir',
    titre: 'Bon à savoir',
    icone: bonASavoir,
    exemple: 'Un conseil, une précaution : « la visite coûte 5 € », « attention au bétail »…',
  },
] as const

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
  const [onglet, setOnglet] = useState<'recit' | 'infos'>('recit')
  const aideDuMot = useId()
  const photo = aLaTaille(depart.photos[0]?.url ?? null, 430)

  const champsChanges =
    valeur.nom.trim() !== depart.nom ||
    valeur.natures.join() !== depart.natures.join() ||
    valeur.epoque !== depart.epoque ||
    valeur.annee !== depart.annee ||
    valeur.recit.trim() !== depart.recit ||
    valeur.acces.trim() !== depart.acces ||
    valeur.quand.trim() !== depart.quand ||
    valeur.bonASavoir.trim() !== depart.bonASavoir ||
    valeur.bivouacTolere !== depart.bivouacTolere
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
          {
            ...valeur,
            nom: valeur.nom.trim(),
            recit: valeur.recit.trim(),
            acces: valeur.acces.trim(),
            quand: valeur.quand.trim(),
            bonASavoir: valeur.bonASavoir.trim(),
          },
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

        <Segments
          libelle="Le récit ou les infos en plus"
          options={ONGLETS}
          valeur={onglet}
          onChange={setOnglet}
        />
        {/* Les deux onglets restent montés : la saisie de l'un survit quand on passe à l'autre. */}
        <div hidden={onglet !== 'recit'} className={recit.carnet}>
          <textarea
            className={recit.texte}
            aria-label="Le récit"
            maxLength={10000}
            value={valeur.recit}
            onChange={(e) => {
              setValeur((avant) => ({ ...avant, recit: e.target.value }))
            }}
          />
          <span className={recit.compte}>{valeur.recit.length} signes</span>
        </div>
        <div hidden={onglet !== 'infos'} className={styles.infos}>
          {RUBRIQUES.map((r) => (
            <label key={r.cle} className={styles.rubrique}>
              <span className={nom.etiquette}>
                <img src={r.icone} alt="" className={styles.icone} />
                {r.titre}
              </span>
              <textarea
                className={styles.champ}
                aria-label={r.titre}
                maxLength={1000}
                rows={4}
                placeholder={r.exemple}
                value={valeur[r.cle]}
                onChange={(e) => {
                  setValeur((avant) => ({ ...avant, [r.cle]: e.target.value }))
                }}
              />
            </label>
          ))}
          <label className={styles.case}>
            <input
              type="checkbox"
              checked={valeur.bivouacTolere}
              onChange={(e) => {
                setValeur((avant) => ({ ...avant, bivouacTolere: e.target.checked }))
              }}
            />
            <img src={bivouac} alt="" className={styles.icone} />
            Bivouac toléré
          </label>
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
        <div className={styles.mot}>
          <label className={styles.mot}>
            <span className={styles.motTitre}>
              Un mot sur ta modification <span className={styles.facultatif}>(facultatif)</span>
            </span>
            <input
              className={styles.note}
              aria-describedby={aideDuMot}
              placeholder={
                onglet === 'recit'
                  ? 'Ex. : « ajouté l’histoire de la porte »'
                  : 'Ex. : « précisé l’accès depuis le hameau »'
              }
              maxLength={140}
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
              }}
            />
          </label>
          <span id={aideDuMot} className={styles.aide}>
            Il s’affiche dans l’histoire de la fiche, à côté de ton nom.
          </span>
        </div>
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
