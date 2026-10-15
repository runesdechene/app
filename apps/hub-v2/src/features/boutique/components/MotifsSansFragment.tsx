/**
 * QUOI     — les motifs Shopify (métaobjets Illustration) qui ne sont aucun Fragment, avec « En faire un Fragment ».
 * POURQUOI — d'anciens motifs à trier dans Shopify, ou un nouveau Fragment à ajouter. Un motif sans collection
 *            ne peut pas devenir un Fragment (la base le refuse) : le bouton le dit avant. Si l'inventaire
 *            Shopify est en panne (portée manquante, inventaire vide…), la panne se lit ici, jamais « rien ».
 */
import { useLocation, useNavigate } from 'react-router'
import { Bloc } from '@/shared/ui/Bloc'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import { AccesShopifyRefuse } from '../api/shopify'
import { useAjouterFragment, useFragments, useIllustrations } from '../hooks/useFragments'
import { motifsSansFragment } from '../lib/motifs'
import styles from './Boutique.module.css'

export function MotifsSansFragment() {
  const { data: motifs, error } = useIllustrations()
  const { data: fragments } = useFragments()
  const ajout = useAjouterFragment()
  const navigate = useNavigate()
  const { search } = useLocation()

  if (error) {
    const cause = error instanceof AccesShopifyRefuse ? `la portée ${error.portee} manque à l’app Shopify.` : error.message
    return (
      <>
        <TitreDeSection titre="Motifs Shopify sans Fragment" />
        <p className={styles.erreur} role="alert">{`Inventaire Shopify indisponible : ${cause}`}</p>
      </>
    )
  }
  if (!motifs || !fragments) return null
  const orphelins = motifsSansFragment(motifs, fragments)

  return (
    <>
      <TitreDeSection titre="Motifs Shopify sans Fragment" />
      <p className={styles.intro}>
        Des métaobjets Illustration qui ne correspondent à aucun Fragment : d’anciens motifs à trier dans Shopify, ou un nouveau Fragment à ajouter.
      </p>
      {ajout.isError && <p className={styles.erreur} role="alert">{ajout.error.message}</p>}
      {orphelins.length === 0 ? (
        <p className={styles.calme}>Tout est trié : chaque Illustration de Shopify est un Fragment.</p>
      ) : (
        <Bloc>
          {orphelins.map((motif) => (
            <div key={motif.handle} className={styles.ligne}>
              {motif.illustration_url ? <img className={styles.vignette} src={motif.illustration_url} alt="" /> : <span className={styles.vignette} />}
              <span className={styles.nom}>
                <strong>{motif.nom}</strong>
                <span>{motif.collection ? `collection ${motif.collection}` : 'aucune collection'}</span>
              </span>
              <span className={styles.actions}>
                <button
                  type="button"
                  className={styles.boutonContour}
                  disabled={!motif.collection || ajout.isPending}
                  onClick={() => { ajout.mutate(motif, { onSuccess: (id) => void navigate({ pathname: String(id), search }) }) }}
                >
                  En faire un Fragment
                </button>
                {!motif.collection && <span>Relie d’abord une collection à ce métaobjet dans Shopify</span>}
              </span>
            </div>
          ))}
        </Bloc>
      )}
    </>
  )
}
