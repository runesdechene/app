/**
 * QUOI     — « Ses fragments » : les Fragments possédés. Sur son propre profil, toucher un
 *            Fragment permet de placer son profil sous son signe (maquette 109:175).
 * POURQUOI — le signe est une volonté de se placer sous un motif (Uriel, 27/09) : il se choisit
 *            ici, là où l'on voit ses Fragments, et son illustration veille ensuite en filigrane.
 * ATTENTION — sur le profil d'un autre, les Fragments ne sont que montrés : aucun bouton.
 */
import { useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import { Text } from '@/shared/ui/Text'
import type { ExplorateurProfile, Fragment } from '../api/lireProfil'
import { useChoisirSigne } from '../hooks/useChoisirSigne'
import styles from './ProfilFragments.module.css'

export function ProfilFragments({ profil }: { profil: ExplorateurProfile }) {
  const [ouvert, setOuvert] = useState<Fragment | null>(null)
  const { choisir, echec } = useChoisirSigne(profil.id)

  if (profil.fragments.length === 0) return null

  // Le motif en format haut, son nom dessous (Uriel, 27/09).
  function vignette(f: Fragment) {
    return (
      <>
        <span className={styles.motifVignette}>
          {f.imageUrl && <img src={f.imageUrl} alt="" />}
        </span>
        <span className={styles.nom}>{f.nom}</span>
      </>
    )
  }

  return (
    <section className={styles.fragments} aria-label="Ses fragments">
      <Text variant="rubrique">Ses fragments</Text>
      {/* Une seule ligne qui défile, comme en V1 : cadre flex > rangée flex: 1 qui défile >
          vignettes à largeur fixe (règle « carrousel » de .claude/rules/interface.md). */}
      <div className={styles.cadre}>
        <div className={styles.rangee}>
          {profil.fragments.map((f) =>
            profil.estMoi ? (
              <button
                key={f.id}
                type="button"
                className={[styles.fragment, profil.signe?.id === f.id && styles.choisi]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  setOuvert(f)
                }}
              >
                {vignette(f)}
              </button>
            ) : (
              <figure key={f.id} className={styles.fragment}>
                {vignette(f)}
              </figure>
            ),
          )}
        </div>
      </div>

      {ouvert && (
        <Feuille
          titre={ouvert.nom}
          onFermer={() => {
            setOuvert(null)
          }}
        >
          <div className={styles.explication}>
            {ouvert.imageUrl && <img className={styles.motif} src={ouvert.imageUrl} alt="" />}
            <Text variant="titre-carte">{ouvert.nom}</Text>
            {profil.signe?.id === ouvert.id ? (
              <Text variant="corps">Ton profil est sous ce signe.</Text>
            ) : (
              <>
                <Text variant="corps">
                  Place ton profil sous le signe de ce Fragment : son illustration veille derrière
                  ton portrait.
                </Text>
                <Button
                  onClick={() => {
                    choisir(ouvert.id).then(
                      () => {
                        setOuvert(null)
                      },
                      () => undefined,
                    )
                  }}
                >
                  Me placer sous ce signe
                </Button>
                {echec && (
                  <p role="alert" className={styles.alerte}>
                    Le signe n’a pas pu être changé. Réessaie dans un instant.
                  </p>
                )}
              </>
            )}
          </div>
        </Feuille>
      )}
    </section>
  )
}
