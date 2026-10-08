/**
 * QUOI     — l'écran « Notifications » : ce qui part vraiment. Trois chiffres en tête (téléphones
 *            abonnés, push partis en 7 jours, notifications créées sans partir), le catalogue de
 *            chaque sorte (déclencheur, destinataire, cloche, push et la bulle telle qu'elle arrive
 *            sur le téléphone, avec ses chiffres sur 7 et 30 jours), puis le fil des 50 dernières.
 * POURQUOI — Uriel, 08/10 : « une page où on peut voir toutes les notifications ». Le catalogue est
 *            lu dans le code de send-push (lib/catalogueNotifications.ts) : il ne peut pas mentir.
 *            Une sorte qui devrait partir et reste à zéro trahit un branchement cassé.
 * ATTENTION — lecture seule, par la RPC `notifications_du_hub` (admins, mig 465).
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { catalogue, sorteDe, typesConnus, type Category, type SorteDeNotification } from '../../lib/catalogueNotifications'
import './Notifications.css'

interface ChiffresSorte {
  type: string
  semaine: number
  mois: number
  derniere: string
  cloche: boolean
}

interface LigneDuFil {
  id: number
  type: string
  quand: string
  lu: boolean
  pour: string | null
  qui: string | null
  sur: string | null
}

interface DonneesDuHub {
  abonnes: number
  cloche: string[] // les sortes du catalogue que la cloche de l'app montre
  sortes: ChiffresSorte[]
  fil: LigneDuFil[]
}

const GROUPES: { categorie: Category; titre: string; aide: string }[] = [
  { categorie: 'important', titre: 'Partent en push', aide: 'Suivent le réglage « Les nouvelles importantes » de chacun.' },
  { categorie: 'recap', titre: 'Partent en push, en récapitulatif', aide: 'Suivent le réglage « Le récit de la semaine ».' },
  { categorie: 'silent', titre: 'Ne partent pas', aide: 'Créées en base mais rangées silencieuses par send-push : ni push, et la cloche seulement si cochée.' },
]

const nombre = new Intl.NumberFormat('fr-FR')
const date = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export function Notifications() {
  const [donnees, setDonnees] = useState<DonneesDuHub | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    setLoading(true)
    setErreur(null)
    try {
      const { data, error } = await supabase.rpc('notifications_du_hub', { p_types: typesConnus() })
      if (error) throw error
      setDonnees(data as DonneesDuHub)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : JSON.stringify(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
  }, [])

  if (loading && !donnees) return <div className="loading">Chargement…</div>
  if (erreur) return <div className="section"><p className="notif-erreur">Les notifications n’ont pas pu se charger : {erreur}</p></div>
  if (!donnees) return null

  const chiffres = new Map(donnees.sortes.map((s) => [s.type, s]))
  const cloche = new Set([...donnees.cloche, ...donnees.sortes.filter((s) => s.cloche).map((s) => s.type)])
  const sortes = catalogue(donnees.sortes.map((s) => s.type))
  const partisSemaine = donnees.sortes
    .filter((s) => sorteDe(s.type).categorie !== 'silent')
    .reduce((t, s) => t + s.semaine, 0)
  const silencieusesSemaine = donnees.sortes
    .filter((s) => sorteDe(s.type).categorie === 'silent')
    .reduce((t, s) => t + s.semaine, 0)

  return (
    <div className="section notif">
      <div className="page-header"><h1>Notifications</h1></div>

      <div className="notif-chiffres">
        <div className="notif-chiffre">
          <span className="notif-chiffre-valeur">{nombre.format(donnees.abonnes)}</span>
          <span className="notif-chiffre-libelle">téléphones abonnés au push</span>
        </div>
        <div className="notif-chiffre">
          <span className="notif-chiffre-valeur">{nombre.format(partisSemaine)}</span>
          <span className="notif-chiffre-libelle">notifications qui partent, ces 7 jours</span>
        </div>
        <div className="notif-chiffre notif-chiffre--sourd">
          <span className="notif-chiffre-valeur">{nombre.format(silencieusesSemaine)}</span>
          <span className="notif-chiffre-libelle">créées sans partir, ces 7 jours</span>
        </div>
      </div>

      {GROUPES.map((g) => {
        const lignes = sortes
          .filter((s) => s.categorie === g.categorie)
          .sort((a, b) => (chiffres.get(b.type)?.mois ?? 0) - (chiffres.get(a.type)?.mois ?? 0))
        if (lignes.length === 0) return null
        return (
          <section key={g.categorie} className="notif-groupe">
            <h2>{g.titre} <span className="notif-compte">{lignes.length}</span></h2>
            <p className="notif-aide">{g.aide}</p>
            <div className="notif-sortes">
              {lignes.map((s) => <Sorte key={s.type} sorte={s} chiffres={chiffres.get(s.type)} cloche={cloche.has(s.type)} />)}
            </div>
          </section>
        )
      })}

      <section className="notif-groupe">
        <h2>Les 50 dernières</h2>
        <p className="notif-aide">Tous les Explorateurs confondus, la plus récente en haut.</p>
        <ol className="notif-fil">
          {donnees.fil.map((n) => (
            <li key={n.id} className={sorteDe(n.type).categorie === 'silent' ? 'notif-fil-ligne notif-fil-ligne--sourde' : 'notif-fil-ligne'}>
              <span className="notif-fil-quand">{date(n.quand)}</span>
              <span className="notif-fil-nom">{sorteDe(n.type).nom}</span>
              <span className="notif-fil-detail">
                {n.qui ? <strong>{n.qui}</strong> : null}
                {n.qui ? ' → ' : ''}
                {n.pour ?? 'compte effacé'}
                {n.sur ? <em> · {n.sur}</em> : null}
              </span>
              <span className="notif-fil-lu">{n.lu ? 'lue' : 'non lue'}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}

function Sorte({ sorte: s, chiffres: c, cloche }: { sorte: SorteDeNotification; chiffres: ChiffresSorte | undefined; cloche: boolean }) {
  const muette = s.categorie !== 'silent' && !c
  return (
    <article className="notif-sorte">
      <div className="notif-sorte-tete">
        <h3>{s.nom}</h3>
        <code>{s.type}</code>
      </div>
      <p className="notif-sorte-quand">Quand {s.quand}.</p>
      <p className="notif-sorte-pour">Pour {s.pour}.</p>
      {s.exemple ? (
        <div className="notif-bulle" aria-label="Le push tel qu’il arrive sur le téléphone">
          <span className="notif-bulle-app">Explore · maintenant</span>
          <strong>{s.exemple.title}</strong>
          <span>{s.exemple.body}</span>
        </div>
      ) : (
        <p className="notif-sans-push">Aucun push.</p>
      )}
      <dl className="notif-sorte-chiffres">
        <div><dt>7 jours</dt><dd>{nombre.format(c?.semaine ?? 0)}</dd></div>
        <div><dt>30 jours</dt><dd>{nombre.format(c?.mois ?? 0)}</dd></div>
        <div><dt>Cloche</dt><dd>{cloche ? 'oui' : '—'}</dd></div>
        <div><dt>Dernière</dt><dd>{c ? date(c.derniere) : 'jamais'}</dd></div>
      </dl>
      {muette && <p className="notif-alerte">Aucune en 30 jours : à vérifier.</p>}
    </article>
  )
}
