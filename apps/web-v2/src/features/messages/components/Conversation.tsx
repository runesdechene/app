/**
 * QUOI     — une conversation de Murmures (maquettes 264:162 et 264:185) : pas de bulles, les mots
 *            flottent sur le parchemin — les siens à gauche, les miens à droite ; le moment
 *            (« hier soir », « ce matin ») ne s'écrit qu'après une heure de silence ; un « lu » à
 *            peine visible sous mon dernier murmure. Vide : « Rien n'a encore été dit. »
 * POURQUOI — Uriel, 28/09 : du slow life sans cérémonie — on écrit aussi vite qu'un chat, sans
 *            « en train d'écrire » ni « en ligne ». La barre est celle du Registre.
 */
import { useEffect, useRef } from 'react'
import type { Murmure } from '../api/lireMurmures'
import { useConversation } from '../hooks/useMurmures'
import { apresUnSilence, moment } from '../lib/moment'
import { BarreEcrire } from './BarreEcrire'
import styles from './Murmures.module.css'

export function Conversation({ avec }: { avec: string }) {
  const { murmures, correspondant, envoyer, echecEnvoi } = useConversation(avec)
  const fin = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fin.current?.scrollIntoView({ block: 'end' })
  }, [murmures?.length])

  // Le « lu » se pose sous mon dernier murmure, s'il a été lu.
  const dernierDeMoi = murmures?.filter((m) => m.deMoi).at(-1)

  return (
    <div className={styles.conversation}>
      <div className={styles.murmures}>
        {murmures && murmures.length === 0 && (
          <div className={styles.silence}>
            <p className={styles.rien}>Rien n’a encore été dit.</p>
            <p className={styles.unMot}>Un mot suffit : un lieu, une idée, un bonjour.</p>
          </div>
        )}
        {murmures?.map((m, i) => (
          <Ligne
            key={m.id}
            murmure={m}
            momentAvant={apresUnSilence(murmures[i - 1]?.quand, m.quand)}
            lu={m === dernierDeMoi && m.luLe !== null}
          />
        ))}
        <div ref={fin} />
      </div>
      {echecEnvoi && (
        <p role="alert" className={styles.alerte}>
          Le murmure n’est pas parti. Réessaie dans un instant.
        </p>
      )}
      <BarreEcrire
        invite={`Murmurer à ${correspondant?.nom ?? '…'}`}
        maximum={1000}
        onEnvoyer={envoyer}
      />
    </div>
  )
}

function Ligne({
  murmure,
  momentAvant,
  lu,
}: {
  murmure: Murmure
  momentAvant: boolean
  lu: boolean
}) {
  return (
    <>
      {momentAvant && (
        <p className={styles.moment}>
          <span>{moment(murmure.quand)}</span>
        </p>
      )}
      <p className={murmure.deMoi ? styles.deMoi : styles.deLui}>{murmure.texte}</p>
      {lu && <p className={styles.lu}>lu</p>}
    </>
  )
}
