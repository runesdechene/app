/**
 * QUOI     — « Blog de la boutique » : les articles écrits en Markdown et publiés sur le blog Shopify (titre, type,
 *            « Sur la boutique » ou « Brouillon », date). « + Nouvel article » et chaque ligne ouvrent l'éditeur
 *            par-dessus (route enfant).
 * POURQUOI — la ligne garde la recherche de la liste dans son lien (le tiroir revient à la liste telle qu'on l'a quittée).
 */
import { Link, Outlet, useLocation } from 'react-router'
import { dateCourte } from '@/shared/lib/dates'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { Article } from '../api/blog'
import { useBlog } from '../hooks/useBlog'
import styles from './Joueurs.module.css'

function LigneDArticle({ article }: { article: Article }) {
  const { search } = useLocation()
  const enLigne = article.shopify_article_id !== null
  return (
    <Link className={styles.ligne} to={{ pathname: article.id, search }}>
      <span className={styles.titreDeLigne}>{article.title}</span>
      <span className={styles.etiquettes}>
        <Balise texte={article.type} teinte="boutique" />
        <Balise texte={enLigne ? 'Sur la boutique' : 'Brouillon'} teinte={enLigne ? 'nouveau' : 'sommeil'} />
        <span>{dateCourte(article.updated_at)}</span>
      </span>
    </Link>
  )
}

export function Blog() {
  const { data, error } = useBlog()
  const { search } = useLocation()
  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Parler aux joueurs"
        titre="Blog de la boutique"
        phrase="Les articles du blog de runesdechene.com, écrits ici en Markdown."
        aDroite={<Link className={styles.boutonContour} to={{ pathname: 'nouveau', search }}>+ Nouvel article</Link>}
      />
      <TitreDeSection titre="Articles" />
      {error && <p role="alert" className={styles.erreur}>Les articles n’ont pas pu se charger : {error.message}</p>}
      {data?.length === 0 && <p className={styles.calme}>Aucun article.</p>}
      {data && data.length > 0 && <Bloc>{data.map((a) => <LigneDArticle key={a.id} article={a} />)}</Bloc>}
      <Outlet />
    </div>
  )
}
