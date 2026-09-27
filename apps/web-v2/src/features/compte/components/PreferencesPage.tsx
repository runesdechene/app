/**
 * QUOI     — les Préférences (maquette 91:166) : ce qu'on t'envoie, ta présence sur la carte,
 *            ton compte.
 * POURQUOI — des phrases, pas des noms de colonnes : chaque réglage dit ce qu'il change pour
 *            l'Explorateur. « Montrer tes envies » s'ajoute à la maquette (spec Compte).
 * ATTENTION — un réglage refusé par la base revient à sa place, avec un message : jamais un
 *            interrupteur qui ment.
 */
import { useState, type ReactNode } from 'react'
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
import styles from './PreferencesPage.module.css'

export function PreferencesPage() {
  const { preferences, erreurChargement, reessayer, regler, echec } = usePreferences()
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
  const ligne = (reglage: Reglage, titre: string, description: string) => (
    <Ligne titre={titre} description={description}>
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

      <Carte titre="Ce qu’on t’envoie">
        {ligne(
          'pushImportant',
          'Les nouvelles importantes',
          'Un nouveau fragment, un rendez-vous près de chez toi.',
        )}
        {ligne(
          'pushRecap',
          'Le récit de la semaine',
          'Chaque lundi, les lieux retrouvés par les Explorateurs.',
        )}
      </Carte>

      <Carte titre="Ta présence sur la carte">
        {ligne(
          'brouillerPistes',
          'Brouiller tes pistes',
          'Les autres voient ta position à 50 km près, jamais ta porte.',
        )}
        {ligne(
          'showDepartement',
          'Montrer ton département',
          '« Noble représentant de… », déduit de tes visites.',
        )}
        {ligne('showEnvies', 'Montrer tes envies', 'Tes lieux « Envie d’y aller » sur ton profil.')}
      </Carte>

      <Carte titre="Ton compte">
        <Email actuel={preferences.email} />
        <a className={styles.ligne} href={SOUMETTRE_PHOTO_URL} target="_blank" rel="noreferrer">
          <span className={styles.texte}>
            <span className={styles.titre}>Un fragment qui n’apparaît pas ?</span>
            <span className={styles.description}>
              Envoie-nous une photo : on le rattache à ton compte.
            </span>
          </span>
          <span aria-hidden="true">›</span>
        </a>
      </Carte>

      <Text variant="libelle">Runes de Chêne — Porte l’Histoire</Text>
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
  titre,
  description,
  children,
}: {
  titre: string
  description: string
  children: ReactNode
}) {
  return (
    <div className={styles.ligne}>
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
        <span className={styles.texte}>
          <span className={styles.titre}>Ton adresse e-mail</span>
          <span className={styles.description}>
            {actuel ?? '—'} — c’est elle qui relie tes achats.
          </span>
        </span>
        <span aria-hidden="true">›</span>
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
