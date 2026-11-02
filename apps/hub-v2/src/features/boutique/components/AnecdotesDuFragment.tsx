/**
 * QUOI     — « Ses anecdotes » dans la fiche d'un Fragment : chaque anecdote avec sa rareté et le
 *            nombre d'Explorateurs qui l'ont trouvée, « Masquer » / « Montrer » ; en bas, l'ajout
 *            d'une anecdote (texte et rareté).
 * POURQUOI — au Codex, chaque scan du motif en révèle une ; la rare se fait attendre (tirage
 *            60 / 30 / 10, migration 579). Le Hub les écrit, comme les énigmes.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Bouton } from '@/shared/ui/Bouton'
import { ecrireAnecdote, lireAnecdotes, type Anecdote, type Rarete } from '../api/anecdotes'
import styles from './AnecdotesDuFragment.module.css'

const RARETES: { valeur: Rarete; nom: string }[] = [
  { valeur: 'commune', nom: 'Commune' },
  { valeur: 'peu_commune', nom: 'Peu commune' },
  { valeur: 'rare', nom: 'Rare' },
]
const nomDe = (r: Rarete) => RARETES.find((x) => x.valeur === r)?.nom ?? r

export function AnecdotesDuFragment({ fragment }: { fragment: number }) {
  const cle = ['hub-anecdotes', fragment]
  const client = useQueryClient()
  const { data, isError } = useQuery({ queryKey: cle, queryFn: () => lireAnecdotes(fragment) })
  const ecriture = useMutation({
    mutationFn: (a: Parameters<typeof ecrireAnecdote>[0]) => ecrireAnecdote(a),
    onSuccess: () => client.invalidateQueries({ queryKey: cle }),
  })
  const [texte, setTexte] = useState('')
  const [rarete, setRarete] = useState<Rarete>('commune')
  const [refus, setRefus] = useState<string | null>(null)

  function ajouter() {
    if (!texte.trim()) {
      setRefus('Écris l’anecdote avant de l’ajouter.')
      return
    }
    setRefus(null)
    ecriture.mutate(
      { id: null, fragment, texte: texte.trim(), rarete, visible: true },
      { onSuccess: () => { setTexte('') } },
    )
  }

  function basculer(a: Anecdote) {
    ecriture.mutate({ id: a.id, fragment, texte: a.texte, rarete: a.rarete, visible: !a.visible })
  }

  return (
    <div className={styles.anecdotes}>
      {isError && <p role="alert">Les anecdotes n’ont pas pu être lues.</p>}
      {data && data.length === 0 && <p className={styles.calme}>Aucune anecdote : un scan de ce motif n’en révèle encore aucune.</p>}
      {data && data.length > 0 && (
        <ul className={styles.liste}>
          {data.map((a) => (
            <li key={a.id} className={styles.anecdote} data-rarete={a.rarete} data-masquee={!a.visible || undefined}>
              <span className={styles.rarete}>{nomDe(a.rarete)}</span>
              <p className={styles.texte}>{a.texte}</p>
              <span className={styles.trouvee}>trouvée {a.trouvee} fois</span>
              <Bouton sorte="discret" disabled={ecriture.isPending} onClick={() => { basculer(a) }}>
                {a.visible ? 'Masquer' : 'Montrer'}
              </Bouton>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.ajout}>
        <label className={styles.champ}>Nouvelle anecdote
          <textarea rows={3} value={texte} onChange={(e) => { setTexte(e.target.value); setRefus(null) }} />
        </label>
        <fieldset className={styles.raretes}>
          <legend>Rareté</legend>
          {RARETES.map((r) => (
            <label key={r.valeur} className={styles.choix} data-rarete={r.valeur}>
              <input type="radio" name={`rarete-${String(fragment)}`} checked={rarete === r.valeur} onChange={() => { setRarete(r.valeur) }} />
              {r.nom}
            </label>
          ))}
        </fieldset>
        <Bouton sorte="secondaire" disabled={ecriture.isPending} onClick={ajouter}>Ajouter l’anecdote</Bouton>
        {(refus ?? (ecriture.isError ? ecriture.error.message : null)) && <p className={styles.alerte} role="alert">{refus ?? ecriture.error?.message}</p>}
      </div>
    </div>
  )
}
