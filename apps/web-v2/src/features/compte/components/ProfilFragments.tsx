/**
 * QUOI     — « Fragments collectés » : les Fragments possédés, sur une ligne. Sur son propre
 *            profil, toucher un Fragment permet de placer son profil sous son signe (maquette
 *            109:175), et une tuile en empreinte, « + 5 à découvrir », mène à la boutique
 *            (le Codex a quitté Explore le 28/09 : la collection vit dans la boutique).
 * POURQUOI — le signe est une volonté de se placer sous un motif (Uriel, 27/09) : il se choisit
 *            ici, là où l'on voit ses Fragments, et son illustration veille ensuite en filigrane.
 * ATTENTION — sur le profil d'un autre, les Fragments ne sont que montrés : aucun bouton, et
 *            jamais ce qu'il n'a pas (décision d'Uriel, 27/09 : ne pas pousser à l'achat).
 */
import { useRef, useState } from 'react'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import { Text } from '@/shared/ui/Text'
import type { ExplorateurProfile, Fragment } from '../api/lireProfil'
import { useChoisirSigne } from '../hooks/useChoisirSigne'
import { useGlisser } from '../hooks/useGlisser'
import styles from './ProfilFragments.module.css'

const BOUTIQUE_URL = 'https://runesdechene.com/collections/all'

export function ProfilFragments({ profil }: { profil: ExplorateurProfile }) {
  const [ouvert, setOuvert] = useState<Fragment | null>(null)
  const { choisir, echec } = useChoisirSigne(profil.id)
  const rangee = useRef<HTMLDivElement>(null)
  useGlisser(rangee)

  if (profil.fragments.length === 0) return null

  // Une carte de collection : le motif, un trait, son nom en entier (maquette 123:107).
  function vignette(f: Fragment) {
    return (
      <>
        <span className={styles.motifVignette}>
          {f.imageUrl && <img src={f.imageUrl} alt="" draggable={false} />}
        </span>
        <span className={styles.nomMotif}>{f.nom}</span>
      </>
    )
  }

  return (
    <section className={styles.fragments} aria-label="Fragments collectés">
      <h2 className={styles.titre}>
        Fragments collectés <span className={styles.nombre}>{profil.fragments.length}</span>
      </h2>
      {/* Une seule ligne qui défile, comme en V1 : cadre flex > rangée flex: 1 qui défile >
          vignettes à largeur fixe (règle « carrousel » de .claude/rules/interface.md). */}
      <div className={styles.cadre}>
        <div ref={rangee} className={styles.rangee}>
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
          {profil.fragmentsADecouvrir !== null && profil.fragmentsADecouvrir > 0 && (
            <a
              className={styles.aDecouvrir}
              href={BOUTIQUE_URL}
              target="_blank"
              rel="noreferrer"
              aria-label={`+ ${String(profil.fragmentsADecouvrir)} à découvrir, sur la boutique`}
            >
              <span className={styles.plus}>+ {profil.fragmentsADecouvrir}</span>
              <span className={styles.nom}>à découvrir</span>
            </a>
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
