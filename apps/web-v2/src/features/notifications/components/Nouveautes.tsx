/**
 * QUOI     — la page « Nouveautés » (maquette « Nouveautés — la mise à jour ouverte », 30/09) : la
 *            dernière mise à jour en entier sur une carte, les précédentes dessous, plus discrètes.
 *            Une image et un numéro de version, quand la mise à jour en a (migration 436). Sous
 *            chacune, ses cœurs et son carnet (478) : ouverts sous la dernière, repliés dessous.
 *            Les précédentes se replient sur leur date et leur titre, pour ne pas prendre toute la
 *            hauteur ; un toucher les déplie (Uriel, 11/10).
 * POURQUOI — on y arrive en touchant « Nouveautés d'Explore » dans la cloche. Le texte vient du
 *            Hub ; `blocsDuTexte` le met en paragraphes et en listes.
 */
import { aLaTaille } from '@/shared/lib/image'
import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'
import type { MiseAJour } from '../api/nouveautes'
import { useNouveautes } from '../hooks/useNouveautes'
import { blocsDuTexte } from '../lib/texte'
import styles from './Nouveautes.module.css'
import { SousMiseAJour } from './SousMiseAJour'

const LE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' })
const LARGEUR_IMAGE = 360 // la largeur de la carte, au plus

export function Nouveautes() {
  const { misesAJour, erreur, reessayer } = useNouveautes()

  if (erreur) {
    return (
      <div className={styles.etat}>
        <EmptyState>Les nouveautés n’ont pas pu être chargées</EmptyState>
        <Button kind="doux" onClick={() => void reessayer()}>
          Réessayer
        </Button>
      </div>
    )
  }
  if (!misesAJour) return <div className={styles.chargement} aria-busy="true" />
  const [derniere, ...precedentes] = misesAJour
  if (!derniere) return <EmptyState>Pas encore de nouveautés</EmptyState>

  return (
    <div className={styles.nouveautes}>
      <article className={styles.derniere}>
        <Entete miseAJour={derniere} />
        <Corps miseAJour={derniere} premiere />
        <SousMiseAJour miseAJour={derniere} depliee />
      </article>
      {precedentes.length > 0 && (
        <section className={styles.precedentes} aria-label="Précédentes">
          <h2 className={styles.rubrique}>Précédentes</h2>
          {precedentes.map((m) => (
            <article key={m.id} className={styles.precedente}>
              <details className={styles.pli}>
                <summary className={styles.sommaire}>
                  <Entete miseAJour={m} />
                </summary>
                <div className={styles.deplie}>
                  <Corps miseAJour={m} />
                  <SousMiseAJour miseAJour={m} />
                </div>
              </details>
            </article>
          ))}
        </section>
      )}
    </div>
  )
}

function Entete({ miseAJour: m }: { miseAJour: MiseAJour }) {
  return (
    <>
      <p className={styles.date}>
        <time dateTime={m.quand}>{LE.format(new Date(m.quand))}</time>
        {m.version && ` · ${m.version}`}
      </p>
      <h3 className={styles.titre}>{m.titre}</h3>
    </>
  )
}

// `premiere` : la dernière parue, en haut de page ; les images des précédentes attendent qu'on y descende.
function Corps({ miseAJour: m, premiere = false }: { miseAJour: MiseAJour; premiere?: boolean }) {
  return (
    <>
      {m.image && (
        <img
          className={styles.image}
          src={aLaTaille(m.image, LARGEUR_IMAGE)}
          alt=""
          loading={premiere ? 'eager' : 'lazy'}
        />
      )}
      {blocsDuTexte(m.texte).map((bloc, i) =>
        bloc.sorte === 'paragraphe' ? (
          <p key={i} className={styles.paragraphe}>
            {bloc.texte}
          </p>
        ) : (
          <ul key={i} className={styles.liste}>
            {bloc.points.map((p, j) => (
              <li key={j}>
                {p.tete && <strong>{p.tete}</strong>}
                {p.reste}
              </li>
            ))}
          </ul>
        ),
      )}
    </>
  )
}
