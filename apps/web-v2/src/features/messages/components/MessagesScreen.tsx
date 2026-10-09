/**
 * QUOI     — l'onglet Messages (maquette 45:278, spec V2 §10) : deux onglets en haut — « La
 *            communauté » (le Registre, public) et « Les Murmures » (privés).
 * POURQUOI — « le registre est public, les murmures sont privés » : deux lieux à part, pas un
 *            filtre. Chacun dit ce qui attend (Uriel, 30/09) : le rouge, avec son nombre, pour ce
 *            qui m'est adressé — les Murmures non lus, les mentions de moi dans la communauté ; le
 *            point brun, sans nombre, pour les messages ratés de la communauté.
 */
import { useState } from 'react'
import { Pastille } from '@/shared/ui/Pastille'
import { Segments } from '@/shared/ui/Segments'
import { useNonLus } from '../hooks/useMurmures'
import { useRegistreNonLus } from '../hooks/useRegistre'
import styles from './MessagesScreen.module.css'
import { ListeMurmures } from './ListeMurmures'
import { Registre } from './Registre'

export function MessagesScreen() {
  const [vue, setVue] = useState<'communaute' | 'murmures'>('communaute')
  const murmures = useNonLus()
  const registre = useRegistreNonLus()
  const vues = [
    {
      id: 'communaute',
      libelle: 'La communauté',
      marque:
        registre.mentions > 0 ? (
          <Pastille count={registre.mentions} />
        ) : (
          <Pastille count={registre.messages} discrete />
        ),
    },
    { id: 'murmures', libelle: 'Les Murmures', marque: <Pastille count={murmures} /> },
  ] as const
  return (
    <div className={styles.messages}>
      <div className={styles.onglets}>
        <Segments libelle="Messages" options={vues} valeur={vue} onChange={setVue} />
      </div>
      {vue === 'communaute' ? <Registre /> : <ListeMurmures />}
    </div>
  )
}
