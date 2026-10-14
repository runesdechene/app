/**
 * QUOI     — « Le fil d'activité » (maquette 592:852) : filtres par type, une ligne par geste
 *            (heure, type, portrait, qui et quoi, détail réservé à l'équipe, département), et
 *            « Voir tout le fil ».
 * POURQUOI — le filtre est dans l'adresse (?fil=lieu) : tout état navigable est une URL.
 */
import { useSearchParams } from 'react-router'
import sectionChemins from '@/assets/ui/section-chemins.svg'
import { Balise } from '@/shared/ui/Balise'
import { Bloc } from '@/shared/ui/Bloc'
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import type { TypeActivite } from '../api/fil'
import { useFil } from '../hooks/useFil'
import { phraseDuFil } from '../lib/phraseDuFil'
import styles from './FilDActivite.module.css'

type Filtre = 'tout' | TypeActivite
const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: 'tout', libelle: 'Tout' }, { valeur: 'compte', libelle: 'Comptes' }, { valeur: 'lieu', libelle: 'Lieux' },
  { valeur: 'visite', libelle: 'Visites' }, { valeur: 'enigme', libelle: 'Énigmes' }, { valeur: 'boutique', libelle: 'Boutique' },
  { valeur: 'photo', libelle: 'Photos' }, { valeur: 'message', libelle: 'Messages' }, { valeur: 'moderation', libelle: 'Modération' },
  { valeur: 'notification', libelle: 'Notifications' },
]
const LIBELLES: Record<TypeActivite, string> = {
  compte: 'Compte', lieu: 'Lieu', visite: 'Visite', enigme: 'Énigme', boutique: 'Boutique',
  photo: 'Photo', message: 'Message', moderation: 'Modération', notification: 'Notification',
}
const heure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

export function FilDActivite() {
  const [params, setParams] = useSearchParams()
  const brut = params.get('fil')
  const filtre: Filtre = FILTRES.find((f) => f.valeur === brut)?.valeur ?? 'tout'
  const { activites, voirPlus, aDAutres, isError } = useFil(filtre === 'tout' ? [] : [filtre])

  function choisir(f: Filtre) {
    const suivants = new URLSearchParams(params)
    if (f === 'tout') suivants.delete('fil')
    else suivants.set('fil', f)
    setParams(suivants)
  }

  return (
    <section className={styles.fil}>
      <TitreDeSection titre="Le fil d’activité" icone={sectionChemins} aDroite={<span className={styles.direct}>En direct</span>} />
      <div className={styles.filtres}>
        <ChoixSegmente nom="Types" options={FILTRES} choisi={filtre} onChoix={choisir} />
      </div>
      {isError && <p className={styles.vide}>Le fil ne répond pas.</p>}
      <Bloc>
        {activites.map((a) => {
          const { titre, detail } = phraseDuFil(a)
          return (
            <div key={a.cle} className={styles.ligne}>
              <span className={styles.heure}>{heure.format(new Date(a.quand))}</span>
              <span className={styles.type}><Balise texte={LIBELLES[a.type]} teinte={a.type} /></span>
              {a.qui?.avatar ? <img className={styles.portrait} src={a.qui.avatar} alt="" loading="lazy" /> : <span className={styles.portrait} />}
              <span className={styles.texte}>
                <span className={styles.titre}>{titre}</span>
                <span className={styles.detail}>{detail}</span>
              </span>
              <span className={styles.ou}>{a.lieu?.departement ?? ''}</span>
            </div>
          )
        })}
        {aDAutres && (
          <button className={styles.plus} type="button" onClick={voirPlus}>
            Voir tout le fil →
          </button>
        )}
      </Bloc>
    </section>
  )
}
