/**
 * QUOI     — « Automatisations » (maquette 766:2584) : les trois suites, leur état, qui y entre, leurs chiffres,
 *            et leurs e-mails jour par jour. On active ou met en pause, on change un jour, on ajoute un e-mail.
 * POURQUOI — qui entre dans quelle suite se règle dans la base (mig 549) ; ici, seulement le contenu et le rythme.
 *            Un e-mail de suite s'écrit dans Écrire, comme une Missive.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { Bouton } from '@/shared/ui/Bouton'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { CleSuite, Etape, Suite } from '../api/suites'
import { useSuites } from '../hooks/useSuites'
import styles from './Automatisations.module.css'
import commun from './Missives.module.css'

const nombre = new Intl.NumberFormat('fr-FR')

const QUI_Y_ENTRE: Record<CleSuite, string> = {
  bienvenue: 'Inscrits au flyer, sur le site ou dans l’appli, sans achat · accord aux nouvelles requis',
  stand: 'Comptes créés au stand · clients : part sauf désabonnement',
  apres_achat: 'Première commande en ligne · arrête la Bienvenue · clients : part sauf désabonnement',
}

const part = (n: number, sur: number) => `${String(sur === 0 ? 0 : Math.round((n / sur) * 100))} %`

function chiffres(s: Suite): string {
  if (!s.active && s.enCours === 0) return 'Personne en route : la suite est en pause'
  const morceaux = [`${nombre.format(s.enCours)} en cours`, `${nombre.format(s.finis)} finis`]
  if (s.arretes > 0) morceaux.push(`${nombre.format(s.arretes)} arrêtés par un achat`)
  return morceaux.join(' · ')
}

function statistiques(e: Etape): string {
  if (e.envoyes === 0) return 'pas encore parti'
  return `${nombre.format(e.envoyes)} envoyés · ${part(e.ouverts, e.envoyes)} ouverts · ${part(e.clics, e.envoyes)} clics`
}

/** Le jour d'un e-mail, ou le champ qui le change. Entrée valide, Échap renonce. */
function ChampJour({ depart, onValider, onRenoncer }: { depart: number; onValider: (jour: number) => void; onRenoncer: () => void }) {
  const [valeur, setValeur] = useState(String(depart))
  const valider = () => {
    const jour = Number(valeur)
    if (Number.isInteger(jour) && jour >= 0) onValider(jour)
    else onRenoncer()
  }
  return (
    <input
      className={styles.champJour}
      type="number"
      min={0}
      step={1}
      aria-label="Jour"
      autoFocus
      value={valeur}
      onChange={(e) => { setValeur(e.target.value) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') valider()
        if (e.key === 'Escape') onRenoncer()
      }}
      onBlur={onRenoncer}
    />
  )
}

function UneSuite({ s }: { s: Suite }) {
  const { activer, ajouter, regler } = useSuites()
  const navigate = useNavigate()
  const [enReglage, setEnReglage] = useState<number | null>(null)
  const [ajout, setAjout] = useState<string | null>(null)
  // Les gestes sont partagés entre les suites : chacune ne montre que l'erreur des siens.
  const erreur = [activer, ajouter, regler].find((m) => m.error && m.variables.cle === s.cle)?.error
  const dernier = s.etapes.at(-1)?.jour

  return (
    <Bloc>
      <section aria-label={s.nom} className={styles.suite}>
        <TitreDeSection
          titre={s.nom}
          aDroite={
            <span className={styles.etat}>
              <Balise texte={s.active ? 'Active' : 'En pause'} teinte={s.active ? 'actif' : 'pause'} />
              <Bouton sorte="discret" disabled={activer.isPending} onClick={() => { activer.mutate({ cle: s.cle, active: !s.active }) }}>
                {s.active ? 'Mettre en pause' : 'Activer'}
              </Bouton>
            </span>
          }
        />
        <p className={commun.detail}>{QUI_Y_ENTRE[s.cle]}</p>
        <p className={styles.chiffres}>{chiffres(s)}</p>
        {erreur && <p role="alert" className={commun.erreur}>{erreur.message}</p>}

        <ul className={commun.personnes} aria-label={`Les e-mails de ${s.nom}`}>
          {s.etapes.map((e) => (
            <li key={e.id} className={commun.personne}>
              {enReglage === e.id ? (
                <ChampJour
                  depart={e.jour}
                  onValider={(jour) => {
                    setEnReglage(null)
                    if (jour !== e.jour) regler.mutate({ id: e.id, jour, cle: s.cle })
                  }}
                  onRenoncer={() => { setEnReglage(null) }}
                />
              ) : (
                <button type="button" className={styles.jour} onClick={() => { setEnReglage(e.id) }}>
                  Jour {e.jour}
                </button>
              )}
              <span className={commun.qui}>
                <strong>{e.objet || 'Sans objet'}</strong>
                <span className={commun.detail}>{statistiques(e)}</span>
              </span>
              <Link className={styles.lien} to={`/missives/ecrire/${String(e.missiveId)}`}>Écrire</Link>
            </li>
          ))}
        </ul>

        {ajout === null ? (
          <div className={styles.ajout}>
            <Bouton sorte="discret" onClick={() => { setAjout(String(dernier === undefined ? 0 : dernier + 3)) }}>
              + Ajouter un e-mail
            </Bouton>
          </div>
        ) : (
          <form
            className={styles.ajout}
            onSubmit={(ev) => {
              ev.preventDefault()
              ajouter.mutate(
                { cle: s.cle, jour: Number(ajout) },
                { onSuccess: (id) => { void navigate(`/missives/ecrire/${String(id)}`) } },
              )
            }}
          >
            <label className={styles.etiquette}>
              Jour
              <input className={styles.champJour} type="number" min={0} step={1} required value={ajout} onChange={(ev) => { setAjout(ev.target.value) }} />
            </label>
            <button type="submit" className={styles.lien} disabled={ajouter.isPending}>Ajouter</button>
            <Bouton sorte="discret" onClick={() => { setAjout(null) }}>Annuler</Bouton>
          </form>
        )}
      </section>
    </Bloc>
  )
}

export function Automatisations() {
  const { suites } = useSuites()
  return (
    <div className={commun.ecran}>
      <EnTeteDePage
        surtitre="Missives"
        titre="Automatisations"
        phrase="Chaque suite accueille seule ceux qui arrivent. Tu écris ses e-mails, tu règles leurs jours, tu l’actives quand elle est prête."
      />
      {suites.error && <p role="alert" className={commun.erreur}>Les suites n’ont pas pu se charger : {suites.error.message}</p>}
      {suites.data?.map((s) => <UneSuite key={s.cle} s={s} />)}
    </div>
  )
}
