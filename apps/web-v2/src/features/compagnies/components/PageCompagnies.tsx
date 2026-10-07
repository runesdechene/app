/**
 * QUOI     — la page « Les Compagnies » (maquette 396:236) : une recherche, mes Compagnies, Découvrir
 *            (la devise, les lieux et les membres, « Privée », Rejoindre ou Demander), et « Fonder une
 *            Compagnie ». Rangées par lieux revendiqués, sans rang (Uriel, 07/10, migration 439).
 * POURQUOI — des antennes locales qu'on rejoint à volonté (Uriel, 05/10). Rejoindre est ouvert à
 *            tous ; fonder, aux Porteurs — « Fonder » mène quand même chacun à son écran, qui dit
 *            pourquoi à qui ne l'est pas.
 */
import { useState } from 'react'
import { Link } from 'react-router'
import type { CarteCompagnie } from '../api/lireCompagnies'
import { useCompagnies } from '../hooks/useCompagnies'
import { correspond } from '../lib/chercher'
import { AvatarCompagnie } from './AvatarCompagnie'
import styles from './PageCompagnies.module.css'

// « 12 lieux · 35 membres » : l'activité d'abord, c'est elle qui range la liste.
function compteurs(c: CarteCompagnie) {
  const membres = `${String(c.membres)} membre${c.membres > 1 ? 's' : ''}`
  if (c.lieux === 0) return membres
  return `${String(c.lieux)} lieu${c.lieux > 1 ? 'x' : ''} · ${membres}`
}

export function PageCompagnies() {
  const { liste, erreur, rejoindre, enCours } = useCompagnies()
  const [recherche, setRecherche] = useState('')
  const garder = (c: CarteCompagnie) => correspond(c, recherche)

  return (
    <div className={styles.page}>
      <h2 className={styles.titre}>Les Compagnies</h2>
      <p className={styles.phrase}>
        Des antennes locales : rejoins celles de ta région, ou fonde la tienne.
      </p>
      <input
        type="search"
        className={styles.recherche}
        aria-label="Chercher une Compagnie"
        placeholder="Une Compagnie, une région…"
        value={recherche}
        onChange={(e) => {
          setRecherche(e.target.value)
        }}
      />
      {erreur && <p className={styles.alerte}>Les Compagnies n’ont pas pu être lues.</p>}

      {liste && liste.miennes.length > 0 && (
        <section aria-labelledby="miennes">
          <h3 id="miennes" className={styles.section}>
            Mes Compagnies
          </h3>
          <ul className={styles.liste}>
            {liste.miennes.filter(garder).map((c) => (
              <li key={c.id}>
                <Link className={styles.ligne} to={`/compagnies/compagnie/${c.id}`}>
                  <AvatarCompagnie nom={c.nom} avatar={c.avatar} couleur={c.couleur} taille={44} />
                  <span className={styles.texte}>
                    <span className={styles.nom}>{c.nom}</span>
                    <span className={styles.info}>{compteurs(c)}</span>
                  </span>
                  <span className={styles.chevron} aria-hidden="true">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {liste && (
        <section aria-labelledby="decouvrir">
          <h3 id="decouvrir" className={styles.section}>
            Découvrir
          </h3>
          {liste.autres.length === 0 && (
            <p className={styles.vide}>Aucune autre Compagnie pour l’instant.</p>
          )}
          <ul className={styles.liste}>
            {liste.autres.filter(garder).map((c) => (
              <li key={c.id} className={styles.ligne}>
                <Link className={styles.lien} to={`/compagnies/compagnie/${c.id}`}>
                  <AvatarCompagnie nom={c.nom} avatar={c.avatar} couleur={c.couleur} taille={44} />
                  <span className={styles.texte}>
                    <span className={styles.nom}>{c.nom}</span>
                    {c.devise && <span className={styles.devise}>{c.devise}</span>}
                    <span className={styles.info}>
                      {c.privee ? 'Privée · ' : ''}
                      {compteurs(c)}
                    </span>
                  </span>
                </Link>
                <BoutonEntrer
                  carte={c}
                  enCours={enCours === c.id}
                  onEntrer={() => {
                    rejoindre(c.id)
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link className={styles.fonder} to="/compagnies/compagnie/fonder">
        ＋ Fonder une Compagnie
      </Link>
      <p className={styles.note}>Fonder est réservé aux Porteurs. Rejoindre est ouvert à tous.</p>
    </div>
  )
}

// Rejoindre (publique), Demander (privée), ou la demande qui attend.
function BoutonEntrer({
  carte,
  enCours,
  onEntrer,
}: {
  carte: CarteCompagnie
  enCours: boolean
  onEntrer: () => void
}) {
  if (carte.demandee) {
    return (
      <button type="button" className={styles.entrer} disabled>
        Demande envoyée
      </button>
    )
  }
  return (
    <button
      type="button"
      className={styles.entrer}
      aria-label={`${carte.privee ? 'Demander à rejoindre' : 'Rejoindre'} ${carte.nom}`}
      disabled={enCours}
      onClick={onEntrer}
    >
      {carte.privee ? 'Demander' : 'Rejoindre'}
    </button>
  )
}
