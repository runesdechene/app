/**
 * QUOI     — chaque brique de shared/ui/, dans tous ses états, sur le parchemin.
 * POURQUOI — une brique se valide dans tous ses états, pas seulement le plus flatteur. Les
 *            briques qui réagissent (interrupteur, onglets, champ) sont vivantes : on les essaie.
 */
import { useState } from 'react'
import fondFiche from '@/assets/ui/fond-fiche.webp'
import partager from '@/assets/ui/partager.svg'
import lieu from '@/assets/ui/lieu.svg'
import { Avatar } from '@/shared/ui/Avatar'
import { BilleType } from '@/shared/ui/BilleType'
import { Button } from '@/shared/ui/Button'
import { Champ } from '@/shared/ui/Champ'
import { useEnvols } from '@/shared/hooks/useEnvols'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Envols } from '@/shared/ui/Envols'
import { Feuille } from '@/shared/ui/Feuille'
import { IconButton } from '@/shared/ui/IconButton'
import { Interrupteur } from '@/shared/ui/Interrupteur'
import { LieuCarte } from '@/shared/ui/LieuCarte'
import { Pastille } from '@/shared/ui/Pastille'
import { PastilleChoix } from '@/shared/ui/PastilleChoix'
import { Recompense } from '@/shared/ui/Recompense'
import { Segments } from '@/shared/ui/Segments'
import { Text } from '@/shared/ui/Text'
import { DaSection } from './DaSection'
import styles from './DaPage.module.css'

const ACCORDS = [
  { id: 'm', libelle: 'Masculin — Chevalier' },
  { id: 'f', libelle: 'Féminin — Chevalière' },
] as const

const PRESENTATION_PLEINE =
  'Chevalier errant à temps partiel, entrepreneur, illustrateur et technomancien. Fondateur de la marque. '.repeat(
    3,
  )

const LIEU = {
  id: 'demo',
  nom: 'Château de Jonjeac',
  imageUrl: fondFiche,
  latitude: 45.9,
  longitude: 6.1,
  categorie: null,
  auteur: { nom: 'Luna', avatarUrl: null },
}

function rien() {
  return undefined
}

export function DaBriques() {
  const [allume, setAllume] = useState(true)
  const [accord, setAccord] = useState<'m' | 'f'>('m')
  const [nom, setNom] = useState('Uriel')
  const [presentation, setPresentation] = useState(PRESENTATION_PLEINE.slice(0, 300))

  return (
    <>
      <DaSection name="Text">
        <Text variant="corps">Voir la section « Textes » : les douze styles.</Text>
        <Text variant="legende">Tailles propres au profil (maquette COMPTE) :</Text>
        <p className={styles.tailleDetail}>Mon compte — --titre-detail-size</p>
        <p className={styles.tailleNom}>Uriel — --nom-profil-size</p>
        <p className={styles.tailleRangee}>Ses fragments — --rangee-size</p>
        <p className={styles.tailleBio}>Chevalier errant à temps partiel — --bio-size</p>
      </DaSection>

      <DaSection name="Button">
        <div className={styles.rangee}>
          <Button>Marquer ma visite</Button>
          <Button kind="secondaire">Prêter serment</Button>
          <Button kind="doux">Envoyer un murmure</Button>
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

      <DaSection name="BilleType">
        <div className={styles.rangee}>
          <BilleType icone={lieu} couleur="#80974e" />
          <BilleType icone={lieu} couleur="#8a5a3c" />
          <Text variant="legende">sans couleur :</Text>
          <BilleType icone={lieu} couleur={null} />
        </div>
      </DaSection>

      <DaSection name="Envols">
        <div className={styles.rangee}>
          <BoutonEnvols />
          <Text variant="legende">touche le bouton : un cœur s’envole à chaque fois</Text>
        </div>
      </DaSection>

      <DaSection name="Pastille">
        <div className={styles.rangee}>
          <Text variant="legende">0 → rien :</Text>
          <Pastille count={0} />
          <Pastille count={3} />
          <Pastille count={12} />
          <Pastille count={5} discrete />
        </div>
      </DaSection>

      <DaSection name="Recompense">
        <div className={styles.fete} style={{ '--avatar': `url(${fondFiche})` }}>
          <Recompense
            nom="Château de Colomars"
            type="Châteaux & fortins"
            phrase="Ton 17ᵉ lieu ajouté — et visité !"
            gain={{ gain: 11, niveau: 12, avant: 0.4, apres: 0.6 }}
            libelleAcceder="Voir ta fiche"
            libelleRevenir="Revenir à la carte"
            onAcceder={rien}
            onFermer={rien}
          />
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
          <Avatar url={null} nom="Gautier" taille="mini" />
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

      <DaSection name="Segments">
        <Segments libelle="Accord" options={ACCORDS} valeur={accord} onChange={setAccord} />
      </DaSection>

      <DaSection name="LieuCarte">
        <ul className={styles.rangee}>
          <LieuCarte lieu={LIEU} position={{ latitude: 45.2, longitude: 5.7 }} avecAuteur />
          <LieuCarte lieu={{ ...LIEU, imageUrl: null }} position={null} avecAuteur={false} />
        </ul>
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

function BoutonEnvols() {
  const { envols, lancer, finir } = useEnvols()
  return (
    <span className={styles.envols}>
      <Button kind="doux" onClick={lancer}>
        Envoyer un cœur
      </Button>
      <Envols envols={envols} onFin={finir} />
    </span>
  )
}
