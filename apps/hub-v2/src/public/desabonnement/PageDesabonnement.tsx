/**
 * QUOI     — /desabonnement, le lien du pied de chaque Missive : un clic, et l'accord aux nouvelles est
 *            retiré (fonction `missives-desabonnement`, jeton signé dans ?j=).
 * POURQUOI — sans compte ni session : le jeton suffit. Le désabonnement attend un clic, pour qu'un
 *            scanner de liens qui ouvre la page ne désabonne personne. Le désabonnement en un clic des
 *            boîtes de réception (List-Unsubscribe) va droit à la fonction, sans cette page.
 *            Composition et jetons de /flyercadeau, sur le même parchemin.
 */
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import fond from '@/assets/flyer/fond-parchemin-entrelacs.webp'
import { Bouton } from '../briques/Bouton'
import { MessageDErreur } from '../briques/MessageDErreur'
import { PhotoFlyer } from '../briques/PhotoFlyer'
import { PagePublique } from '../PagePublique'
import styles from './PageDesabonnement.module.css'

// Le formulaire des nouvelles est sur la page d'accueil de la boutique.
const BOUTIQUE = 'https://runesdechene.com'

type Etat = 'attente' | 'envoi' | 'fait' | 'erreur'

async function desabonner(jeton: string): Promise<boolean> {
  const r = await fetch('/.netlify/functions/missives-desabonnement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ j: jeton }),
  })
  return r.ok
}

export function PageDesabonnement() {
  const [parametres] = useSearchParams()
  const [etat, setEtat] = useState<Etat>('attente')

  async function confirmer() {
    setEtat('envoi')
    const ok = await desabonner(parametres.get('j') ?? '').catch(() => false)
    setEtat(ok ? 'fait' : 'erreur')
  }

  return (
    <PagePublique titre="Les Missives — Runes de Chêne" photo={<PhotoFlyer telephone={false} />} fond={fond}>
      <div className={styles.page}>
        <h1 className={styles.titre}>
          <span className={styles.surtitre}>Les Missives</span> <span>de Runes de Chêne</span>
        </h1>
        {etat === 'fait' ? (
          <>
            <p className={styles.texte}>Tu ne recevras plus nos Missives.</p>
            <p className={styles.pied}>
              <a href={BOUTIQUE}>Je me suis trompé</a>
            </p>
          </>
        ) : (
          <>
            <p className={styles.texte}>
              Tu ne veux plus recevoir nos lettres ? Un clic suffit. Les e-mails de tes commandes, eux,
              continueront d’arriver.
            </p>
            {etat === 'erreur' && (
              <MessageDErreur>Ce lien ne fonctionne plus. Réponds simplement à une Missive pour te désabonner.</MessageDErreur>
            )}
            <Bouton onClick={() => void confirmer()} disabled={etat === 'envoi'}>
              {etat === 'envoi' ? 'Un instant…' : 'Me désabonner'}
            </Bouton>
          </>
        )}
      </div>
    </PagePublique>
  )
}
