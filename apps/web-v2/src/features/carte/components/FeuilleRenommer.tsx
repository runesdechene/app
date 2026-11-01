/**
 * QUOI     — « Renommer » mon territoire (Figma 877:2679) : son nom en champ, 40 caractères au plus,
 *            et ce que le nom devient.
 * POURQUOI — le nom se pose sur les lieux du territoire (migration 569) : un lieu repris par un
 *            autre ne le garde pas, il faut le dire avant qu'on s'en étonne.
 */
import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Champ } from '@/shared/ui/Champ'
import { Feuille } from '@/shared/ui/Feuille'
import type { TerritoireRevendique } from '../api/lireCarte'
import { useRenommerTerritoire } from '../hooks/useRenommerTerritoire'
import styles from './FeuilleRenommer.module.css'

export function FeuilleRenommer({
  territoire: t,
  onFermer,
}: {
  territoire: TerritoireRevendique
  onFermer: () => void
}) {
  const [nom, setNom] = useState(t.nom)
  const { renommer, enCours, erreur } = useRenommerTerritoire(t.id, onFermer)
  const pret = nom.trim() !== '' && nom.trim() !== t.nom

  return (
    <Feuille titre={t.nom} onFermer={onFermer}>
      <div className={styles.feuille}>
        <p className={styles.qui}>Ton territoire · {t.lieux} lieux</p>
        <p className={styles.aide}>
          Il grandit à chaque lieu revendiqué à moins de 5 km, et contourne les lieux des autres.
        </p>
        <Champ libelle="Nom du territoire" valeur={nom} onChange={setNom} max={40} />
        {erreur && (
          <p role="alert" className={styles.erreur}>
            {erreur}
          </p>
        )}
        <Button
          disabled={!pret}
          enCours={enCours}
          onClick={() => {
            renommer(nom.trim())
          }}
        >
          Renommer
        </Button>
        <p className={styles.pied}>
          Le nouveau nom se voit sur la carte, pour tous. Un lieu repris par un autre ne le garde
          pas.
        </p>
      </div>
    </Feuille>
  )
}
