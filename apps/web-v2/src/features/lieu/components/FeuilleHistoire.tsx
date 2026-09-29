/**
 * QUOI     — la feuille « L'histoire de la fiche » (maquette « Lieu — l'histoire de la fiche »,
 *            30/09) : chaque version, qui et quand, ce qu'elle a changé ; la plus récente est
 *            « Actuelle », on peut revenir aux autres.
 * POURQUOI — Modifier est ouvert à tous : l'histoire le rend sûr. Revenir à une version en crée
 *            une nouvelle, rien ne se perd.
 */
import { Avatar } from '@/shared/ui/Avatar'
import { Feuille } from '@/shared/ui/Feuille'
import { useHistoire } from '../hooks/useHistoire'
import { ceQuiAChange } from '../lib/versions'
import styles from './Feuilles.module.css'

const LE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

export function FeuilleHistoire({ id, onFermer }: { id: string; onFermer: () => void }) {
  const { versions, revenir, enCours, echec } = useHistoire(id)
  return (
    <Feuille titre="L’histoire de la fiche" onFermer={onFermer}>
      <h2 className={styles.titre}>L’histoire de la fiche</h2>
      <ul className={styles.gens}>
        {versions?.map((v, i) => (
          <li key={v.id ?? 'origine'} className={styles.personne}>
            <Avatar url={v.qui?.avatar ?? null} nom={v.qui?.nom ?? '?'} taille="petit" />
            <span className={styles.texte}>
              <span className={styles.nom}>
                <strong>{v.qui?.nom ?? 'Quelqu’un'}</strong> {ceQuiAChange(v)}
              </span>
              <span className={styles.description}>
                {[LE.format(new Date(v.quand)), v.note].filter(Boolean).join(' · ')}
              </span>
            </span>
            {i === 0 ? (
              <span className={styles.actuelle}>Actuelle</span>
            ) : (
              v.id !== null && (
                <button
                  type="button"
                  className={styles.revenir}
                  disabled={enCours}
                  onClick={() => {
                    if (v.id !== null) revenir(v.id)
                  }}
                >
                  Revenir
                </button>
              )
            )}
          </li>
        ))}
      </ul>
      {echec && (
        <p className={styles.refus} role="alert">
          Pas de retour possible pour l’instant. Réessaie dans un instant.
        </p>
      )}
      <p className={styles.description}>
        Chaque version est gardée. Revenir à une version en crée une nouvelle : rien ne se perd.
      </p>
    </Feuille>
  )
}
