/**
 * QUOI     — chaque brique de shared/ui/, dans tous ses états, sur le parchemin.
 * POURQUOI — une brique se valide dans tous ses états, pas seulement le plus flatteur. Les
 *            briques qui réagissent (interrupteur, onglets, champ) sont vivantes : on les essaie.
 */
import { useState } from 'react'
import partager from '@/assets/ui/partager.svg'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Champ } from '@/shared/ui/Champ'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Feuille } from '@/shared/ui/Feuille'
import { IconButton } from '@/shared/ui/IconButton'
import { Interrupteur } from '@/shared/ui/Interrupteur'
import { Onglets } from '@/shared/ui/Onglets'
import { Pastille } from '@/shared/ui/Pastille'
import { PastilleChoix } from '@/shared/ui/PastilleChoix'
import { Text } from '@/shared/ui/Text'
import { DaSection } from './DaSection'
import styles from './DaPage.module.css'

const PRESENTATION_PLEINE =
  'Chevalier errant à temps partiel, entrepreneur, illustrateur et technomancien. Fondateur de la marque. '.repeat(
    3,
  )

const DECOUVERTES = [
  { id: 'ajoutes', libelle: 'Ajoutés', compte: 2 },
  { id: 'visites', libelle: 'Visités', compte: 18 },
  { id: 'envies', libelle: "Envie d'y aller" },
] as const

function rien() {
  return undefined
}

export function DaBriques() {
  const [allume, setAllume] = useState(true)
  const [onglet, setOnglet] = useState<(typeof DECOUVERTES)[number]['id']>('visites')
  const [nom, setNom] = useState('Uriel')
  const [presentation, setPresentation] = useState(PRESENTATION_PLEINE.slice(0, 300))

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

      <DaSection name="Avatar">
        <div className={styles.rangee}>
          <Avatar url={null} nom="Claire" taille="grand" />
          <Avatar url={null} nom="Uriel" taille="petit" />
          <Text variant="legende">Sans photo : l’initiale. Avec photo : l’image, même cadre.</Text>
        </div>
      </DaSection>

      <DaSection name="Interrupteur">
        <div className={styles.rangee}>
          <Interrupteur libelle="Essai" actif={allume} onChange={setAllume} />
          <Interrupteur libelle="Éteint" actif={false} onChange={rien} />
          <Interrupteur libelle="Désactivé" actif desactive onChange={rien} />
        </div>
      </DaSection>

      <DaSection name="Onglets">
        <Onglets onglets={DECOUVERTES} actif={onglet} onChange={setOnglet} />
      </DaSection>

      <DaSection name="Champ">
        <Champ libelle="Ton nom" valeur={nom} onChange={setNom} />
        <Champ
          libelle="Ta présentation"
          valeur={presentation}
          onChange={setPresentation}
          multiligne
          max={300}
          aide="Quelques lignes : qui tu es, ce que tu cherches sur les chemins."
        />
      </DaSection>

      <DaSection name="PastilleChoix">
        <div className={styles.rangee}>
          <PastilleChoix libelle="Chevalier errant" choisie onClick={rien} />
          <PastilleChoix libelle="Arpenteur" onClick={rien} />
          <PastilleChoix libelle="Pèlerin" marque="✦" />
          <Text variant="legende">(la dernière : en lecture, sur un profil)</Text>
        </div>
      </DaSection>

      <DaSection name="Feuille">
        <div className={styles.cadreFeuille}>
          <Feuille titre="Démonstration" onFermer={rien}>
            <Text variant="corps">Mon profil</Text>
            <Text variant="corps">Préférences</Text>
          </Feuille>
        </div>
      </DaSection>
    </>
  )
}
