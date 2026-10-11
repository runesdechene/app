/**
 * QUOI     — « Tes données », dans les Préférences : les télécharger (un fichier JSON) ; supprimer
 *            ton compte, après avoir écrit « SUPPRIMER », puis retour à la vitrine.
 * POURQUOI — le RGPD (art. 15, 17, 20), depuis l'appli. Décisions d'Uriel du 11/10 : ce que tu as
 *            ajouté à la carte reste, signé « Un Voyageur » ; le reste part. La feuille le dit
 *            avant, en clair.
 * ATTENTION — après la suppression, la page se recharge sur la vitrine (`location.assign`) : plus
 *            aucun cache de l'ancien compte ne survit.
 */
import { useState } from 'react'
import chevron from '@/assets/ui/chevron.svg'
import corbeille from '@/assets/ui/corbeille.svg'
import telecharger from '@/assets/ui/telecharger.svg'
import { Button } from '@/shared/ui/Button'
import { Champ } from '@/shared/ui/Champ'
import { Feuille } from '@/shared/ui/Feuille'
import { Text } from '@/shared/ui/Text'
import { useSupprimerMonCompte, useTelechargerMesDonnees } from '../hooks/useMesDonnees'
import styles from './PreferencesPage.module.css'

const MOT = 'SUPPRIMER'

function enregistrer(donnees: unknown) {
  const fichier = new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' })
  const lien = document.createElement('a')
  lien.href = URL.createObjectURL(fichier)
  lien.download = `runes-de-chene-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`
  lien.click()
  URL.revokeObjectURL(lien.href)
}

export function MesDonnees() {
  const exporter = useTelechargerMesDonnees()
  const supprimer = useSupprimerMonCompte()
  const [ouverte, setOuverte] = useState(false)
  const [mot, setMot] = useState('')

  return (
    <>
      <button
        type="button"
        className={styles.ligne}
        disabled={exporter.isPending}
        onClick={() => {
          exporter.mutate(undefined, { onSuccess: enregistrer })
        }}
      >
        <img className={styles.icone} src={telecharger} alt="" />
        <span className={styles.texte}>
          <span className={styles.titre}>Télécharger mes données</span>
          <span className={styles.description}>
            Tout ce que Runes de Chêne garde de toi, dans un fichier.
          </span>
        </span>
        <img className={styles.chevron} src={chevron} alt="" />
      </button>
      {exporter.isError && (
        <p role="alert" className={styles.alerte}>
          Le fichier n’a pas pu être préparé. Réessaie dans un instant.
        </p>
      )}

      <button
        type="button"
        className={styles.ligne}
        onClick={() => {
          setOuverte(true)
        }}
      >
        <img className={styles.icone} src={corbeille} alt="" />
        <span className={styles.texte}>
          <span className={styles.titre}>Supprimer mon compte</span>
          <span className={styles.description}>Définitivement, avec ce qui te concerne.</span>
        </span>
        <img className={styles.chevron} src={chevron} alt="" />
      </button>

      {ouverte && (
        <Feuille
          titre="Supprimer mon compte"
          onFermer={() => {
            setOuverte(false)
          }}
        >
          <div className={styles.suppression}>
            <Text variant="titre-section">Supprimer mon compte</Text>
            <Text variant="sous-titre">
              Sont effacés : ton adresse e-mail, ton nom, ta photo, ta présentation, ta position,
              tes visites, tes envies, tes cœurs, tes Fragments et tes titres, tes Murmures, tes
              notifications.
            </Text>
            <Text variant="sous-titre">
              Les lieux, les photos et les récits que tu as ajoutés restent sur la carte, signés «
              Un Voyageur » ; tes mots dans les carnets et les Compagnies aussi. C’est définitif.
            </Text>
            <Text variant="libelle">
              Ton compte client de la boutique n’est pas touché : pour le supprimer, écris à
              contact@runesdechene.com.
            </Text>
            <Champ libelle={`Écris ${MOT} pour confirmer`} valeur={mot} onChange={setMot} />
            <Button
              disabled={mot.trim() !== MOT || supprimer.isPending}
              onClick={() => {
                supprimer.mutate(undefined, {
                  onSuccess: () => {
                    window.location.assign('/bienvenue')
                  },
                })
              }}
            >
              Supprimer définitivement
            </Button>
            {supprimer.isError && (
              <p role="alert" className={styles.alerte}>
                La suppression a échoué : rien n’a été effacé. Réessaie, ou écris-nous.
              </p>
            )}
          </div>
        </Feuille>
      )}
    </>
  )
}
