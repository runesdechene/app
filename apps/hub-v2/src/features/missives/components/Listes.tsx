/**
 * QUOI     — « Les listes » (maquette 713:2091) : les cinq listes des Missives, combien de personnes et
 *            combien acceptent les nouvelles, le dernier envoi ; puis les ambassadeurs et égéries.
 * POURQUOI — les listes se tiennent seules, d'après la fiche de chacun (hub_listes). Seuls les
 *            ambassadeurs se choisissent : on cherche un compte, on lui donne un rôle, on le retire.
 */
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { dateCourte } from '@/shared/lib/dates'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { Bouton } from '@/shared/ui/Bouton'
import { ChampDeRecherche } from '@/shared/ui/ChampDeRecherche'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import { chercherComptes, type Ambassadeur, type LigneDeListe } from '../api/listes'
import { useAmbassadeurs, useListes } from '../hooks/useListes'
import { LISTES, ROLES } from '../lib/listes'
import styles from './Missives.module.css'

const nombre = new Intl.NumberFormat('fr-FR')

function Tableau({ lignes }: { lignes: LigneDeListe[] }) {
  return (
    <Bloc className={styles.defile ?? ''}>
      <table className={styles.tableau}>
        <thead>
          <tr>
            <th scope="col">Liste</th>
            <th scope="col">Qui y entre</th>
            <th scope="col">Personnes</th>
            <th scope="col">Acceptent les nouvelles</th>
            <th scope="col">Dernier envoi</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={l.cle}>
              <th scope="row">{LISTES[l.cle].nom}</th>
              <td>{LISTES[l.cle].regle}</td>
              <td>{nombre.format(l.personnes)}</td>
              <td>{nombre.format(l.avecAccord)}</td>
              <td>{l.dernier ? `« ${l.dernier.objet} » · ${dateCourte(l.dernier.le)}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Bloc>
  )
}

function Portrait({ avatar }: { avatar: string | null }) {
  return avatar ? <img className={styles.portrait} src={avatar} alt="" /> : <span className={styles.portrait} />
}

function Ambassadeurs() {
  const { ambassadeurs, nommer, retirer } = useAmbassadeurs()
  const [recherche, setRecherche] = useState('')
  const trouves = useQuery({
    queryKey: ['missives-chercher-compte', recherche],
    queryFn: () => chercherComptes(recherche),
    enabled: recherche.trim().length >= 2,
  })
  const deja = new Set((ambassadeurs.data ?? []).map((a) => a.id))
  const proposes = (trouves.data ?? []).filter((c) => !deja.has(c.id))

  return (
    <Bloc>
      <div className={styles.entete}>
        <TitreDeSection titre="Ambassadeurs et égéries" />
        <ChampDeRecherche valeur={recherche} onChange={setRecherche} etiquette="Ajouter : un nom, un e-mail…" />
      </div>
      {proposes.length > 0 && (
        <ul className={styles.personnes} aria-label="Comptes trouvés">
          {proposes.map((c) => (
            <li key={c.id} aria-label={c.nom} className={styles.personne}>
              <Portrait avatar={c.avatar} />
              <span className={styles.qui}>
                <strong>{c.nom}</strong>
                <span className={styles.detail}>{c.email ?? 'sans e-mail'}</span>
              </span>
              <Bouton sorte="discret" onClick={() => { nommer.mutate({ id: c.id, role: 'ambassadeur' }) }}>Ambassadeur</Bouton>
              <Bouton sorte="discret" onClick={() => { nommer.mutate({ id: c.id, role: 'egerie' }) }}>Égérie</Bouton>
            </li>
          ))}
        </ul>
      )}
      <ul className={styles.personnes} aria-label="Ambassadeurs et égéries">
        {(ambassadeurs.data ?? []).map((a: Ambassadeur) => (
          <li key={a.id} aria-label={a.nom} className={styles.personne}>
            <Portrait avatar={a.avatar} />
            <span className={styles.qui}>
              <span>
                <strong>{a.nom}</strong> <Balise texte={ROLES[a.role]} teinte="porteur" />
              </span>
              <span className={styles.detail}>
                {ROLES[a.role]} · {a.fragments} Fragment{a.fragments > 1 ? 's' : ''}
              </span>
            </span>
            <Bouton sorte="discret" onClick={() => { retirer.mutate(a.id) }}>Retirer</Bouton>
          </li>
        ))}
        {ambassadeurs.data?.length === 0 && (
          <li className={styles.calme}>Personne encore. Cherche un compte pour le nommer ambassadeur ou égérie.</li>
        )}
      </ul>
    </Bloc>
  )
}

export function Listes() {
  const { data, error } = useListes()
  return (
    <div className={styles.ecran}>
      <EnTeteDePage
        surtitre="Missives"
        titre="Les listes"
        phrase="Elles se tiennent seules, d’après la fiche de chacun. Sauf les Ambassadeurs : c’est toi qui les choisis."
      />
      {error && <p role="alert" className={styles.erreur}>Les listes n’ont pas pu se charger : {error.message}</p>}
      {data && <Tableau lignes={data} />}
      <Ambassadeurs />
    </div>
  )
}
