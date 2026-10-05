/**
 * QUOI     — un message du Registre : le portrait, le nom, le texte et ses « @Nom », l'heure à
 *            droite ; et ses cœurs — un par personne, et l'on voit qui a aimé (migration 410).
 * POURQUOI — Uriel, 02/10 : « un seul like, mais on voit qui a liké — plus fort », et on peut le
 *            retirer. La colonne reste dense : sur PC, un cœur remplace l'heure au survol — sur
 *            chaque message, même déjà aimé par d'autres, tant que je n'ai pas aimé (05/10) ; au
 *            téléphone, un double toucher sur le message l'allume (il ne l'éteint jamais : on ne
 *            retire pas un cœur en tapotant). Sous le texte, une gélule : les portraits de qui a
 *            aimé (ils ouvrent la liste), puis le cœur et le nombre, qu'on allume ou éteint.
 *            Jamais « 0 ». Son propre message s'aime aussi : « ça peut arriver » (05/10).
 */
import { Fragment, useRef, useState } from 'react'
import { Link } from 'react-router'
import { useEnvols } from '@/shared/hooks/useEnvols'
import { Avatar } from '@/shared/ui/Avatar'
import { Envols } from '@/shared/ui/Envols'
import { Feuille } from '@/shared/ui/Feuille'
import type { Mention, Message } from '../api/lireRegistre'
import { heureDe } from '../lib/jour'
import { decouper } from '../lib/mentions'
import styles from './LigneMessage.module.css'

const PREFIXE_BUGS = '[Bug & Suggestions]'
// Deux touchers plus rapprochés que ça : un double toucher.
const DOUBLE_TOUCHER_MS = 350
const PORTRAITS = 3

export function LigneMessage({
  message: m,
  suite,
  prefixe,
  aimeEnCours,
  onAimer,
}: {
  message: Message
  suite: boolean // la suite d'un même auteur : ni portrait ni nom
  prefixe: boolean // « [Bug & Suggestions] » devant le texte
  aimeEnCours: boolean | undefined // mon cœur parti, pas encore compté par la base
  onAimer: (id: number, aime: boolean) => void
}) {
  const { envols, lancer, finir } = useEnvols()
  const dernierToucher = useRef<number | null>(null)
  const [liste, setListe] = useState(false)
  const aime = aimeEnCours ?? m.aime
  const nombre = m.coeurs.length + (aime === m.aime ? 0 : aime ? 1 : -1)
  const nom = `Aimer le message de ${m.auteur.nom}`

  const basculer = () => {
    onAimer(m.id, !aime)
    if (!aime) lancer()
  }

  return (
    <li
      className={[suite ? styles.suite : styles.message, m.mentionneMoi && styles.mentionne]
        .filter(Boolean)
        .join(' ')}
      onPointerUp={(e) => {
        if (aime || e.pointerType === 'mouse') return
        const avant = dernierToucher.current
        if (avant !== null && e.timeStamp - avant < DOUBLE_TOUCHER_MS) {
          dernierToucher.current = null
          basculer()
        } else {
          dernierToucher.current = e.timeStamp
        }
      }}
    >
      {suite ? (
        <span aria-hidden="true" />
      ) : (
        <Avatar url={m.auteur.avatar} nom={m.auteur.nom} taille="mini" />
      )}
      <p className={styles.texte}>
        {!suite && (
          <>
            <Link className={styles.nom} to={`/messages/explorateur/${m.auteur.id}`}>
              {m.auteur.nom}
            </Link>{' '}
          </>
        )}
        {prefixe && <span className={styles.prefixe}>{PREFIXE_BUGS} </span>}
        <TexteAvecMentions texte={m.texte} mentions={m.mentions} />
      </p>
      <time className={styles.heure} dateTime={m.quand}>
        {heureDe(m.quand)}
      </time>

      {/* Sur PC, au survol, le cœur prend la place de l'heure — tant que je n'ai pas aimé. */}
      {!aime && (
        <button type="button" className={styles.aimer} aria-label={nom} onClick={basculer}>
          <span className={styles.coeur} aria-hidden="true" />
          <Envols envols={envols} onFin={finir} />
        </button>
      )}

      {nombre > 0 && (
        <div className={styles.coeurs}>
          <button
            type="button"
            className={styles.qui}
            aria-label={`Voir qui a aimé (${String(nombre)})`}
            title={m.coeurs.map((p) => p.nom).join(', ')}
            onClick={() => {
              setListe(true)
            }}
          >
            {m.coeurs.slice(0, PORTRAITS).map((p) => (
              <Avatar key={p.id} url={p.avatar} nom={p.nom} taille="mini" />
            ))}
          </button>
          <button
            type="button"
            className={styles.basculer}
            aria-label={`${nom} (${String(nombre)})`}
            aria-pressed={aime}
            onClick={basculer}
          >
            <span className={styles.coeur} aria-hidden="true" />
            {nombre}
          </button>
        </div>
      )}

      {liste && (
        <Feuille
          titre="Ils ont aimé"
          onFermer={() => {
            setListe(false)
          }}
        >
          <ul className={styles.liste}>
            {m.coeurs.map((p) => (
              <li key={p.id}>
                <Link className={styles.personne} to={`/messages/explorateur/${p.id}`}>
                  <Avatar url={p.avatar} nom={p.nom} taille="mini" />
                  {p.nom}
                </Link>
              </li>
            ))}
          </ul>
        </Feuille>
      )}
    </li>
  )
}

// Le texte d'un message, ses « @Nom » en liens vers les profils.
function TexteAvecMentions({ texte, mentions }: { texte: string; mentions: Mention[] }) {
  return decouper(texte, mentions).map((morceau, i) =>
    'mention' in morceau ? (
      <Link key={i} className={styles.mention} to={`/messages/explorateur/${morceau.mention.id}`}>
        @{morceau.mention.nom}
      </Link>
    ) : (
      <Fragment key={i}>{morceau.texte}</Fragment>
    ),
  )
}
