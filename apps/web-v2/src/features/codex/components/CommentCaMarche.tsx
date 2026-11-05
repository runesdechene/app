/**
 * QUOI     — la feuille « Comment ça marche ? » du Codex (maquette C, 05/11) : ce qu'est un
 *            Fragment, trois étapes (les achats, le scan, la collection) et le scanner. Et le lien
 *            rouge qui l'ouvre.
 * POURQUOI — les achats de la boutique ne se scannent pas : ils arrivent seuls, si le compte a
 *            l'adresse e-mail de la commande. La feuille le dit, sinon on croit que ça ne marche pas.
 *            Sur PC, pas de bouton du scanner : on ne vise pas un t-shirt avec un ordinateur.
 */
import { useNavigate } from 'react-router'
import { useSurOrdinateur } from '@/shared/hooks/useSurOrdinateur'
import { BOUTIQUE_URL } from '@/shared/lib/boutique'
import { debloquerSon } from '@/shared/lib/son'
import { Button } from '@/shared/ui/Button'
import { Feuille } from '@/shared/ui/Feuille'
import { Text } from '@/shared/ui/Text'
import styles from './CommentCaMarche.module.css'

export function LienExplication({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className={styles.lien} onClick={onClick}>
      Comment ça marche ?
    </button>
  )
}

export function CommentCaMarche({ onFermer }: { onFermer: () => void }) {
  const navigate = useNavigate()
  const surOrdinateur = useSurOrdinateur()
  return (
    <Feuille titre="Comment ça marche ?" onFermer={onFermer}>
      <Text variant="titre-section">Comment ça marche ?</Text>
      <Text variant="corps">
        Le Codex rassemble les Fragments : les motifs des t-shirts Runes de Chêne. Chacun cache une
        histoire.
      </Text>
      <ol className={styles.etapes}>
        <li className={styles.etape}>
          <span className={styles.sceau} aria-hidden="true">
            1
          </span>
          <div className={styles.texte}>
            <Text variant="titre-carte">Tes achats arrivent seuls</Text>
            <p>
              Un t-shirt acheté sur la boutique entre dans ton Codex, porté : toute son histoire
              s’ouvre. Il suffit d’utiliser ici la même adresse e-mail que pour ta commande.
            </p>
            <a className={styles.lien} href={BOUTIQUE_URL} target="_blank" rel="noopener">
              Voir la boutique
            </a>
          </div>
        </li>
        <li className={styles.etape}>
          <span className={styles.sceau} aria-hidden="true">
            2
          </span>
          <div className={styles.texte}>
            <Text variant="titre-carte">Scanne les t-shirts que tu croises</Text>
            <p>
              Quelqu’un porte un Runes de Chêne ? Demande-lui, puis vise son motif avec le scanner.
              Le Fragment entre dans ton Codex et tu découvres une anecdote. Une nouvelle chaque
              jour.
            </p>
          </div>
        </li>
        <li className={styles.etape}>
          <span className={styles.sceau} aria-hidden="true">
            3
          </span>
          <div className={styles.texte}>
            <Text variant="titre-carte">Complète tes collections</Text>
            <p>
              Scanné, tu connais le motif. Porté, il est à toi. Porte toute une collection et tu
              gagnes son titre.
            </p>
          </div>
        </li>
      </ol>
      {!surOrdinateur && (
        <Button
          onClick={() => {
            debloquerSon() // ce toucher débloque le son du bip (Safari)
            void navigate('/scan')
          }}
        >
          Scanner un t-shirt
        </Button>
      )}
    </Feuille>
  )
}
