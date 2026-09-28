/**
 * QUOI     — l'onglet Messages (maquette 45:278, spec V2 §10) : deux onglets en haut — « La
 *            communauté » (le Registre, public) et « Les Murmures » (privés).
 * POURQUOI — « le registre est public, les murmures sont privés » : deux lieux à part, pas un
 *            filtre.
 */
import { useState } from 'react'
import { Segments } from '@/shared/ui/Segments'
import styles from './MessagesScreen.module.css'
import { ListeMurmures } from './ListeMurmures'
import { Registre } from './Registre'

const VUES = [
  { id: 'communaute', libelle: 'La communauté' },
  { id: 'murmures', libelle: 'Les Murmures' },
] as const

export function MessagesScreen() {
  const [vue, setVue] = useState<'communaute' | 'murmures'>('communaute')
  return (
    <div className={styles.messages}>
      <div className={styles.onglets}>
        <Segments libelle="Messages" options={VUES} valeur={vue} onChange={setVue} />
      </div>
      {vue === 'communaute' ? <Registre /> : <ListeMurmures />}
    </div>
  )
}
