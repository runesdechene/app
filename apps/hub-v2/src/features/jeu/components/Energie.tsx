/**
 * QUOI     — « L'Énergie » : la jauge des joueurs et le prix d'une découverte selon la distance. Dix champs
 *            numériques, la règle redessinée à mesure qu'on les change, un seul bouton « Enregistrer ».
 * POURQUOI — rien n'est écrit tant qu'une règle est cassée (paliers qui ne croissent pas, prix qui baissent,
 *            moins de 10 minutes par point) : le message dit laquelle. La base relit ces réglages à chaque calcul.
 */
import { useState, type SyntheticEvent } from 'react'
import { pluriel } from '@/shared/lib/texte'
import { Bloc } from '@/shared/ui/Bloc'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { TitreDeSection } from '@/shared/ui/TitreDeSection'
import { useEcritureEnergie, useReglagesEnergie } from '../hooks/useEnergie'
import { depuisLignes, erreurReglages, resume, versLignes, type Reglages } from '../lib/energie'
import styles from './Jeu.module.css'
import energie from './Energie.module.css'

type Saisie = Record<keyof Reglages, string>

const POINTS_MONTRES = 30

const LA_JAUGE: [keyof Reglages, string][] = [
  ['maxSansFragment', 'Points sans Fragment'],
  ['minutesParPoint', 'Minutes par point'],
]
const LE_PRIX: [keyof Reglages, string][] = [
  ['gratuitKm', 'Gratuit jusqu’à (km)'],
  ['palier1Km', 'Palier 1 (km)'],
  ['palier2Km', 'Palier 2 (km)'],
  ['palier3Km', 'Palier 3 (km)'],
  ['cout1', 'Prix jusqu’au palier 1'],
  ['cout2', 'Prix jusqu’au palier 2'],
  ['cout3', 'Prix jusqu’au palier 3'],
  ['cout4', 'Prix au-delà'],
]

const enTexte = (r: Reglages): Saisie => ({
  maxSansFragment: String(r.maxSansFragment), minutesParPoint: String(r.minutesParPoint),
  gratuitKm: String(r.gratuitKm), palier1Km: String(r.palier1Km), palier2Km: String(r.palier2Km), palier3Km: String(r.palier3Km),
  cout1: String(r.cout1), cout2: String(r.cout2), cout3: String(r.cout3), cout4: String(r.cout4),
})

// Un champ vide devient NaN : erreurReglages le refuse.
const nombre = (texte: string) => (texte.trim() === '' ? Number.NaN : Number(texte))

const enNombres = (s: Saisie): Reglages => ({
  maxSansFragment: nombre(s.maxSansFragment), minutesParPoint: nombre(s.minutesParPoint),
  gratuitKm: nombre(s.gratuitKm), palier1Km: nombre(s.palier1Km), palier2Km: nombre(s.palier2Km), palier3Km: nombre(s.palier3Km),
  cout1: nombre(s.cout1), cout2: nombre(s.cout2), cout3: nombre(s.cout3), cout4: nombre(s.cout4),
})

const prix = (n: number) => (n === 0 ? 'Gratuit' : `${String(n)} ${pluriel(n, 'point')}`)

function RegleRedessinee({ r }: { r: Reglages }) {
  const segments = [
    { de: 0, a: r.gratuitKm, prix: 'Gratuit' },
    { de: r.gratuitKm, a: r.palier1Km, prix: prix(r.cout1) },
    { de: r.palier1Km, a: r.palier2Km, prix: prix(r.cout2) },
    { de: r.palier2Km, a: r.palier3Km, prix: prix(r.cout3) },
    { de: r.palier3Km, a: null, prix: prix(r.cout4) },
  ]
  const pleins = Number.isFinite(r.maxSansFragment) ? Math.max(0, Math.min(r.maxSansFragment, POINTS_MONTRES)) : 0
  return (
    <div className={energie.regle}>
      <p className={energie.legende}>Le prix d’une découverte selon la distance</p>
      <ul className={energie.segments}>
        {segments.map((s, i) => (
          <li key={i} className={energie.segment}>
            <span>{s.a === null ? `Au-delà de ${String(s.de)} km` : `${String(s.de)} à ${String(s.a)} km`}</span>
            <strong>{s.prix}</strong>
          </li>
        ))}
      </ul>
      <p className={energie.legende}>La jauge d’un joueur : {pleins} sur {POINTS_MONTRES} points montrés, +1 par Fragment</p>
      <ul className={energie.jauge} aria-hidden="true">
        {Array.from({ length: POINTS_MONTRES }, (_, i) => (
          <li key={i} className={i < pleins ? `${energie.point ?? ''} ${energie.plein ?? ''}` : energie.point} />
        ))}
      </ul>
    </div>
  )
}

function Formulaire({ depart }: { depart: Reglages }) {
  const ecriture = useEcritureEnergie()
  const [saisie, setSaisie] = useState<Saisie>(enTexte(depart))
  const [refus, setRefus] = useState<string | null>(null)
  const reglages = enNombres(saisie)

  // Tout champ modifié efface « Enregistré. » et les messages.
  function changer(champ: keyof Reglages, valeur: string) {
    ecriture.reset()
    setRefus(null)
    setSaisie({ ...saisie, [champ]: valeur })
  }

  function enregistrer(e: SyntheticEvent) {
    e.preventDefault()
    const erreur = erreurReglages(reglages)
    setRefus(erreur)
    if (erreur === null) ecriture.mutate(versLignes(reglages))
  }

  const champs = (liste: [keyof Reglages, string][]) => (
    <div className={energie.champs}>
      {liste.map(([champ, libelle]) => (
        <label key={champ} className={styles.champ}>{libelle}
          <input type="number" min={0} step={1} value={saisie[champ]} onChange={(e) => { changer(champ, e.target.value) }} />
        </label>
      ))}
    </div>
  )

  return (
    <form className={styles.ecran} onSubmit={enregistrer}>
      <EnTeteDePage surtitre="Le jeu" titre="L’Énergie" phrase={erreurReglages(reglages) === null ? resume(reglages) : ''} />
      <TitreDeSection titre="La jauge" />
      <Bloc>{champs(LA_JAUGE)}</Bloc>
      <TitreDeSection titre="Le prix d’une découverte" />
      <Bloc>{champs(LE_PRIX)}</Bloc>
      <Bloc><RegleRedessinee r={reglages} /></Bloc>
      <div className={energie.pied}>
        <button type="submit" className={styles.boutonContour} disabled={ecriture.isPending}>Enregistrer</button>
        {ecriture.isSuccess && <span role="status">Enregistré.</span>}
        {refus && <p role="alert">{refus}</p>}
        {ecriture.isError && <p role="alert">{ecriture.error.message}</p>}
      </div>
    </form>
  )
}

export function Energie() {
  const { data, isError } = useReglagesEnergie()
  if (data) return <Formulaire depart={depuisLignes(data)} />
  return (
    <div className={styles.ecran}>
      <EnTeteDePage surtitre="Le jeu" titre="L’Énergie" />
      {isError && <p className={styles.calme}>La base ne répond pas.</p>}
    </div>
  )
}
