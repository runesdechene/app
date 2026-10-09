/**
 * QUOI     — la Charte (maquette 94:181) : six principes, puis « Signer » — le doigt maintenu dans
 *            le cercle, qui se remplit (ou la touche Espace maintenue).
 * POURQUOI — Uriel, 27/09 : la Charte se lit en entier avant de pouvoir la signer, et se signe au
 *            pouce maintenu — un geste, pas une case cochée. Le cercle s'ouvre quand la fin
 *            de la liste est passée à l'écran. Le cercle se remplit par une
 *            animation CSS : la relâcher avant la fin l'efface, aller au bout signe.
 * ATTENTION — animations réduites : un simple appui signe (aucune fin d'animation n'arriverait).
 */
import { useState } from 'react'
import { Navigate } from 'react-router'
import camaraderie from '@/assets/onboarding/charte-camaraderie.svg'
import decouvertes from '@/assets/onboarding/charte-decouvertes.svg'
import peuples from '@/assets/onboarding/charte-peuples.svg'
import taisent from '@/assets/onboarding/charte-taisent.svg'
import visage from '@/assets/onboarding/charte-visage.svg'
import vrai from '@/assets/onboarding/charte-vrai.svg'
import charte from '@/assets/onboarding/charte.webp'
import { useEntrer } from '../hooks/useEntrer'
import { useLuJusquauBout } from '../hooks/useLuJusquauBout'
import { useParcours } from '../hooks/useParcours'
import styles from './Charte.module.css'
import commun from './Onboarding.module.css'
import { Page } from './Page'

const PRINCIPES = [
  {
    icone: decouvertes,
    titre: 'Respect des découvertes',
    texte:
      'Chaque porteur protège les lieux à sa façon. Il n’abîme rien, et agit pour le préserver.',
  },
  {
    icone: peuples,
    titre: 'Respect des peuples',
    texte:
      'Respect des peuples, des cultures et de leur droit de subsister et de décider d’eux-mêmes.',
  },
  {
    icone: vrai,
    titre: 'On dit vrai',
    texte:
      'Ce qu’on raconte d’un lieu, on sait d’où on le tient. Une légende se présente comme une légende. Un doute, on le marque.',
  },
  {
    icone: taisent,
    titre: 'Certains lieux se taisent',
    texte:
      'Un site fragile ou menacé ne se partage pas en mode Public. Préférez « Porteurs seulement ».',
  },
  {
    icone: visage,
    titre: 'Un visage n’est pas un décor',
    texte: 'On demande avant de photographier quelqu’un, et avant de publier sa photo.',
  },
  {
    icone: camaraderie,
    titre: 'Camaraderie et bienveillance',
    texte:
      'On se salue, on s’entraide, on se corrige avec égards. Vous rejoignez une confrérie moderne.',
  },
]

const mouvementReduit = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function Charte() {
  const { parcours } = useParcours()
  const { signerPuisEntrer } = useEntrer()
  const [appui, setAppui] = useState(false)
  const { repere, lu } = useLuJusquauBout()
  // La Charte se signe connecté, quand elle manque au compte ; sans connexion, on la demande.
  if (!parcours.connecte) return <Navigate to="/bienvenue/email" replace />
  const signer = signerPuisEntrer
  const appuyer = () => {
    if (mouvementReduit()) signer()
    else setAppui(true)
  }
  const relacher = () => {
    setAppui(false)
  }

  return (
    <Page
      bas={
        <div className={styles.signer}>
          <p className={styles.consigne}>
            <span className={styles.mot}>Signer</span>
            {lu ? 'Tenir son doigt appuyé dans le cercle' : 'Lis la Charte jusqu’au bout'}
          </p>
          <button
            type="button"
            className={appui ? styles.cercleAppui : styles.cercle}
            aria-label="Signer la Charte : maintenir appuyé, ou maintenir la touche Espace"
            disabled={!lu}
            onPointerDown={appuyer}
            onPointerUp={relacher}
            onPointerLeave={relacher}
            onKeyDown={(e) => {
              if (e.key === ' ' && !e.repeat) appuyer()
            }}
            onKeyUp={relacher}
            onAnimationEnd={signer}
          >
            <svg viewBox="0 0 78 78" aria-hidden="true">
              <circle className={styles.piste} cx="39" cy="39" r="36" />
              <circle className={styles.remplissage} cx="39" cy="39" r="36" />
            </svg>
            <span className={styles.coche} aria-hidden="true" />
          </button>
        </div>
      }
    >
      <img className={styles.illustration} src={charte} alt="" />
      <h1 className={commun.titre}>La Charte</h1>
      <p className={commun.chapeau}>
        Runes de Chêne <strong>EXPLORE</strong> rassemble des explorateurs érudits qui n’ont pas
        froid aux yeux. Tous partagent, en théorie, ces principes.
      </p>
      <ul className={styles.principes}>
        {PRINCIPES.map((p) => (
          <li key={p.titre} className={styles.principe}>
            <img className={styles.icone} src={p.icone} alt="" width={22} height={22} />
            <h2 className={styles.nomPrincipe}>{p.titre}</h2>
            <p className={styles.texte}>{p.texte}</p>
          </li>
        ))}
      </ul>
      <div ref={repere} aria-hidden="true" />
    </Page>
  )
}
