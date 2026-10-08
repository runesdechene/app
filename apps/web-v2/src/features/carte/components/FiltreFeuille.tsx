/**
 * QUOI     — la feuille du bouton Filtre (maquette « Carte — Filtrer », Uriel 30/09) : ma
 *            progression (Tout · À découvrir · Visités · Ajoutés), les natures, les époques ;
 *            « Réinitialiser » en haut, « Voir les N lieux » en bas.
 * POURQUOI — spec Carte : un seul bouton, les filtres dans une feuille, jamais en pastilles sur
 *            la carte. Les filtres s'appliquent tout de suite ; le bouton du bas dit combien de
 *            lieux restent, et ferme. Mêmes pastilles qu'« Ajouter un lieu » : la nature et sa
 *            bille, l'époque en encre une fois choisie.
 * ATTENTION — la feuille garde son en-tête et son bouton ; seul le milieu défile.
 */
import { Feuille } from '@/shared/ui/Feuille'
import { BilleType } from '@/shared/ui/BilleType'
import { Segments } from '@/shared/ui/Segments'
import type { LieuCarte } from '../api/lireCarte'
import { useFiltresDeCarte } from '../hooks/useFiltresDeCarte'
import {
  compterNatures,
  filtrer,
  FILTRES_VIDES,
  filtresActifs,
  type Filtres,
  type Progression,
} from '../lib/filtres'
import styles from './FiltreFeuille.module.css'

const PROGRESSIONS: readonly { id: Progression; libelle: string }[] = [
  { id: 'tout', libelle: 'Tout' },
  { id: 'aDecouvrir', libelle: 'À découvrir' },
  { id: 'visites', libelle: 'Visités' },
  { id: 'ajoutes', libelle: 'Ajoutés' },
]

const NOMBRE = new Intl.NumberFormat('fr-FR')

function basculer(ensemble: ReadonlySet<string>, id: string): Set<string> {
  const suivant = new Set(ensemble)
  if (suivant.has(id)) suivant.delete(id)
  else suivant.add(id)
  return suivant
}

export function FiltreFeuille({
  lieux,
  filtres,
  onFiltres,
  onFermer,
}: {
  lieux: LieuCarte[]
  filtres: Filtres
  onFiltres: (f: Filtres) => void
  onFermer: () => void
}) {
  const { natures, epoques } = useFiltresDeCarte(true)
  const compte = compterNatures(lieux)
  const restants = filtrer(lieux, filtres).length
  // Les plus fréquentes d'abord : ce qu'on cherche le plus est en haut (comme la vitrine).
  const parFrequence = [...natures].sort(
    (a, b) => (compte.get(b.id) ?? 0) - (compte.get(a.id) ?? 0),
  )

  return (
    <Feuille titre="Filtrer la carte" onFermer={onFermer}>
      <div className={styles.filtres}>
        <div className={styles.tete}>
          <h2 className={styles.titre}>Filtrer la carte</h2>
          {filtresActifs(filtres) && (
            <button
              type="button"
              className={styles.reinitialiser}
              onClick={() => {
                onFiltres(FILTRES_VIDES)
              }}
            >
              Réinitialiser
            </button>
          )}
        </div>

        <div className={styles.defile}>
          <div className={styles.rubrique}>
            <h3 className={styles.titreRubrique}>Ma progression</h3>
          </div>
          <Segments
            libelle="Ma progression"
            options={PROGRESSIONS}
            valeur={filtres.progression}
            onChange={(progression) => {
              onFiltres({ ...filtres, progression })
            }}
          />

          <div className={styles.rubrique}>
            <h3 className={styles.titreRubrique}>Sur la carte</h3>
          </div>
          <div className={styles.puces}>
            <button
              type="button"
              className={styles.epoque}
              aria-pressed={filtres.fragments}
              onClick={() => {
                onFiltres({ ...filtres, fragments: !filtres.fragments })
              }}
            >
              Les Fragments, à leur origine
            </button>
          </div>

          <div className={styles.rubrique}>
            <h3 className={styles.titreRubrique}>Natures</h3>
            <span className={styles.aide}>Plusieurs à la fois</span>
          </div>
          <div className={styles.puces}>
            {parFrequence.map((n) => (
              <button
                key={n.id}
                type="button"
                className={styles.nature}
                aria-pressed={filtres.natures.has(n.id)}
                onClick={() => {
                  onFiltres({ ...filtres, natures: basculer(filtres.natures, n.id) })
                }}
              >
                {n.icone && <BilleType icone={n.icone} couleur={n.couleur} />}
                {n.nom}
                <span className={styles.compte}>{NOMBRE.format(compte.get(n.id) ?? 0)}</span>
              </button>
            ))}
          </div>

          <div className={styles.rubrique}>
            <h3 className={styles.titreRubrique}>Époques</h3>
            <span className={styles.aide}>Plusieurs à la fois</span>
          </div>
          <div className={styles.puces}>
            {epoques.map((e) => (
              <button
                key={e.id}
                type="button"
                className={styles.epoque}
                aria-pressed={filtres.epoques.has(e.id)}
                onClick={() => {
                  onFiltres({ ...filtres, epoques: basculer(filtres.epoques, e.id) })
                }}
              >
                {e.nom}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className={styles.voir} onClick={onFermer}>
          {restants === 1 ? 'Voir le lieu' : `Voir les ${NOMBRE.format(restants)} lieux`}
        </button>
      </div>
    </Feuille>
  )
}
