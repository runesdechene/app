/**
 * QUOI     — chaque brique de shared/ui/, dans tous ses états, sur le parchemin.
 * POURQUOI — une brique se valide dans tous ses états, pas seulement le plus flatteur.
 */
import partager from '@/assets/ui/partager.svg'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { IconButton } from '@/shared/ui/IconButton'
import { Pastille } from '@/shared/ui/Pastille'
import { Text } from '@/shared/ui/Text'
import { DaSection } from './DaSection'
import styles from './DaPage.module.css'

export function DaBriques() {
  return (
    <>
      <DaSection name="Text">
        <Text variant="corps">Voir la section « Textes » : les douze styles.</Text>
      </DaSection>

      <DaSection name="Button">
        <div className={styles.rangee}>
          <Button>Marquer ma visite</Button>
          <Button kind="secondaire">Prêter serment</Button>
          <Button kind="discret">Lire ou écouter ce fragment</Button>
        </div>
        <div className={styles.rangee}>
          <Button disabled>Trop loin (274 km)</Button>
          <Button kind="secondaire" disabled>
            Désactivé
          </Button>
          <Button kind="discret" disabled>
            Désactivé
          </Button>
        </div>
      </DaSection>

      <DaSection name="IconButton">
        <div className={styles.rangee}>
          <IconButton label="Partager" icon={partager} />
        </div>
      </DaSection>

      <DaSection name="Pastille">
        <div className={styles.rangee}>
          <Text variant="legende">0 → rien :</Text>
          <Pastille count={0} />
          <Pastille count={3} />
          <Pastille count={12} />
        </div>
      </DaSection>

      <DaSection name="EmptyState">
        <div className={styles.cadre}>
          <EmptyState>Le Campement est à venir</EmptyState>
        </div>
      </DaSection>
    </>
  )
}
