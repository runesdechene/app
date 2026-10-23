/**
 * QUOI     — « Envois » : une ligne par Missive, la plus récente en tête — son objet, sa liste, son état, et
 *            ce qu'il en est advenu (envoyés, échecs, ouverts, clics). Au style du tableau de Comptes.
 * POURQUOI — un brouillon ou une Missive programmée se rouvre dans « Écrire » ; une Missive partie ne
 *            change plus.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { lireEnvois, type Envoi } from '../api/envois'
import { LISTES } from '../lib/listes'
import styles from './Missives.module.css'

const nombre = new Intl.NumberFormat('fr-FR')
const jour = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })
const heures = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', minute: 'numeric', timeZone: 'Europe/Paris' })

/** « le 7 décembre, 18 h », ou « 18 h 30 » quand les minutes comptent. */
function moment(iso: string): string {
  const date = new Date(iso)
  const [h = '', m = '00'] = heures.format(date).split(':')
  return `le ${jour.format(date)}, ${h} h${m === '00' ? '' : ` ${m}`}`
}

function etat(e: Envoi): string {
  if (e.statut === 'programmee') return `Programmée pour ${moment(e.date)}`
  if (e.statut === 'en_cours') return 'En route'
  if (e.statut === 'envoyee') return `Partie ${moment(e.date)}`
  return `Brouillon du ${jour.format(new Date(e.date))}`
}

// « 40 · 50 % » : les ouvertures, et leur part des envoyés.
function part(n: number, sur: number): string {
  return sur === 0 ? '—' : `${nombre.format(n)} · ${String(Math.round((n / sur) * 100))} %`
}

export function Envois() {
  const { data, error } = useQuery({ queryKey: ['missives-envois'], queryFn: lireEnvois })

  return (
    <div className={styles.ecran}>
      <EnTeteDePage surtitre="Missives" titre="Les envois" phrase="Ce qui est parti, ce qui attend son heure, et les brouillons." />
      {error && <p role="alert" className={styles.erreur}>Les envois n’ont pas pu se charger : {error.message}</p>}
      {data?.length === 0 && <p className={styles.calme}>Aucune Missive encore. <Link to="/missives/ecrire">Écrire la première</Link></p>}
      {data && data.length > 0 && (
        <Bloc className={styles.defile ?? ''}>
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th scope="col">Objet</th>
                <th scope="col">Liste</th>
                <th scope="col">État</th>
                <th scope="col">Envoyés</th>
                <th scope="col">Échecs</th>
                <th scope="col">Ouverts</th>
                <th scope="col">Clics</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <th scope="row">
                    {e.statut === 'brouillon' || e.statut === 'programmee' ? (
                      <Link to={`/missives/ecrire/${String(e.id)}`}>{e.objet || 'Sans objet'}</Link>
                    ) : (
                      e.objet
                    )}
                  </th>
                  <td>{e.liste ? LISTES[e.liste].nom : '—'}</td>
                  <td>{etat(e)}</td>
                  <td>{nombre.format(e.envoyes)}</td>
                  <td>{nombre.format(e.echecs)}</td>
                  <td>{part(e.ouverts, e.envoyes)}</td>
                  <td>{part(e.clics, e.envoyes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Bloc>
      )}
    </div>
  )
}
