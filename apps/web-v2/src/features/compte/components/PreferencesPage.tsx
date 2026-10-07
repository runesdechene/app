/**
 * QUOI     — les Préférences (maquette 91:166) : ce qu'on t'envoie, ta présence sur la carte,
 *            ton compte. « Apparaître sur la carte » dit où en est l'autorisation de position et
 *            la demande si elle ne l'a jamais été (07/10 : sans elle, on reste invisible).
 * POURQUOI — des phrases, pas des noms de colonnes : chaque réglage dit ce qu'il change pour
 *            l'Explorateur. « Montrer tes envies » s'ajoute à la maquette (spec Compte).
 *            Chaque ligne porte son icône de la maquette (`assets/ui/`).
 *            « Sur ce téléphone » abonne ce téléphone aux notifications push (spec bascule §3) ;
 *            sur iPhone hors de l'appli installée, la ligne dit comment faire.
 * ATTENTION — un réglage refusé par la base revient à sa place, avec un message : jamais un
 *            interrupteur qui ment.
 */
import { useState, type ReactNode } from 'react'
import calendrier from '@/assets/ui/calendrier.svg'
import chevron from '@/assets/ui/chevron.svg'
import cloche from '@/assets/ui/cloche.svg'
import coeur from '@/assets/ui/coeur.svg'
import courriel from '@/assets/ui/courriel.svg'
import palette from '@/assets/ui/palette.svg'
import pas from '@/assets/ui/pas.svg'
import positionIcone from '@/assets/ui/position.svg'
import question from '@/assets/ui/question.svg'
import repere from '@/assets/ui/repere.svg'
import { useAutorisationPosition } from '@/shared/hooks/useAutorisationPosition'
import { VERSION } from '@/shared/lib/version'
import { Button } from '@/shared/ui/Button'
import { Champ } from '@/shared/ui/Champ'
import { EmptyState } from '@/shared/ui/EmptyState'
import { Interrupteur } from '@/shared/ui/Interrupteur'
import { Text } from '@/shared/ui/Text'
import {
  changerEmail,
  SOUMETTRE_PHOTO_URL,
  usePreferences,
  type Reglage,
} from '../hooks/usePreferences'
import { usePush } from '../hooks/usePush'
import styles from './PreferencesPage.module.css'

// Ce que dit la ligne « Apparaître sur la carte » : on ne retire pas une autorisation depuis la
// page, c'est le navigateur qui la garde — d'où un bouton seulement pour la demander.
const SUR_LA_CARTE = {
  accordee: 'Les Explorateurs te voient passer tant qu’Explore est ouverte.',
  'a-demander': 'Autorise ta position pour que les Explorateurs te voient passer.',
  refusee:
    'Ta position est bloquée : autorise-la dans les réglages de ton navigateur ou de ton téléphone.',
} as const

export function PreferencesPage() {
  const { preferences, erreurChargement, reessayer, regler, echec } = usePreferences()
  const push = usePush()
  const position = useAutorisationPosition()
  if (erreurChargement) {
    return (
      <div className={styles.page}>
        <EmptyState>Tes préférences n’ont pas pu être chargées</EmptyState>
        <Button kind="secondaire" onClick={reessayer}>
          Réessayer
        </Button>
      </div>
    )
  }
  if (!preferences) return null

  // Une fonction fléchée (et non `function`) : TypeScript garde `preferences` défini.
  const ligne = (reglage: Reglage, icone: string, titre: string, description: string) => (
    <Ligne icone={icone} titre={titre} description={description}>
      <Interrupteur
        libelle={titre}
        actif={preferences[reglage]}
        onChange={(valeur) => {
          regler(reglage, valeur)
        }}
      />
    </Ligne>
  )

  return (
    <div className={styles.page}>
      {echec && (
        <p role="alert" className={styles.alerte}>
          Ce réglage n’a pas pu être enregistré. Réessaie dans un instant.
        </p>
      )}

      {push.echec && (
        <p role="alert" className={styles.alerte}>
          Les notifications n’ont pas pu être activées. Vérifie qu’elles sont autorisées pour ce
          site, puis réessaie.
        </p>
      )}

      <Carte titre="Ce qu’on t’envoie">
        {push.permis !== 'impossible' && (
          <Ligne
            icone={cloche}
            titre="Sur ce téléphone"
            description={
              push.permis === 'possible'
                ? 'Recevoir les notifications ici, même l’appli fermée.'
                : 'Sur iPhone : ajoute d’abord l’appli à ton écran d’accueil.'
            }
          >
            {push.permis === 'possible' && (
              <Interrupteur
                libelle="Sur ce téléphone"
                actif={push.abonne}
                desactive={push.enCours}
                onChange={push.changer}
              />
            )}
          </Ligne>
        )}
        {ligne(
          'pushImportant',
          cloche,
          'Les nouvelles importantes',
          'Un nouveau fragment, un rendez-vous près de chez toi.',
        )}
        {ligne(
          'pushRecap',
          calendrier,
          'Le récit de la semaine',
          'Chaque lundi, les lieux retrouvés par les Explorateurs.',
        )}
      </Carte>

      <Carte titre="Ta présence sur la carte">
        {position.autorisation && position.autorisation !== 'impossible' && (
          <Ligne
            icone={positionIcone}
            titre="Apparaître sur la carte"
            description={SUR_LA_CARTE[position.autorisation]}
          >
            {position.autorisation === 'a-demander' && (
              <Button kind="discret" onClick={() => void position.autoriser()}>
                Autoriser
              </Button>
            )}
          </Ligne>
        )}
        {ligne(
          'brouillerPistes',
          pas,
          'Brouiller tes pistes',
          'Les autres voient ta position à 50 km près, jamais ta porte.',
        )}
        {ligne(
          'showDepartement',
          repere,
          'Montrer ton département',
          '« Noble représentant de… » sous ton nom. Ton passeport reste visible.',
        )}
        {ligne(
          'showEnvies',
          coeur,
          'Montrer tes envies',
          'Tes lieux « Envie d’y aller » sur ton profil.',
        )}
        {ligne(
          'lieuxEnCouleur',
          palette,
          'Mes lieux en couleur',
          'Les lieux que tu as visités prennent la couleur de leur type.',
        )}
      </Carte>

      <Carte titre="Ton compte">
        <Email actuel={preferences.email} />
        <a className={styles.ligne} href={SOUMETTRE_PHOTO_URL} target="_blank" rel="noreferrer">
          <img className={styles.icone} src={question} alt="" />
          <span className={styles.texte}>
            <span className={styles.titre}>Un fragment qui n’apparaît pas ?</span>
            <span className={styles.description}>
              Envoie-nous une photo : on le rattache à ton compte.
            </span>
          </span>
          <img className={styles.chevron} src={chevron} alt="" />
        </a>
      </Carte>

      <Text variant="libelle">Runes de Chêne — Porte l’Histoire · {VERSION}</Text>
    </div>
  )
}

function Carte({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-label={titre}>
      <Text variant="rubrique">{titre}</Text>
      <div className={styles.carte}>{children}</div>
    </section>
  )
}

function Ligne({
  icone,
  titre,
  description,
  children,
}: {
  icone: string
  titre: string
  description: string
  children: ReactNode
}) {
  return (
    <div className={styles.ligne}>
      <img className={styles.icone} src={icone} alt="" />
      <span className={styles.texte}>
        <span className={styles.titre}>{titre}</span>
        <span className={styles.description}>{description}</span>
      </span>
      {children}
    </div>
  )
}

// L'adresse e-mail : un toucher ouvre le champ ; Supabase envoie un lien de confirmation à la
// nouvelle adresse, rien ne change avant le clic sur ce lien.
function Email({ actuel }: { actuel: string | null }) {
  const [ouvert, setOuvert] = useState(false)
  const [adresse, setAdresse] = useState('')
  const [etat, setEtat] = useState<'saisie' | 'envoye' | 'echec'>('saisie')

  async function envoyer() {
    try {
      await changerEmail(adresse.trim())
      setEtat('envoye')
    } catch {
      setEtat('echec')
    }
  }

  return (
    <div className={styles.email}>
      <button
        type="button"
        className={styles.ligne}
        aria-expanded={ouvert}
        onClick={() => {
          setOuvert(!ouvert)
        }}
      >
        <img className={styles.icone} src={courriel} alt="" />
        <span className={styles.texte}>
          <span className={styles.titre}>Ton adresse e-mail</span>
          <span className={styles.description}>
            {actuel ?? '—'} — c’est elle qui relie tes achats.
          </span>
        </span>
        <img className={styles.chevron} src={chevron} alt="" />
      </button>
      {ouvert && (
        <div className={styles.changement}>
          {etat === 'envoye' ? (
            <Text variant="sous-titre">
              Un lien de confirmation a été envoyé à {adresse.trim()}. Ton adresse change quand tu
              cliques dessus.
            </Text>
          ) : (
            <>
              <Champ libelle="Nouvelle adresse" valeur={adresse} onChange={setAdresse} />
              <Button
                kind="secondaire"
                disabled={!adresse.includes('@')}
                onClick={() => void envoyer()}
              >
                Changer
              </Button>
              {etat === 'echec' && (
                <p role="alert" className={styles.alerte}>
                  L’adresse n’a pas pu être changée. Vérifie-la, puis réessaie.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
