/**
 * QUOI     — « Sur la fiche produit » dans la fiche d'un Fragment : la préhistoire (« En bref »), le
 *            mot de l'artiste, la marque d'édition et sa précision ; « Enregistrer dans Shopify ».
 * POURQUOI — on écrit dans le Hub, ça vit dans Shopify (Uriel, 02/11) : la boutique les affiche sur la
 *            fiche produit, l'appli au Codex. Après l'écriture, la synchro les ramène en base.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Bouton } from '@/shared/ui/Bouton'
import { ecrireContenuMotif, type ContenuMotif } from '../api/contenuMotif'
import { resynchroniser, type Fragment } from '../api/fragments'
import styles from './Boutique.module.css'

type Motif = Pick<Fragment, 'id' | 'name' | 'shopify_handle' | 'resume' | 'mot_artiste' | 'edition' | 'edition_precision'>

const EDITIONS: { valeur: ContenuMotif['edition']; nom: string }[] = [
  { valeur: '', nom: 'Aucune' },
  { valeur: 'limitee', nom: 'Édition limitée' },
  { valeur: 'retire', nom: 'Retiré' },
  { valeur: 'exclusif', nom: 'Exclusif' },
]

function lireEdition(v: string | null): ContenuMotif['edition'] {
  return EDITIONS.find((e) => e.valeur === v)?.valeur ?? ''
}

export function ContenuDuMotif({ fragment }: { fragment: Motif }) {
  const client = useQueryClient()
  const [contenu, setContenu] = useState<ContenuMotif>({
    resume: fragment.resume ?? '',
    mot_de_l_artiste: fragment.mot_artiste ?? '',
    edition: lireEdition(fragment.edition),
    edition_precision: fragment.edition_precision ?? '',
  })
  const ecriture = useMutation({
    mutationFn: async (c: ContenuMotif) => {
      if (!fragment.shopify_handle) throw new Error('Aucune fiche Shopify reliée.')
      await ecrireContenuMotif(fragment.shopify_handle, c)
      await resynchroniser()
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['hub-fragments'] }),
  })
  const changer = (cle: keyof ContenuMotif) => (valeur: string) => {
    setContenu({ ...contenu, [cle]: valeur })
    ecriture.reset()
  }

  return (
    <div className={styles.formulaire}>
      <label className={styles.champ}>En bref (la préhistoire)
        <textarea rows={3} value={contenu.resume} onChange={(e) => { changer('resume')(e.target.value) }} />
      </label>
      <label className={styles.champ}>Le mot de l’artiste
        <textarea rows={5} value={contenu.mot_de_l_artiste} onChange={(e) => { changer('mot_de_l_artiste')(e.target.value) }} />
      </label>
      <label className={styles.champ}>Édition
        <select value={contenu.edition} onChange={(e) => { changer('edition')(e.target.value) }}>
          {EDITIONS.map((e) => <option key={e.valeur} value={e.valeur}>{e.nom}</option>)}
        </select>
      </label>
      <label className={styles.champ}>Précision de l’édition
        <input value={contenu.edition_precision} placeholder="Yggdrasil" onChange={(e) => { changer('edition_precision')(e.target.value) }} />
      </label>
      <div>
        <Bouton sorte="secondaire" disabled={!fragment.shopify_handle || ecriture.isPending} onClick={() => { ecriture.mutate(contenu) }}>
          Enregistrer dans Shopify
        </Bouton>
        {ecriture.isPending && <span className={styles.calme}> Écriture, puis synchro…</span>}
        {ecriture.isSuccess && <span role="status"> Enregistré dans Shopify.</span>}
        {ecriture.isError && <p className={styles.erreur} role="alert">{ecriture.error.message}</p>}
      </div>
    </div>
  )
}
