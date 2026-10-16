/**
 * QUOI     — « Photos et avis » (maquette 596:1319) : quatre chiffres, filtres, recherche, la file des
 *            contributions à gauche, celle qu'on lit à droite avec ses décisions.
 * POURQUOI — filtre, recherche, page et contribution choisie (?c=) sont dans l'adresse. Une fois la
 *            contribution traitée, on passe à la suivante, sinon à celle d'avant. L'en-tête télécharge en archive
 *            les photos de la page affichée arrivées depuis une date.
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { depuis, heureDuFil } from '@/shared/lib/quand'
import { pluriel } from '@/shared/lib/texte'
import { Bloc } from '@/shared/ui/Bloc'
import { ChampDeRecherche } from '@/shared/ui/ChampDeRecherche'
import { ChoixSegmente } from '@/shared/ui/ChoixSegmente'
import { EnTeteDePage } from '@/shared/ui/EnTeteDePage'
import { Pages } from '@/shared/ui/Pages'
import { Tuile } from '@/shared/ui/Tuile'
import type { Contribution, Filtre } from '../api/contributions'
import { useContributions } from '../hooks/useContributions'
import { useTelechargement } from '../hooks/useTelechargement'
import { fichiersDeContributions } from '../lib/archive'
import { estUneVideo } from '../lib/contribution'
import { LectureContribution } from './LectureContribution'
import boutique from './Boutique.module.css'
import styles from './Photos.module.css'

const PAR_PAGE = 50
const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: 'pending', libelle: 'À valider' }, { valeur: 'approved', libelle: 'Publiées' },
  { valeur: 'archived', libelle: 'Archivées' }, { valeur: 'toutes', libelle: 'Toutes' },
]
const nombre = new Intl.NumberFormat('fr-FR')

function numeroDePage(texte: string | null): number {
  const page = Math.floor(Number(texte))
  return page >= 1 ? page : 1
}

/** « ★★★★★  3 photos », « 1 photo, sans avis » (maquette 596:1319). */
function resumeDeLaLigne(c: Contribution): string {
  const note = c.note_produits ?? c.note_experience
  const photos = `${String(c.images.length)} ${pluriel(c.images.length, 'photo')}`
  if (note === null) return `${photos}, sans avis`
  const pleines = Math.min(5, Math.max(0, Math.round(note)))
  return `${'★'.repeat(pleines)}${'☆'.repeat(5 - pleines)}  ${photos}`
}

function Vignette({ contribution }: { contribution: Contribution }) {
  const url = contribution.images[0]?.url
  if (!url) return <span className={styles.vignette} />
  return estUneVideo(url)
    ? <video className={styles.vignette} src={url} muted preload="metadata" />
    : <img className={styles.vignette} src={url} alt="" loading="lazy" />
}

export function Photos() {
  const [params, setParams] = useSearchParams()
  const [depuisLe, setDepuisLe] = useState('')
  const telechargement = useTelechargement()
  const filtre = FILTRES.find((f) => f.valeur === params.get('filtre'))?.valeur ?? 'pending'
  const recherche = params.get('q') ?? ''
  const decalage = (numeroDePage(params.get('page')) - 1) * PAR_PAGE
  const { data, isError } = useContributions({ filtre, recherche, limite: PAR_PAGE, decalage })
  const lignes = data?.lignes
  const choisie = lignes?.find((c) => c.id === params.get('c')) ?? lignes?.[0]

  // Une page au-delà de la dernière (liste raccourcie par les décisions) : on se replace sur la dernière.
  const total = data?.total ?? 0
  useEffect(() => {
    if (total > 0 && decalage >= total) {
      const suivants = new URLSearchParams(params)
      suivants.set('page', String(Math.ceil(total / PAR_PAGE)))
      setParams(suivants, { replace: true })
    }
  }, [total, decalage, params, setParams])

  function changer(cle: string, valeur: string) {
    const suivants = new URLSearchParams(params)
    if (valeur === '' || (cle === 'filtre' && valeur === 'pending')) suivants.delete(cle)
    else suivants.set(cle, valeur)
    if (cle !== 'page') suivants.delete('page')
    suivants.delete('c')
    setParams(suivants)
  }

  function choisir(id: string | undefined) {
    const suivants = new URLSearchParams(params)
    if (id === undefined) suivants.delete('c')
    else suivants.set('c', id)
    setParams(suivants, { replace: true })
  }

  function apresDecision() {
    if (!lignes || !choisie) return
    const rang = lignes.indexOf(choisie)
    choisir((lignes[rang + 1] ?? lignes[rang - 1])?.id)
  }

  // « depuis le » est un jour du calendrier de l'écran : on compare avec le début de ce jour, à l'heure locale.
  const debut = depuisLe === '' ? null : new Date(`${depuisLe}T00:00:00`)
  const recentes = debut === null ? [] : (lignes ?? []).filter((c) => c.quand !== null && new Date(c.quand) >= debut)
  const fichiers = fichiersDeContributions(recentes)

  const compteurs = data?.compteurs
  const phrase = !compteurs ? '' : compteurs.a_valider > 0 && compteurs.plus_ancienne
    ? `${String(compteurs.a_valider)} ${pluriel(compteurs.a_valider, 'contribution')} ${compteurs.a_valider > 1 ? 'attendent' : 'attend'} ; la plus ancienne est arrivée ${depuis(compteurs.plus_ancienne)}.`
    : 'Rien n’attend.'

  return (
    <div className={boutique.ecran}>
      <EnTeteDePage surtitre="Fragments et boutique" titre="Photos et avis" phrase={phrase} aDroite={
        <div className={styles.telechargement}>
          <label>
            Télécharger depuis le
            <input type="date" value={depuisLe} onChange={(e) => { setDepuisLe(e.target.value) }} />
          </label>
          <button type="button" className={styles.contour} disabled={fichiers.length === 0 || telechargement.enCours}
            onClick={() => { void telechargement.telecharger(fichiers, `photos-communaute-depuis-${depuisLe.replaceAll('-', '')}.zip`) }}>
            Télécharger (.zip)
          </button>
          {depuisLe !== '' && <span className={styles.progres}>{`${String(recentes.length)} ${pluriel(recentes.length, 'contribution')} · ${String(fichiers.length)} ${pluriel(fichiers.length, 'fichier')}`}</span>}
          {telechargement.message && <span className={styles.progres}>{telechargement.message}</span>}
          {telechargement.erreur && <span role="alert" className={styles.erreur}>{telechargement.erreur}</span>}
        </div>
      } />
      {compteurs && (
        <div className={styles.tuiles} role="group" aria-label="Les chiffres">
          <Tuile libelle="À valider" valeur={nombre.format(compteurs.a_valider)} />
          <Tuile libelle="Publiées" valeur={nombre.format(compteurs.publiees)} />
          <Tuile libelle="Archivées" valeur={nombre.format(compteurs.archivees)} />
          <Tuile libelle="Photos au mur" valeur={nombre.format(compteurs.au_mur)} />
        </div>
      )}
      <div className={styles.barre}>
        <ChoixSegmente nom="Filtre" options={FILTRES} choisi={filtre} onChoix={(v) => { changer('filtre', v) }} />
        <span className={styles.air} />
        <ChampDeRecherche valeur={recherche} onChange={(q) => { changer('q', q) }} etiquette="Un nom, un e-mail…" />
      </div>
      {isError && <p className={boutique.calme}>La base ne répond pas.</p>}
      {lignes?.length === 0 && <Bloc><p className={boutique.calme}>Aucune contribution ici.</p></Bloc>}
      {lignes && choisie && (
        <div className={styles.volets}>
          <div className={styles.file}>
            <Bloc>
              {lignes.map((c) => (
                <button key={c.id} type="button" className={styles.ligne} aria-current={c.id === choisie.id}
                  onClick={() => { choisir(c.id) }}>
                  <Vignette contribution={c} />
                  <span className={styles.nom}>{c.nom}</span>
                  <span className={styles.quand}>{c.quand ? heureDuFil(c.quand) : ''}</span>
                  <span className={styles.porte}>{c.produit ?? 'Sans produit'}</span>
                  <span className={styles.notes}>{resumeDeLaLigne(c)}</span>
                </button>
              ))}
            </Bloc>
            <Pages total={total} decalage={decalage} parPage={PAR_PAGE} onDecalage={(d) => { changer('page', String(d / PAR_PAGE + 1)) }} />
          </div>
          <LectureContribution key={choisie.id} contribution={choisie} onDecide={apresDecision} />
        </div>
      )}
    </div>
  )
}
