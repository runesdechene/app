/**
 * QUOI     — étape 2, « Quelle taille portes-tu ? » : les contenus un par un, une taille (ou
 *            « Aucun produit ») pour chacun.
 * POURQUOI — la taille portée sur la photo aide les autres à choisir la leur sur la fiche produit :
 *            on ne passe au contenu suivant qu'une fois la taille choisie. Le rang du contenu affiché
 *            reste local : c'est un détail de l'étape, pas une adresse.
 */
import { useState } from 'react'
import { BoutonSombre, EnTete, Navigation } from './Etape'
import { Pastille, Pastilles } from './Pastille'
import { estVideo } from './lib/fichiers'
import { AUCUN_PRODUIT, TAILLES, type Contenu } from './lib/formulaire'
import styles from './EtapeTailles.module.css'

const nomDeTaille = (taille: string) => (taille === AUCUN_PRODUIT ? 'Aucun produit' : taille)

export function EtapeTailles({
  contenus,
  choisirTaille,
  precedent,
  suivant,
}: {
  contenus: Contenu[]
  choisirTaille: (rang: number, taille: string) => void
  precedent: () => void
  suivant: () => void
}) {
  const [rang, setRang] = useState(0)
  const contenu = contenus[rang]
  if (!contenu) return null
  const dernier = rang === contenus.length - 1

  return (
    <>
      <EnTete surTitre="Étape 2 sur 4" titre="Quelle taille portes-tu ?">
        Une taille par contenu — ou « Aucun produit ».
      </EnTete>

      <div className={styles.scene}>
        {estVideo(contenu.fichier) ? (
          <video key={contenu.apercu} className={styles.cliche} src={contenu.apercu} muted playsInline preload="metadata" />
        ) : (
          <img key={contenu.apercu} className={styles.cliche} src={contenu.apercu} alt="" />
        )}
        <Pastilles nom="Ta taille">
          {[...TAILLES, AUCUN_PRODUIT].map((t) => (
            <Pastille
              key={t}
              choisie={contenu.taille === t}
              choisir={() => {
                choisirTaille(rang, t)
              }}
            >
              {nomDeTaille(t)}
            </Pastille>
          ))}
        </Pastilles>
        <p className={styles.compte}>
          Contenu {rang + 1} / {contenus.length}
          {contenu.taille && ` · ${nomDeTaille(contenu.taille)}`}
        </p>
      </div>

      <Navigation
        precedent={() => {
          if (rang > 0) setRang(rang - 1)
          else precedent()
        }}
      >
        <div className={styles.points} aria-hidden="true">
          {contenus.map((c, i) => (
            <span key={c.apercu} className={styles.point} data-actif={i === rang} />
          ))}
        </div>
        <BoutonSombre
          disabled={contenu.taille === null}
          onClick={() => {
            if (dernier) suivant()
            else setRang(rang + 1)
          }}
        >
          {dernier ? 'Continuer →' : 'Suivant →'}
        </BoutonSombre>
      </Navigation>
    </>
  )
}
