/**
 * QUOI     — un message du Registre : le portrait, le nom, le texte et ses « @Nom », l'heure à
 *            droite ; et ses cœurs (migration 409).
 * POURQUOI — « un chat de MMO » : la colonne reste dense. Réagir ne prend pas de place : au
 *            téléphone, un double toucher sur le message ; sur PC, un cœur qui remplace l'heure au
 *            survol. Les cœurs reçus s'affichent sous le texte, jamais « 0 ». On en donne à volonté,
 *            chaque toucher en fait s'envoler un (Uriel, 01/10 : « comme pour les activités »). Son
 *            propre message ne se salue pas : ses cœurs se lisent sans bouton.
 */
import { Fragment, useRef } from 'react'
import { Link } from 'react-router'
import { useEnvols } from '@/shared/hooks/useEnvols'
import { Avatar } from '@/shared/ui/Avatar'
import { Envols } from '@/shared/ui/Envols'
import type { Mention, Message } from '../api/lireRegistre'
import { heureDe } from '../lib/jour'
import { decouper } from '../lib/mentions'
import styles from './LigneMessage.module.css'

const PREFIXE_BUGS = '[Bug & Suggestions]'
// Deux touchers plus rapprochés que ça : un double toucher.
const DOUBLE_TOUCHER_MS = 350

export function LigneMessage({
  message: m,
  suite,
  prefixe,
  onSaluer,
}: {
  message: Message
  suite: boolean // la suite d'un même auteur : ni portrait ni nom
  prefixe: boolean // « [Bug & Suggestions] » devant le texte
  onSaluer: (id: number) => void
}) {
  const { envols, lancer, finir } = useEnvols()
  const dernierToucher = useRef<number | null>(null)
  const saluer = () => {
    onSaluer(m.id)
    lancer()
  }
  const nom = `Saluer le message de ${m.auteur.nom}`

  return (
    <li
      className={[suite ? styles.suite : styles.message, m.mentionneMoi && styles.mentionne]
        .filter(Boolean)
        .join(' ')}
      onPointerUp={(e) => {
        if (m.moi || e.pointerType === 'mouse') return
        const maintenant = e.timeStamp
        const avant = dernierToucher.current
        if (avant !== null && maintenant - avant < DOUBLE_TOUCHER_MS) {
          dernierToucher.current = null
          saluer()
        } else {
          dernierToucher.current = maintenant
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

      {m.saluts > 0 &&
        (m.moi ? (
          <span className={styles.coeurs}>
            <span className={styles.coeur} aria-hidden="true" />
            {m.saluts}
          </span>
        ) : (
          <button
            type="button"
            className={styles.coeurs}
            aria-pressed={m.salue}
            aria-label={`${nom} (${String(m.saluts)})`}
            onClick={saluer}
          >
            <span className={styles.coeur} aria-hidden="true" />
            {m.saluts}
            <Envols envols={envols} onFin={finir} />
          </button>
        ))}
      {m.saluts === 0 && !m.moi && (
        <button type="button" className={styles.aimer} aria-label={nom} onClick={saluer}>
          <span className={styles.coeur} aria-hidden="true" />
          <Envols envols={envols} onFin={finir} />
        </button>
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
