/**
 * QUOI     — le brouillon d'une Missive et ses gestes : changer une zone, changer de modèle, ajouter,
 *            déplacer ou retirer une nouvelle. Des fonctions pures : l'écran garde le brouillon en état.
 * POURQUOI — une Missive neuve part du texte des maquettes : ses « {…} » disent quoi écrire où, et une zone
 *            vide ne se verrait pas pour être touchée.
 */
import { EXEMPLES, PALETTES, type Couleurs, type Lettre, type Modele, type Nouvelle } from '@runes/missives'
import type { Liste } from '../api/listes'

export type Brouillon = {
  id: number | null
  lettre: Lettre
  couleurs: Couleurs
  objet: string
  apercu: string
  liste: Liste | null
}

const NOUVELLES_MAX = 5

function contenuNeuf(modele: Modele): Lettre {
  // Une copie profonde : le brouillon ne doit jamais modifier les exemples.
  if (modele === 'missive') return { modele, contenu: structuredClone(EXEMPLES.missive) }
  if (modele === 'fragment') return { modele, contenu: structuredClone(EXEMPLES.fragment) }
  return { modele, contenu: structuredClone(EXEMPLES.carnet) }
}

export function brouillonVide(modele: Modele): Brouillon {
  return { id: null, lettre: contenuNeuf(modele), couleurs: PALETTES.marque, objet: '', apercu: '', liste: null }
}

export function changerModele(b: Brouillon, modele: Modele): Brouillon {
  return { ...b, lettre: contenuNeuf(modele) }
}

/** `zone` est un chemin pointé du contenu : « titre », « nouvelles.1.titre », « rupture.appel.lien ». */
export function changerZone(b: Brouillon, zone: string, valeur: string): Brouillon {
  const contenu: unknown = structuredClone(b.lettre.contenu)
  const cles = zone.split('.')
  const derniere = cles.pop()
  let ici = contenu
  for (const cle of cles) ici = (ici as Record<string, unknown>)[cle]
  if (derniere === undefined || typeof ici !== 'object' || ici === null) return b
  ;(ici as Record<string, unknown>)[derniere] = valeur
  return { ...b, lettre: { ...b.lettre, contenu } as Lettre }
}

function avecNouvelles(b: Brouillon, changer: (n: Nouvelle[]) => Nouvelle[]): Brouillon {
  if (b.lettre.modele !== 'missive') return b
  const nouvelles = changer([...b.lettre.contenu.nouvelles])
  if (nouvelles.length < 1 || nouvelles.length > NOUVELLES_MAX) return b
  return { ...b, lettre: { modele: 'missive', contenu: { ...b.lettre.contenu, nouvelles } } }
}

export function ajouterNouvelle(b: Brouillon): Brouillon {
  return avecNouvelles(b, (n) => [
    ...n,
    { titre: 'UNE NOUVELLE', texte: '{Deux phrases, et un lien si besoin.}', appel: { texte: 'EN SAVOIR PLUS', lien: 'https://runesdechene.com' } },
  ])
}

export function supprimerNouvelle(b: Brouillon, i: number): Brouillon {
  return avecNouvelles(b, (n) => n.filter((_, j) => j !== i))
}

export function deplacerNouvelle(b: Brouillon, de: number, vers: number): Brouillon {
  return avecNouvelles(b, (n) => {
    const [nouvelle] = n.splice(de, 1)
    if (nouvelle) n.splice(vers, 0, nouvelle)
    return n
  })
}
