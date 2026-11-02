/**
 * QUOI     — « Le titre du Porteur » dans la fiche d'un Fragment : le nom du titre que gagne qui le
 *            porte (« Fils de Sparte »), et « Enregistrer le titre ».
 * POURQUOI — un cadeau du Porteur au Codex (spec 02/11) ; c'est un titre comme les autres (table
 *            titles, migration 580), qu'il porte sous son nom. Un nom vide laisse le titre tel quel.
 */
import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Bouton } from '@/shared/ui/Bouton'
import { ecrireTitreDuFragment, lireTitreDuFragment } from '../api/collections'
import styles from './Boutique.module.css'

function Formulaire({ fragment, enPlace }: { fragment: number; enPlace: string | null }) {
  const [nom, setNom] = useState(enPlace ?? '')
  const ecriture = useMutation({ mutationFn: (n: string) => ecrireTitreDuFragment(fragment, n) })
  return (
    <div className={styles.formulaire}>
      <label className={styles.champ}>Le titre de qui le porte
        <input value={nom} placeholder="Fils de Sparte" onChange={(e) => { setNom(e.target.value); ecriture.reset() }} />
      </label>
      <div>
        <Bouton sorte="secondaire" disabled={ecriture.isPending} onClick={() => { ecriture.mutate(nom) }}>Enregistrer le titre</Bouton>
        {ecriture.isSuccess && <span role="status"> Enregistré.</span>}
        {ecriture.isError && <p role="alert">{ecriture.error.message}</p>}
      </div>
    </div>
  )
}

export function TitreDuFragment({ fragment }: { fragment: number }) {
  const { data, isPending, isError } = useQuery({ queryKey: ['hub-titre-fragment', fragment], queryFn: () => lireTitreDuFragment(fragment) })
  if (isPending) return null
  if (isError) return <p role="alert">Le titre n’a pas pu être lu.</p>
  return <Formulaire fragment={fragment} enPlace={data} />
}
