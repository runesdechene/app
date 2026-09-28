/**
 * QUOI     — le Registre (maquette 45:278, spec V2 §10) : les canaux à cocher, une colonne dense
 *            de messages (le portrait, le nom, le texte, l'heure à droite), et la barre pour écrire.
 * POURQUOI — « un chat de MMO, pas une messagerie » : pas de fils, pas de citations. Un
 *            message de « Bugs & suggestions » porte toujours son préfixe, même seul canal coché :
 *            chaque message dit d'où il vient (Uriel, 28/09). L'heure à droite : on lit d'abord
 *            qui parle. Un nom ouvre le profil, dans Messages, qui reste derrière.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import coche from '@/assets/ui/coche-canal.svg'
import { VENU_D_UN_ECRAN } from '@/shared/lib/retour'
import { Avatar } from '@/shared/ui/Avatar'
import { CANAUX, type Canal } from '../api/lireRegistre'
import { useRegistre } from '../hooks/useRegistre'
import { BarreEcrire } from './BarreEcrire'
import styles from './Registre.module.css'

const NOMS: Record<Canal, { filtre: string; court: string }> = {
  general: { filtre: 'Canal général', court: 'Général' },
  bugs: { filtre: 'Bugs & suggestions', court: 'Bugs' },
}
const PREFIXE_BUGS = '[Bug & Suggestions]'
const HEURE = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: '2-digit' })

export function Registre() {
  const { messages, erreur, ecrire, echecEnvoi } = useRegistre()
  const [coches, setCoches] = useState<Set<Canal>>(() => new Set(CANAUX))
  const [canal, setCanal] = useState<Canal>('general')
  const liste = useRef<HTMLOListElement>(null)

  const visibles = (messages ?? []).filter((m) => coches.has(m.canal))

  // Le dernier message reste en vue : à l'ouverture, et à chaque nouveau. Seule la liste
  // défile — jamais la page (le haut et la barre d'écriture restent fixes, Uriel 28/09).
  useEffect(() => {
    const l = liste.current
    if (l) l.scrollTop = l.scrollHeight
  }, [visibles.length])

  const basculer = (c: Canal) => {
    setCoches((avant) => {
      const apres = new Set(avant)
      if (apres.has(c)) apres.delete(c)
      else apres.add(c)
      return apres.size === 0 ? avant : apres // au moins un canal reste coché
    })
  }

  return (
    <div className={styles.registre}>
      <div className={styles.filtres} role="group" aria-label="Canaux">
        {CANAUX.map((c) => (
          <button
            key={c}
            type="button"
            className={c === 'bugs' ? styles.filtreBugs : styles.filtre}
            aria-pressed={coches.has(c)}
            onClick={() => {
              basculer(c)
            }}
          >
            {coches.has(c) && <img src={coche} alt="" width={10} height={10} />}
            {NOMS[c].filtre}
          </button>
        ))}
      </div>

      {erreur && <p className={styles.alerte}>Le Registre n’a pas pu être lu.</p>}
      <ol ref={liste} className={styles.messages} aria-label="Registre">
        {visibles.map((m) => (
          <li key={m.id} className={styles.message}>
            <Avatar url={m.auteur.avatar} nom={m.auteur.nom} taille="mini" />
            <p className={styles.texte}>
              <Link
                className={styles.nom}
                to={`/messages/explorateur/${m.auteur.id}`}
                state={VENU_D_UN_ECRAN}
              >
                {m.auteur.nom}
              </Link>{' '}
              {m.canal === 'bugs' && <span className={styles.prefixe}>{PREFIXE_BUGS} </span>}
              {m.texte}
            </p>
            <time className={styles.heure} dateTime={m.quand}>
              {HEURE.format(new Date(m.quand))}
            </time>
          </li>
        ))}
      </ol>

      <BarreEcrire
        invite="Écrire quelque chose"
        maximum={500}
        onEnvoyer={(t) => ecrire(canal, t)}
        avant={
          <select
            className={styles.canal}
            aria-label="Canal"
            value={canal}
            onChange={(e) => {
              setCanal(e.target.value === 'bugs' ? 'bugs' : 'general')
            }}
          >
            {CANAUX.map((c) => (
              <option key={c} value={c}>
                {NOMS[c].court}
              </option>
            ))}
          </select>
        }
      />
      {echecEnvoi && (
        <p role="alert" className={styles.alerte}>
          Le message n’est pas parti. Réessaie dans un instant.
        </p>
      )}
    </div>
  )
}
