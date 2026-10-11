/**
 * QUOI     — une conversation de Murmures (maquettes 264:162 et 264:185) : pas de bulles, les mots
 *            flottent sur le parchemin — les siens à gauche, les miens à droite ; le moment
 *            (« hier soir », « ce matin ») ne s'écrit qu'après une heure de silence ; un « lu » à
 *            peine visible sous mon dernier murmure. Vide : « Rien n'a encore été dit. »
 * POURQUOI — Uriel, 28/09 : du slow life sans cérémonie — on écrit aussi vite qu'un chat, sans
 *            « en train d'écrire » ni « en ligne ». La barre est celle du Registre.
 *            Mon murmure s'ouvre d'un appui long (ou d'un clic droit) : le modifier dans ses 15
 *            minutes, le retirer — il disparaît aussi chez l'autre (11/10, migration 502).
 */
import { useState } from 'react'
import type { Murmure } from '../api/lireMurmures'
import { useAppuiLong } from '../hooks/useAppuiLong'
import { useColleEnBas } from '../hooks/useColleEnBas'
import { useConversation } from '../hooks/useMurmures'
import { apresUnSilence, moment } from '../lib/moment'
import { encoreModifiable } from '../lib/retouche'
import { BarreEcrire } from './BarreEcrire'
import { FeuilleMessage } from './FeuilleMessage'
import styles from './Murmures.module.css'

export function Conversation({ avec }: { avec: string }) {
  const { murmures, correspondant, envoyer, echecEnvoi, modifier, retirer } = useConversation(avec)
  // Le dernier murmure en vue ; seul le fil défile, l'en-tête et la barre restent fixes.
  const coller = useColleEnBas()

  // Le « lu » se pose sous mon dernier murmure, s'il a été lu.
  const dernierDeMoi = murmures?.filter((m) => m.deMoi).at(-1)

  return (
    <div className={styles.conversation}>
      <div ref={coller} className={styles.murmures}>
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
            onModifier={(t) => modifier(m.id, t)}
            onRetirer={() => retirer(m.id)}
          />
        ))}
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
  onModifier,
  onRetirer,
}: {
  murmure: Murmure
  momentAvant: boolean
  lu: boolean
  onModifier: (texte: string) => Promise<void>
  onRetirer: () => Promise<void>
}) {
  const [actions, setActions] = useState(false)
  const texte = murmure.texte
  const appui = useAppuiLong(
    murmure.deMoi && texte !== null
      ? () => {
          setActions(true)
        }
      : null,
  )
  return (
    <>
      {momentAvant && (
        <p className={styles.moment}>
          <span>{moment(murmure.quand)}</span>
        </p>
      )}
      <p className={murmure.deMoi ? styles.deMoi : styles.deLui} {...appui}>
        {texte === null ? <em className={styles.retire}>Message retiré</em> : texte}
        {murmure.modifie && texte !== null && <span className={styles.modifie}> (modifié)</span>}
      </p>
      {actions && texte !== null && (
        <FeuilleMessage
          texte={texte}
          modifiable={encoreModifiable(murmure.quand)}
          maximum={1000}
          onModifier={onModifier}
          onRetirer={onRetirer}
          onFermer={() => {
            setActions(false)
          }}
        />
      )}
      {lu && <p className={styles.lu}>lu</p>}
    </>
  )
}
