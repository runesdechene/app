/**
 * QUOI     — /flyer, la page du QR imprimé sur le flyer : le logo, puis les cinq liens de la marque.
 *            La photo et le parchemin sont au cadre commun (CadreFlyer).
 * POURQUOI — c'est la porte d'entrée des gens qui n'ont jamais ouvert le Hub : une seule colonne,
 *            des liens francs, rien d'autre. Les liens s'ouvrent dans le même onglet, comme sur
 *            la version en ligne. Maquette Figma 605:1433 (téléphone) et 605:1497 (PC).
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import boutique from '@/assets/flyer/boutique.svg'
import cadeau from '@/assets/flyer/cadeau.webp'
import carte from '@/assets/flyer/carte.svg'
import chevron from '@/assets/flyer/chevron.svg'
import fellowship from '@/assets/flyer/fellowship.png'
import instagram from '@/assets/flyer/instagram.svg'
import logo from '@/assets/flyer/logo-slogan.webp'
import styles from './PageFlyer.module.css'

interface Lien {
  titre: string
  sousTitre: string
  href: string
  icone: ReactNode
}

function Icone({ src, className }: { src: string; className: string | undefined }) {
  return <img src={src} alt="" className={className} />
}

const LIENS: Lien[] = [
  {
    titre: 'La boutique',
    sousTitre: 'Les vêtements Runes de Chêne',
    href: 'https://runesdechene.com',
    icone: <Icone src={boutique} className={styles.icone} />,
  },
  {
    titre: 'L’application Explore',
    sousTitre: 'Les lieux oubliés, autour de toi',
    href: 'https://app.runesdechene.com',
    icone: <Icone src={carte} className={styles.icone} />,
  },
  {
    titre: 'Ton cadeau de bienvenue',
    sousTitre: 'Un code pour ta première commande',
    href: '/flyercadeau',
    icone: <Icone src={cadeau} className={styles.iconeImage} />,
  },
  {
    titre: 'Instagram',
    sousTitre: '@runesdechene',
    href: 'https://www.instagram.com/runesdechene',
    icone: <Icone src={instagram} className={styles.icone} />,
  },
  {
    titre: 'Fellowship — nos événements',
    sousTitre: 'Où nous croiser cette saison',
    href: 'https://flw.sh/runesdechene',
    icone: <Icone src={fellowship} className={styles.iconeImage} />,
  },
]

function Contenu({ lien }: { lien: Lien }) {
  return (
    <>
      <span className={styles.pastille}>{lien.icone}</span>
      <span className={styles.texte}>
        <span className={styles.titre}>{lien.titre}</span>
        <span className={styles.sousTitre}>{lien.sousTitre}</span>
      </span>
      <Icone src={chevron} className={styles.chevron} />
    </>
  )
}

export function PageFlyer() {
  return (
    <>
      <title>Runes de Chêne</title>
      <h1 className={styles.logo}>
        <img src={logo} alt="Runes de Chêne — Portez l’histoire" />
      </h1>
      <ul className={styles.liens}>
        {LIENS.map((lien) => (
          <li key={lien.href}>
            {/* Une page du même cadre : React Router, sans recharger, avec la transition du navigateur. */}
            {lien.href.startsWith('/') ? (
              <Link to={lien.href} viewTransition className={styles.lien}><Contenu lien={lien} /></Link>
            ) : (
              <a href={lien.href} className={styles.lien}><Contenu lien={lien} /></a>
            )}
          </li>
        ))}
      </ul>
      <p className={styles.pied}>runesdechene.com</p>
    </>
  )
}
