/**
 * QUOI     — la colonne des réglages de l'écran Écrire (maquette 753:2529) : le modèle, les couleurs, à qui,
 *            l'objet, quand, les liens et les nouvelles. Elle ne garde rien : tout vit dans le brouillon.
 */
import { PALETTES, contrasteSuffisant, type Couleurs, type Modele } from '@runes/missives'
import type { CSSProperties } from 'react'
import { Choix, type OptionDeChoix } from '@/shared/ui/Choix'
import type { LigneDeListe, Liste } from '../api/listes'
import {
  ajouterNouvelle, changerModele, changerZone, deplacerNouvelle, lettreEcrite, supprimerNouvelle, type Brouillon,
} from '../lib/brouillon'
import { liensDe } from '../lib/liens'
import { LISTES } from '../lib/listes'
import styles from './Ecrire.module.css'
import { Pastilles } from './Pastilles'

const nombre = new Intl.NumberFormat('fr-FR')

function Vignette({ c }: { c: Couleurs }) {
  return (
    <span
      className={styles.vignette}
      style={{ '--fond': c.fond, '--titres': c.titres, '--rupture': c.rupture } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.vignetteTitre} />
      <span className={styles.vignetteBande} />
    </span>
  )
}

const MODELES: OptionDeChoix<Modele>[] = [
  { valeur: 'missive', libelle: 'Missive — les nouvelles', groupe: 'Lettres', detail: 'Le mot du mois et ses nouvelles', vignette: <Vignette c={PALETTES.hiver} /> },
  { valeur: 'carnet', libelle: 'Carnet de route', groupe: 'Lettres', detail: 'Le stand et ses prochaines haltes', vignette: <Vignette c={PALETTES.automne} /> },
  {
    valeur: 'fragment', libelle: 'Fragment — un nouveau dessin', groupe: 'Fragments', detail: 'Son histoire et les pièces qui le portent',
    vignette: <Vignette c={{ fond: '#0d0a11', titres: '#dccba0', rupture: '#5a2140' }} />,
  },
]

const NOMS_DES_PALETTES: Record<keyof typeof PALETTES, string> = {
  marque: 'Marque', hiver: 'Hiver', printemps: 'Printemps', ete: 'Été', automne: 'Automne',
}

const COULEURS: { cle: keyof Couleurs; nom: string; role: string }[] = [
  { cle: 'fond', nom: 'Fond', role: 'toute la page' },
  { cle: 'titres', nom: 'Titres', role: 'grand titre, chiffres, liens' },
  { cle: 'rupture', nom: 'Rupture', role: 'la bande et la lettrine' },
]

const memePalette = (a: Couleurs, b: Couleurs) => a.fond === b.fond && a.titres === b.titres && a.rupture === b.rupture

export function Reglages({ b, onChange, listes }: {
  b: Brouillon
  onChange: (b: Brouillon) => void
  listes: LigneDeListe[] | undefined
}) {
  const palette = (Object.keys(PALETTES) as (keyof typeof PALETTES)[]).find((p) => memePalette(PALETTES[p], b.couleurs)) ?? null
  const nouvelles = b.lettre.modele === 'missive' ? b.lettre.contenu.nouvelles : null

  return (
    <>
      <section className={styles.carte}>
        <h2 className={styles.rubrique}>Le modèle</h2>
        <Choix
          valeur={b.lettre.modele}
          options={MODELES}
          onChange={(m) => {
            // Un autre modèle repart de son texte : ce qui est écrit se perdrait.
            if (m === b.lettre.modele) return
            if (lettreEcrite(b) && !window.confirm('Changer de modèle remplace ce que tu as écrit. Continuer ?')) return
            onChange(changerModele(b, m))
          }}
          recherche="Chercher un modèle…"
          libelleAccessible="Le modèle"
        />
        <Pastilles
          nom="Palettes toutes faites"
          options={(Object.keys(PALETTES) as (keyof typeof PALETTES)[]).map((p) => ({ valeur: p, libelle: NOMS_DES_PALETTES[p] }))}
          choisi={palette}
          onChoix={(p) => {
            onChange({ ...b, couleurs: PALETTES[p] })
          }}
        />
        <h3 className={styles.rubrique}>Les trois couleurs</h3>
        {COULEURS.map((c) => (
          <label key={c.cle} className={styles.couleur}>
            <input
              type="color"
              aria-label={c.nom}
              value={b.couleurs[c.cle]}
              onChange={(e) => {
                onChange({ ...b, couleurs: { ...b.couleurs, [c.cle]: e.target.value } })
              }}
            />
            <span className={styles.qui}>
              {c.nom}
              <span className={styles.aide}>{c.role}</span>
            </span>
            <code>{b.couleurs[c.cle].toUpperCase()}</code>
          </label>
        ))}
        {contrasteSuffisant(b.couleurs) ? (
          <p className={styles.aide}>Le texte et les rubriques s’accordent seuls.</p>
        ) : (
          <p role="alert" className={styles.alerte}>Le texte deviendrait difficile à lire : change le fond, les titres ou la rupture.</p>
        )}
      </section>

      <section className={styles.carte}>
        <Pastilles
          nom="À qui"
          options={(listes ?? []).map((l) => ({ valeur: l.cle, libelle: LISTES[l.cle].nom, detail: nombre.format(l.avecAccord) }))}
          choisi={b.liste}
          onChoix={(liste: Liste) => {
            onChange({ ...b, liste })
          }}
        />
        <label className={styles.champ}>
          <span className={styles.rubrique}>L’objet</span>
          <input
            value={b.objet}
            placeholder="Ce qu’on lit dans la boîte de réception"
            onChange={(e) => {
              onChange({ ...b, objet: e.target.value })
            }}
          />
        </label>
        <label className={styles.champ}>
          <span className={styles.rubrique}>La ligne d’aperçu</span>
          <input
            value={b.apercu}
            placeholder="La phrase grise qui suit l’objet"
            onChange={(e) => {
              onChange({ ...b, apercu: e.target.value })
            }}
          />
        </label>
      </section>

      <section className={styles.carte}>
        <h2 className={styles.rubrique}>Les liens</h2>
        {liensDe(b.lettre).map((l) => (
          <label key={l.zone} className={styles.champ}>
            <span className={styles.aide}>{l.texte}</span>
            <input
              type="url"
              value={l.adresse}
              onChange={(e) => {
                onChange(changerZone(b, l.zone, e.target.value))
              }}
            />
          </label>
        ))}
      </section>

      {nouvelles && (
        <section className={styles.carte}>
          <h2 className={styles.rubrique}>Les nouvelles</h2>
          <ol className={styles.nouvelles}>
            {nouvelles.map((n, i) => (
              <li key={i}>
                <span className={styles.nouvelleTitre}>{n.titre}</span>
                <button type="button" aria-label={`Monter « ${n.titre} »`} disabled={i === 0} onClick={() => { onChange(deplacerNouvelle(b, i, i - 1)) }}>↑</button>
                <button type="button" aria-label={`Descendre « ${n.titre} »`} disabled={i === nouvelles.length - 1} onClick={() => { onChange(deplacerNouvelle(b, i, i + 1)) }}>↓</button>
                <button type="button" aria-label={`Retirer « ${n.titre} »`} disabled={nouvelles.length === 1} onClick={() => { onChange(supprimerNouvelle(b, i)) }}>✕</button>
              </li>
            ))}
          </ol>
          {nouvelles.length < 5 && (
            <button type="button" className={styles.ajouter} onClick={() => { onChange(ajouterNouvelle(b)) }}>
              + Ajouter une nouvelle
            </button>
          )}
        </section>
      )}
    </>
  )
}
