/**
 * QUOI     — les badges d'un profil, rangés à droite du titre (maquette COMPTE 89:124) :
 *            « Client Runes de Chêne » et le rôle (« Admin », « Modérateur »).
 * POURQUOI — le badge s'explique au toucher : il porte au moins un Fragment (Uriel, 27/09). Il
 *            s'appelait « Porteur vérifié » ; « Client Runes de Chêne » parle plus aux gens
 *            (Uriel, 28/09). Le profil est déjà en cache : aucune requête de plus.
 */
import { useState } from 'react'
import coche from '@/assets/ui/coche.svg'
import etoile from '@/assets/ui/etoile.svg'
import { Feuille } from '@/shared/ui/Feuille'
import { Text } from '@/shared/ui/Text'
import { useExplorateur } from '../hooks/useExplorateur'
import styles from './BadgesExplorateur.module.css'

const ROLES = { admin: 'Admin', moderator: 'Modérateur' } as const

export function BadgesExplorateur({ id }: { id: string }) {
  const { profil } = useExplorateur(id)
  const [explication, setExplication] = useState(false)
  if (!profil) return null

  return (
    <>
      {profil.porteurVerifie && (
        <button
          type="button"
          className={styles.verifie}
          onClick={() => {
            setExplication(true)
          }}
        >
          <img src={coche} alt="" width={10} height={10} />
          Client Runes de Chêne
        </button>
      )}
      {profil.role && (
        <span className={styles.role}>
          <img src={etoile} alt="" width={10} height={10} />
          {ROLES[profil.role]}
        </span>
      )}
      {explication && (
        <Feuille
          titre="Client Runes de Chêne"
          onFermer={() => {
            setExplication(false)
          }}
        >
          <div className={styles.explication}>
            <Text variant="titre-carte">Client Runes de Chêne</Text>
            <Text variant="corps">
              {profil.nom} porte au moins un Fragment Runes de Chêne : c’est un client de la marque.
            </Text>
          </div>
        </Feuille>
      )}
    </>
  )
}
