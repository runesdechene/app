/**
 * QUOI     — toutes les natures de lieux, en gélules fines et translucides, qui défilent seules
 *            d'un bord de l'écran à l'autre (maquette 325:315). Survoler arrête le défilé et
 *            blanchit la gélule ; toucher une nature la choisit : la recherche montre ses lieux.
 *            La retoucher la retire.
 * POURQUOI — Uriel, 30/09 : un visiteur qui ne sait pas quoi taper voit d'un coup ce que la
 *            carte contient, et le défilé montre qu'il y en a plus que l'écran n'en tient. Les
 *            icônes sont celles de l'app, en pochoir couleur d'encre.
 * ATTENTION — la rangée est rendue deux fois, bout à bout : le défilé recule d'une rangée entière
 *            et recommence sans à-coup. La copie est cachée aux lecteurs d'écran et au clavier
 *            (inert). Mouvement réduit : pas de défilé, la rangée défile au doigt.
 */
import type { NatureComptee } from '../api/lireVitrine'
import styles from './DefileNatures.module.css'

export function DefileNatures({
  natures,
  choisie,
  onChoisir,
}: {
  natures: NatureComptee[]
  choisie: string | null
  onChoisir: (id: string | null) => void
}) {
  const rangee = (copie: boolean) => (
    <ul
      className={styles.rangee}
      aria-label={copie ? undefined : 'Les natures de lieux'}
      aria-hidden={copie || undefined}
      inert={copie}
      data-copie={copie || undefined}
    >
      {natures.map((n) => (
        <li key={n.id}>
          <button
            type="button"
            className={styles.nature}
            aria-pressed={n.id === choisie}
            onClick={() => {
              onChoisir(n.id === choisie ? null : n.id)
            }}
          >
            {n.icone && (
              <span
                className={styles.icone}
                style={{ '--icone': `url(${n.icone})` }}
                aria-hidden="true"
              />
            )}
            {n.nom}
          </button>
        </li>
      ))}
    </ul>
  )

  return (
    <div className={styles.cadre}>
      <div className={styles.piste}>
        {rangee(false)}
        {rangee(true)}
      </div>
    </div>
  )
}
