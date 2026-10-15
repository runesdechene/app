/**
 * QUOI     — « Notifications » : ce qui part vraiment. Trois chiffres (téléphones abonnés, push partis en
 *            7 jours, notifications créées sans partir), le catalogue de chaque sorte en trois blocs (déclencheur,
 *            destinataire, la bulle telle qu'elle arrive, chiffres sur 7 et 30 jours), puis le fil des 50 dernières.
 * POURQUOI — le catalogue est lu dans le code de send-push : il ne peut pas mentir. Une sorte qui devrait
 *            partir et reste à zéro trahit un branchement cassé.
 * ATTENTION — lecture seule.
 */
import { dateCourte } from '@/shared/lib/dates'
import { heureDuFil } from '@/shared/lib/quand'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import { Tuile } from '@/shared/ui/Tuile'
import type { ChiffresSorte } from '../api/notifications'
import { useNotifications } from '../hooks/useNotifications'
import { catalogue, sorteDe, type Category, type SorteDeNotification } from '../lib/catalogue'
import styles from './Joueurs.module.css'

const GROUPES: { categorie: Category; titre: string; aide: string }[] = [
  { categorie: 'important', titre: 'Partent en push', aide: 'Suivent le réglage « Les nouvelles importantes » de chacun.' },
  { categorie: 'recap', titre: 'Partent en push, en récapitulatif', aide: 'Suivent le réglage « Le récit de la semaine ».' },
  { categorie: 'silent', titre: 'Ne partent pas', aide: 'Créées en base mais rangées silencieuses par send-push : pas de push, et la cloche seulement si cochée.' },
]

const nombre = new Intl.NumberFormat('fr-FR')
const total = (sortes: ChiffresSorte[], silencieuse: boolean) =>
  sortes.filter((s) => (sorteDe(s.type).categorie === 'silent') === silencieuse).reduce((t, s) => t + s.semaine, 0)

function Sorte({ sorte: s, chiffres: c, cloche }: { sorte: SorteDeNotification; chiffres: ChiffresSorte | undefined; cloche: boolean }) {
  return (
    <article className={styles.sorte}>
      <div className={styles.sorteTete}>
        <strong>{s.nom}</strong>
        <code>{s.type}</code>
      </div>
      <p className={styles.calme}>Quand : {s.quand}. Pour : {s.pour}.</p>
      {s.exemple ? (
        <div className={styles.bulle} aria-label="Le push tel qu’il arrive sur le téléphone">
          <strong>{s.exemple.title}</strong>
          <span>{s.exemple.body}</span>
        </div>
      ) : (
        <p className={styles.calme}>Aucun push.</p>
      )}
      <p className={styles.etiquettes}>
        <span>7 jours : {nombre.format(c?.semaine ?? 0)}</span>
        <span>30 jours : {nombre.format(c?.mois ?? 0)}</span>
        <span>Cloche : {cloche ? 'oui' : '—'}</span>
        <span>Dernière : {dateCourte(c?.derniere ?? null)}</span>
      </p>
      {s.categorie !== 'silent' && !c && <p className={styles.alerte}>Aucune en 30 jours : à vérifier.</p>}
    </article>
  )
}

export function Notifications() {
  const { data, error, isPending } = useNotifications()
  const valeur = (v: number | undefined) => (v === undefined ? (isPending ? '…' : '—') : nombre.format(v))
  const chiffres = new Map((data?.sortes ?? []).map((s) => [s.type, s]))
  const cloche = new Set([...(data?.cloche ?? []), ...(data?.sortes ?? []).filter((s) => s.cloche).map((s) => s.type)])
  const sortes = catalogue((data?.sortes ?? []).map((s) => s.type))

  return (
    <div className={styles.ecran}>
      <EnTeteDePage surtitre="Parler aux joueurs" titre="Notifications" phrase="Ce qui part, ce qui dort, et les 50 dernières." />
      {error && <p role="alert" className={styles.erreur}>Les notifications n’ont pas pu se charger : {error.message}</p>}
      <div className={styles.tuiles}>
        <Tuile libelle="téléphones abonnés au push" valeur={valeur(data?.abonnes)} />
        <Tuile libelle="qui partent, ces 7 jours" valeur={valeur(data && total(data.sortes, false))} />
        <Tuile libelle="créées sans partir" valeur={valeur(data && total(data.sortes, true))} />
      </div>
      {data && GROUPES.map((g) => {
        const lignes = sortes
          .filter((s) => s.categorie === g.categorie)
          .sort((a, b) => (chiffres.get(b.type)?.mois ?? 0) - (chiffres.get(a.type)?.mois ?? 0))
        if (lignes.length === 0) return null
        return (
          <section key={g.categorie} className={styles.section} aria-label={g.titre}>
            <TitreDeSection titre={`${g.titre} · ${String(lignes.length)}`} />
            <p className={styles.calme}>{g.aide}</p>
            <Bloc>
              {lignes.map((s) => <Sorte key={s.type} sorte={s} chiffres={chiffres.get(s.type)} cloche={cloche.has(s.type)} />)}
            </Bloc>
          </section>
        )
      })}
      {data && (
        <section className={styles.section} aria-label="Les 50 dernières">
          <TitreDeSection titre="Les 50 dernières qui sont parties" />
          <p className={styles.calme}>Tous les Explorateurs confondus, la plus récente en haut ; les silencieuses n’y figurent pas.</p>
          <Bloc>
            {data.fil.map((n) => (
              <p key={n.id} className={styles.ligneDuFil}>
                <span>{heureDuFil(n.quand)}</span>
                <strong>{sorteDe(n.type).nom}</strong>
                <span>
                  {n.qui ? `${n.qui} → ` : ''}{n.pour ?? 'compte effacé'}{n.sur ? ` · ${n.sur}` : ''}
                </span>
                <span>{n.lu ? 'lue' : 'non lue'}</span>
              </p>
            ))}
          </Bloc>
        </section>
      )}
    </div>
  )
}
