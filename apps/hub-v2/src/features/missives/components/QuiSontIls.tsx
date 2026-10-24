/**
 * QUOI     — « Qui sont-ils ? » (maquette 771:2639) : ce que les réponses à « Dis-nous qui tu es » disent, pour tous,
 *            les prospects ou les porteurs — une barre par réponse, les dernières attentes, les anniversaires du mois.
 * POURQUOI — écrire des lettres qui leur ressemblent. Les chiffres sont comptés par la base (hub_qui_sont_ils).
 */
import { QUESTIONS, type Question } from '@runes/missives'
import { useQuery } from '@tanstack/react-query'
import { useState, type CSSProperties } from 'react'
import { dateCourte } from '@/shared/lib/dates'
import { Bloc } from '@/shared/ui/Bloc'
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import { lireQuiSontIls, type Segment } from '../api/portraits'
import commun from './Missives.module.css'
import styles from './QuiSontIls.module.css'

const SEGMENTS: { valeur: Segment; libelle: string }[] = [
  { valeur: 'tous', libelle: 'Tous' },
  { valeur: 'prospects', libelle: 'Prospects' },
  { valeur: 'porteurs', libelle: 'Porteurs' },
]

// Les questions telles que l'équipe les lit : à la troisième personne.
const TITRES: Record<Question, string> = {
  epoques: 'Quelle époque les appelle ?',
  decouverte: 'Comment ils t’ont découvert',
  amene: 'Ce qui les amène',
  plait: 'Ce qui leur plaît',
}

const nombre = new Intl.NumberFormat('fr-FR')

function moisEnCours(): string {
  const mois = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'Europe/Paris' }).format(new Date())
  return /^[aeiouéèêâô]/i.test(mois) ? `d’${mois}` : `de ${mois}`
}

function Barres({ q, compte }: { q: Question; compte: { cle: string; nombre: number }[] }) {
  const parCle = new Map(compte.map((c) => [c.cle, c.nombre]))
  const lignes = QUESTIONS[q].reponses
    .map(([cle, libelle]) => ({ cle, libelle, n: parCle.get(cle) ?? 0 }))
    .sort((a, b) => b.n - a.n)
  const max = Math.max(1, ...lignes.map((l) => l.n))
  return (
    <Bloc>
      <section aria-label={TITRES[q]} className={styles.question}>
        <TitreDeSection titre={TITRES[q]} />
        <ul className={styles.barres}>
          {lignes.map((l) => (
            <li key={l.cle} aria-label={`${l.libelle} : ${String(l.n)}`} className={styles.ligne}>
              <span className={styles.libelle}>{l.libelle}</span>
              <span className={styles.piste}><span className={styles.barre} style={{ '--part': `${String((l.n / max) * 100)}%` } as CSSProperties} /></span>
              <span className={styles.nombre}>{nombre.format(l.n)}</span>
            </li>
          ))}
        </ul>
      </section>
    </Bloc>
  )
}

export function QuiSontIls() {
  const [segment, setSegment] = useState<Segment>('tous')
  const { data, error } = useQuery({ queryKey: ['missives-qui-sont-ils', segment], queryFn: () => lireQuiSontIls(segment) })

  const phrase = data
    ? `${nombre.format(data.repondants)} ${data.repondants > 1 ? 'personnes ont' : 'personne a'} répondu à « Dis-nous qui tu es ». Ce qu’elles aiment, d’où elles viennent, ce qu’elles attendent.`
    : 'Ce que disent les réponses à « Dis-nous qui tu es ».'

  return (
    <div className={commun.ecran}>
      <EnTeteDePage surtitre="Missives" titre="Qui sont-ils ?" phrase={phrase} />
      <ChoixSegmente nom="Qui" options={SEGMENTS} choisi={segment} onChoix={setSegment} />
      {error && <p role="alert" className={commun.erreur}>Les réponses n’ont pas pu se charger : {error.message}</p>}

      {data?.repondants === 0 && (
        <Bloc>
          <p className={commun.calme}>
            Personne n’a encore répondu. Pour les inviter, mets <code>{'{questionnaire}'}</code> comme adresse d’un lien dans
            une Missive : chacun y recevra son lien. <code>{'{questionnaire}?epoque=celtes'}</code> coche déjà les Celtes.
          </p>
        </Bloc>
      )}

      {data && data.repondants > 0 && (
        <>
          <div className={styles.grille}>
            {(Object.keys(QUESTIONS) as Question[]).map((q) => <Barres key={q} q={q} compte={data.reponses[q] ?? []} />)}
          </div>

          <Bloc>
            <section aria-label="Ce qu’ils attendent" className={styles.question}>
              <TitreDeSection titre="Ce qu’ils attendent" />
              {data.attentes.length === 0 && <p className={commun.calme}>Personne n’a encore écrit ce qu’il attend.</p>}
              {data.attentes.map((a) => (
                <p key={a.id} className={commun.qui}>
                  <strong>« {a.texte} »</strong>
                  <span className={commun.detail}>{a.nom ?? 'Sans nom'} · {dateCourte(a.le)}</span>
                </p>
              ))}
            </section>
          </Bloc>
        </>
      )}

      {/* Les anniversaires viennent aussi du stand et de l'appli : ils se montrent même sans répondant. */}
      {data && (
        <Bloc>
          <section aria-label={`Anniversaires ${moisEnCours()}`} className={styles.question}>
            <TitreDeSection titre={`Anniversaires ${moisEnCours()}`} />
            {data.anniversaires_du_mois.length === 0 && <p className={commun.calme}>Aucun ce mois-ci.</p>}
            {data.anniversaires_du_mois.map((a) => (
              <p key={a.id} className={styles.anniversaire}>
                <span className={styles.jour}>{a.jour}</span>
                <span>{a.nom ?? 'Sans nom'}</span>
              </p>
            ))}
          </section>
        </Bloc>
      )}
    </div>
  )
}
