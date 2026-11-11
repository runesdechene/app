/**
 * QUOI     — « Ton vêtement » : T-shirt, Sweatshirt, Veste Zip, les vêtements de la boutique.
 * POURQUOI — les avis s'affichent par type de vêtement, jamais par motif (le textile est le même
 *            d'un motif à l'autre) : chaque avis porte le sien.
 */
import { Pastille, Pastilles } from './Pastille'
import { VETEMENTS } from './lib/formulaire'
import etape from './Etape.module.css'

export function ChoixDuVetement({ vetement, choisir }: { vetement: string; choisir: (cle: string) => void }) {
  return (
    <>
      <p className={etape.libelle}>Ton vêtement</p>
      <Pastilles nom="Ton vêtement" aGauche>
        {VETEMENTS.map((v) => (
          <Pastille
            key={v.cle}
            choisie={vetement === v.cle}
            choisir={() => {
              choisir(v.cle)
            }}
          >
            {v.nom}
          </Pastille>
        ))}
      </Pastilles>
    </>
  )
}
