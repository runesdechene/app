/**
 * QUOI     — « Modifier la fiche » (maquette « Lieu — modifier la fiche », 30/09) : la photo et sa
 *            lisière, les champs de l'ajout (nom, natures, époque, année), le récit dans son
 *            carnet, un mot sur ce qui a changé, « Enregistrer les changements ».
 * POURQUOI — faire vivre un lieu : ouvert à qui l'a découvert, chaque enregistrement est une
 *            version (mig 387) qu'on retrouve dans « L'histoire de la fiche ». Les champs sont ceux
 *            de l'ajout (ChampsDuLieu) : les deux écrans ne divergent jamais.
 * ATTENTION — le formulaire naît une fois la fiche lue : ses valeurs de départ ne bougent plus.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { fetchFicheAModifier, modifierLieu } from '../api/ajout'
import type { Fiche } from '../api/lireAjout'
import { ChampsDuLieu } from './ChampsDuLieu'
import nom from './EtapeNom.module.css'
import recit from './EtapeRecit.module.css'
import styles from './ModifierFiche.module.css'

// La base refuse avec un indice (mig 387) : chacun a sa phrase.
function messageDeRefus(erreur: unknown): string {
  const indice =
    typeof erreur === 'object' && erreur !== null && 'hint' in erreur ? erreur.hint : null
  if (indice === 'rien') return 'Rien n’a changé : touche un champ avant d’enregistrer.'
  if (indice === 'decouvrir') return 'Découvre ce lieu sur la carte avant de le modifier.'
  if (indice === 'limite') return 'Cinquante modifications aujourd’hui : reviens demain.'
  return 'Les changements n’ont pas pu être enregistrés. Vérifie les champs, puis réessaie.'
}

export function ModifierFiche({ id, onFini }: { id: string; onFini: () => void }) {
  const fiche = useQuery({
    queryKey: ['ajout', 'modifier', id],
    queryFn: () => fetchFicheAModifier(id),
    staleTime: 0,
  })
  if (fiche.isError) return <EmptyState>La fiche n’a pas pu être chargée</EmptyState>
  if (fiche.data === undefined) return <div className={styles.chargement} aria-busy="true" />
  if (fiche.data === null)
    return <EmptyState>Ce lieu n’existe pas ou n’est plus visible</EmptyState>
  return <Formulaire id={id} depart={fiche.data} onFini={onFini} />
}

function Formulaire({ id, depart, onFini }: { id: string; depart: Fiche; onFini: () => void }) {
  const queryClient = useQueryClient()
  const [valeur, setValeur] = useState(depart)
  const [note, setNote] = useState('')
  const enregistrer = useMutation({
    mutationFn: () =>
      modifierLieu(id, { ...valeur, nom: valeur.nom.trim(), recit: valeur.recit.trim() }, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['lieu', id] })
      void queryClient.invalidateQueries({ queryKey: ['carte', 'lieux'] })
      onFini()
    },
  })
  const complet =
    valeur.nom.trim() !== '' && valeur.natures.length > 0 && valeur.recit.trim() !== ''

  return (
    <div className={styles.modifier}>
      <div className={nom.photo}>{depart.photo && <img src={depart.photo} alt="" />}</div>
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
          disabled={!complet || enregistrer.isPending}
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
