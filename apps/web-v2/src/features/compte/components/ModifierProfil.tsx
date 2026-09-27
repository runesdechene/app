/**
 * QUOI     — « Modifier mon profil » (maquette 91:107) : photo, nom, présentation, Instagram,
 *            deux titres portés au plus, accord des titres.
 * POURQUOI — le formulaire ne s'affiche qu'une fois ses valeurs de départ chargées : il part
 *            d'un état complet et n'a jamais à se resynchroniser.
 * ATTENTION — un échec d'enregistrement laisse le formulaire tel quel, avec un message sous le
 *            bouton : l'Explorateur ne perd jamais ce qu'il a écrit.
 */
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/shared/ui/Avatar'
import { Button } from '@/shared/ui/Button'
import { Champ } from '@/shared/ui/Champ'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PastilleChoix } from '@/shared/ui/PastilleChoix'
import { Text } from '@/shared/ui/Text'
import type { Titre } from '../api/lireProfil'
import { useModifierProfil, type ValeursProfil } from '../hooks/useModifierProfil'
import styles from './ModifierProfil.module.css'

const TITRES_MAX = 2
const ACCORDS = [
  { id: 'm', libelle: 'Masculin — Chevalier' },
  { id: 'f', libelle: 'Féminin — Chevalière' },
] as const

export function ModifierProfil({ onTermine }: { onTermine: () => void }) {
  const { initial, titresDebloques, erreur, reessayer, enregistrer } = useModifierProfil()
  if (erreur) {
    return (
      <div className={styles.formulaire}>
        <EmptyState>Ton profil n’a pas pu être chargé</EmptyState>
        <Button kind="secondaire" onClick={reessayer}>
          Réessayer
        </Button>
      </div>
    )
  }
  if (!initial) return null
  return (
    <Formulaire
      initial={initial}
      titresDebloques={titresDebloques}
      enregistrer={enregistrer}
      onTermine={onTermine}
    />
  )
}

function Formulaire({
  initial,
  titresDebloques,
  enregistrer,
  onTermine,
}: {
  initial: ValeursProfil
  titresDebloques: Titre[]
  enregistrer: (valeurs: ValeursProfil, photo: File | null) => Promise<void>
  onTermine: () => void
}) {
  const [valeurs, setValeurs] = useState(initial)
  const [photo, setPhoto] = useState<{ fichier: File; apercu: string } | null>(null)
  const [tropDeTitres, setTropDeTitres] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [echec, setEchec] = useState(false)
  const choixPhoto = useRef<HTMLInputElement>(null)

  // L'aperçu est une adresse locale au navigateur : on la libère quand la photo change ou
  // quand on quitte l'écran.
  useEffect(
    () => () => {
      if (photo) URL.revokeObjectURL(photo.apercu)
    },
    [photo],
  )

  function changer<K extends keyof ValeursProfil>(cle: K, valeur: ValeursProfil[K]) {
    setValeurs((v) => ({ ...v, [cle]: valeur }))
  }

  function basculerTitre(id: number) {
    const porte = valeurs.titres.includes(id)
    if (!porte && valeurs.titres.length >= TITRES_MAX) {
      setTropDeTitres(true)
      return
    }
    setTropDeTitres(false)
    changer('titres', porte ? valeurs.titres.filter((t) => t !== id) : [...valeurs.titres, id])
  }

  async function soumettre() {
    setEnvoi(true)
    setEchec(false)
    try {
      await enregistrer(
        {
          ...valeurs,
          nom: valeurs.nom.trim(),
          instagram: valeurs.instagram.trim().replace(/^@/, ''),
        },
        photo?.fichier ?? null,
      )
      onTermine()
    } catch {
      setEchec(true)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <form
      className={styles.formulaire}
      onSubmit={(e) => {
        e.preventDefault()
        void soumettre()
      }}
    >
      <div className={styles.photo}>
        <Avatar url={photo?.apercu ?? valeurs.avatarUrl} nom={valeurs.nom} taille="grand" />
        <input
          ref={choixPhoto}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const fichier = e.target.files?.[0]
            if (fichier) setPhoto({ fichier, apercu: URL.createObjectURL(fichier) })
          }}
        />
        <Button kind="discret" onClick={() => choixPhoto.current?.click()}>
          Changer la photo
        </Button>
      </div>

      <Champ
        libelle="Ton nom"
        valeur={valeurs.nom}
        onChange={(v) => {
          changer('nom', v)
        }}
      />
      <Champ
        libelle="Ta présentation"
        valeur={valeurs.bio}
        onChange={(v) => {
          changer('bio', v)
        }}
        multiligne
        max={300}
        aide="Quelques lignes : qui tu es, ce que tu cherches sur les chemins."
      />
      <Champ
        libelle="Ton Instagram"
        valeur={valeurs.instagram}
        onChange={(v) => {
          changer('instagram', v)
        }}
      />

      <fieldset className={styles.groupe}>
        <legend>
          <Text variant="rubrique" as="span">
            Tes titres portés
          </Text>
        </legend>
        <Text variant="legende">
          {titresDebloques.length > 0
            ? 'Deux au plus, choisis parmi ceux que tes fragments t’ont offerts.'
            : 'Tu n’as pas encore de titre à porter.'}
        </Text>
        <div className={styles.pastilles}>
          {titresDebloques.map((t) => (
            <PastilleChoix
              key={t.id}
              libelle={t.nom}
              choisie={valeurs.titres.includes(t.id)}
              onClick={() => {
                basculerTitre(t.id)
              }}
            />
          ))}
        </div>
        {tropDeTitres && <p className={styles.avertissement}>Deux au plus</p>}
      </fieldset>

      <fieldset className={styles.groupe}>
        <legend>
          <Text variant="rubrique" as="span">
            Tes titres s’accordent au
          </Text>
        </legend>
        <div className={styles.pastilles}>
          {ACCORDS.map((a) => (
            <PastilleChoix
              key={a.id}
              libelle={a.libelle}
              choisie={valeurs.accord === a.id}
              onClick={() => {
                changer('accord', a.id)
              }}
            />
          ))}
        </div>
      </fieldset>

      <div className={styles.envoi}>
        <Button disabled={envoi || valeurs.nom.trim() === ''} onClick={() => void soumettre()}>
          Enregistrer
        </Button>
        {echec && (
          <p role="alert" className={styles.avertissement}>
            Ton profil n’a pas pu être enregistré. Réessaie dans un instant.
          </p>
        )}
      </div>
    </form>
  )
}
