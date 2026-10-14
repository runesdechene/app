/**
 * QUOI     — l'aperçu d'une bannière, tel qu'elle paraît sur l'Accueil d'Explore : image, voile, « Boutique », titre, sous-titre.
 * POURQUOI — il suit les réglages en cours de saisie, avant l'enregistrement. Même mise en page que la V2 ; le voile
 *            et l'ombre viennent de lib/banniere, passés au CSS en variables comme le fait la V2.
 */
import type { CSSProperties } from 'react'
import { degradeDeVoile, ombreDeTexte } from '../lib/banniere'
import bannieres from './Bannieres.module.css'

export type Reglages = {
  titre: string; sousTitre: string
  voile: string; opacite: number
  tag: string; couleurTitre: string; couleurSousTitre: string
  ombre: string; force: number
}

export function ApercuBanniere({ image, reglages: r }: { image: string; reglages: Reglages }) {
  return (
    <div className={bannieres.apercu} style={{
        '--degrade': degradeDeVoile(r.voile, r.opacite),
        '--ombre-texte': ombreDeTexte(r.ombre, r.force),
        '--teinte-tag': r.tag,
        '--teinte-titre': r.couleurTitre,
        '--teinte-sous-titre': r.couleurSousTitre,
      } as CSSProperties}
      data-testid="apercu">
      <img src={image} alt="" />
      <span className={bannieres.voile} aria-hidden="true" />
      <span className={bannieres.texte}>
        <span className={bannieres.tag}>Boutique</span>
        <span className={bannieres.titre}>{r.titre || '(titre vide)'}</span>
        {r.sousTitre && <span className={bannieres.sousTitre}>{r.sousTitre}</span>}
      </span>
    </div>
  )
}
