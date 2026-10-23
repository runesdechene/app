/**
 * QUOI     — le menu du Hub, par domaines (spec Hub V2 §5), et les onglets du téléphone.
 * POURQUOI — une seule liste : le menu du PC, les onglets, les routes et les pastilles en
 *            découlent. Les domaines préparent les droits des modérateurs (chantier C).
 */
export type CleAttente = 'photos' | 'lieux' | 'signalementsLieu' | 'signalementsEnigme' | 'achats'
export type Lien = { libelle: string; chemin: string; file?: CleAttente }
export type IconeDomaine = 'communaute' | 'jeu' | 'boutique' | 'missives' | 'joueurs' | 'reglages'
export type Domaine = { titre: string | null; icone?: IconeDomaine; liens: Lien[] }

export const MENU: Domaine[] = [
  { titre: null, liens: [{ libelle: 'Accueil', chemin: '/' }] },
  {
    titre: 'Communauté',
    icone: 'communaute',
    liens: [
      { libelle: 'Comptes', chemin: '/communaute/comptes' },
      { libelle: 'Compagnies', chemin: '/communaute/compagnies' },
      { libelle: 'Lieux à modérer', chemin: '/communaute/lieux', file: 'lieux' },
      { libelle: 'Signalements', chemin: '/communaute/signalements', file: 'signalementsLieu' },
    ],
  },
  {
    titre: 'Le jeu',
    icone: 'jeu',
    liens: [
      { libelle: 'Énigmes', chemin: '/jeu/enigmes' },
      { libelle: 'Énigmes signalées', chemin: '/jeu/enigmes-signalees', file: 'signalementsEnigme' },
      { libelle: 'Cultures', chemin: '/jeu/cultures' },
      { libelle: 'Natures', chemin: '/jeu/natures' },
      { libelle: 'Titres', chemin: '/jeu/titres' },
      { libelle: 'Bannières', chemin: '/jeu/bannieres' },
      { libelle: 'Énergie', chemin: '/jeu/energie' },
    ],
  },
  {
    titre: 'Fragments et boutique',
    icone: 'boutique',
    liens: [
      { libelle: 'Fragments', chemin: '/boutique/fragments', file: 'achats' },
      { libelle: 'Associer un Fragment', chemin: '/boutique/associer' },
      { libelle: 'Photos et avis', chemin: '/boutique/photos', file: 'photos' },
      { libelle: 'Synchro Shopify', chemin: '/boutique/synchro' },
      { libelle: 'Écoutes audio', chemin: '/boutique/audio' },
    ],
  },
  {
    titre: 'Missives',
    icone: 'missives',
    liens: [
      { libelle: 'Écrire', chemin: '/missives/ecrire' },
      { libelle: 'Envois', chemin: '/missives/envois' },
      { libelle: 'Listes', chemin: '/missives/listes' },
    ],
  },
  {
    titre: 'Parler aux joueurs',
    icone: 'joueurs',
    liens: [
      { libelle: 'Mises à jour', chemin: '/joueurs/mises-a-jour' },
      { libelle: 'Notifications', chemin: '/joueurs/notifications' },
      { libelle: 'Blog de la boutique', chemin: '/joueurs/blog' },
    ],
  },
  { titre: 'Réglages', icone: 'reglages', liens: [{ libelle: 'Réglages', chemin: '/reglages' }] },
]

export type Onglet = { libelle: string; chemin: string; icone: 'accueil' | 'communaute' | 'jeu' | 'boutique' | 'plus' }

export const ONGLETS: Onglet[] = [
  { libelle: 'Accueil', chemin: '/', icone: 'accueil' },
  { libelle: 'Communauté', chemin: '/communaute/comptes', icone: 'communaute' },
  { libelle: 'Le jeu', chemin: '/jeu/enigmes', icone: 'jeu' },
  { libelle: 'Boutique', chemin: '/boutique/photos', icone: 'boutique' },
  { libelle: 'Plus', chemin: '/reglages', icone: 'plus' },
]
