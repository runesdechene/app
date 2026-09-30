/**
 * QUOI     — « Un lieu, un Explorateur… » : chercher un lieu par son nom parmi ceux déjà chargés,
 *            et y aller (maquette 162:107, calques 165:128) ; et, pour qui a un compte, les
 *            Explorateurs dont le nom commence ainsi — les toucher ouvre leur profil.
 * POURQUOI — les lieux sont déjà là : pas de requête pour eux. Les accents et la casse ne comptent
 *            pas (« eglise » trouve « Église »). Les membres, eux, se demandent à la base (Uriel,
 *            30/09 : « on n'arrive pas à trouver les membres »). Les villes viendront avec le
 *            géocodage (plan 2).
 */
import { useState } from 'react'
import { Link } from 'react-router'
import loupe from '@/assets/ui/loupe.svg'
import { Avatar } from '@/shared/ui/Avatar'
import type { LieuCarte } from '../api/lireCarte'
import { useExplorateurs } from '../hooks/useExplorateurs'
import styles from './Recherche.module.css'

const MAX_RESULTATS = 10

const simplifier = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()

export function Recherche({
  lieux,
  onAller,
  membres = false,
}: {
  lieux: LieuCarte[]
  onAller: (point: { lat: number; lng: number }) => void
  // Chercher aussi les Explorateurs (seulement avec un compte).
  membres?: boolean
}) {
  const [texte, setTexte] = useState('')
  const explorateurs = useExplorateurs(texte, membres)
  const invite = membres ? 'Un lieu, un Explorateur…' : 'Un lieu, une ville…'
  const cherche = simplifier(texte.trim())
  const resultats =
    cherche === ''
      ? []
      : lieux.filter((l) => simplifier(l.nom).includes(cherche)).slice(0, MAX_RESULTATS)

  return (
    <div className={styles.recherche}>
      <label className={styles.champ}>
        <img className={styles.loupe} src={loupe} alt="" />
        <input
          type="search"
          className={styles.saisie}
          placeholder={invite}
          aria-label={invite}
          value={texte}
          onChange={(e) => {
            setTexte(e.target.value)
          }}
        />
      </label>
      {(resultats.length > 0 || explorateurs.length > 0) && (
        <div className={styles.resultats}>
          {resultats.length > 0 && (
            <div role="listbox" aria-label="Lieux trouvés" className={styles.liste}>
              {resultats.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  role="option"
                  aria-selected="false"
                  className={styles.resultat}
                  onClick={() => {
                    setTexte('')
                    onAller({ lat: l.lat, lng: l.lng })
                  }}
                >
                  {l.nom}
                </button>
              ))}
            </div>
          )}
          {explorateurs.length > 0 && (
            <ul aria-label="Explorateurs trouvés" className={styles.liste}>
              {explorateurs.map((e) => (
                <li key={e.id}>
                  <Link
                    className={styles.resultat}
                    to={`/carte/explorateur/${e.id}`}
                    onClick={() => {
                      setTexte('')
                    }}
                  >
                    <Avatar url={e.avatar} nom={e.nom} taille="mini" />
                    {e.nom}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
