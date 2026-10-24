/**
 * QUOI     — toutes les adresses du Hub V2.
 * POURQUOI — tout état navigable est une URL (spec Hub V2 §4) ; le menu (coquille/menu.ts) est la
 *            liste des adresses, et chaque adresse du menu a sa route écrite ici (un test le garde).
 *            Les trois pages publiques (QR imprimés, spec §3) passent AVANT la porte : sœurs de
 *            `/`, chargées à la demande, elles n'appellent jamais `hub_est_admin`.
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { Ouverture } from '@/features/accueil/components/Ouverture'
import { AssocierUnFragment } from '@/features/communaute/components/AssocierUnFragment'
import { Compagnies } from '@/features/communaute/components/Compagnies'
import { Comptes } from '@/features/communaute/components/Comptes'
import { Lieux } from '@/features/communaute/components/Lieux'
import { Signalements } from '@/features/communaute/components/Signalements'
import { TiroirCompagnie } from '@/features/communaute/components/TiroirCompagnie'
import { TiroirCompte } from '@/features/communaute/components/TiroirCompte'
import { TiroirLieu } from '@/features/communaute/components/TiroirLieu'
import { TiroirFragment } from '@/features/boutique/components/TiroirFragment'
import { Achats } from '@/features/boutique/components/Achats'
import { Ecoutes } from '@/features/boutique/components/Ecoutes'
import { Correspondance } from '@/features/boutique/components/Correspondance'
import { Fragments } from '@/features/boutique/components/Fragments'
import { Photos } from '@/features/boutique/components/Photos'
import { Synchro } from '@/features/boutique/components/Synchro'
import { Bannieres } from '@/features/jeu/components/Bannieres'
import { Cultures } from '@/features/jeu/components/Cultures'
import { Natures } from '@/features/jeu/components/Natures'
import { Titres } from '@/features/jeu/components/Titres'
import { Energie } from '@/features/jeu/components/Energie'
import { Enigmes } from '@/features/jeu/components/Enigmes'
import { EnigmesSignalees } from '@/features/jeu/components/EnigmesSignalees'
import { Blog } from '@/features/joueurs/components/Blog'
import { EcrireMissive } from '@/features/missives/components/Ecrire'
import { Automatisations } from '@/features/missives/components/Automatisations'
import { Envois } from '@/features/missives/components/Envois'
import { Listes } from '@/features/missives/components/Listes'
import { QuiSontIls } from '@/features/missives/components/QuiSontIls'
import { TiroirArticle } from '@/features/joueurs/components/TiroirArticle'
import { Notifications } from '@/features/joueurs/components/Notifications'
import { MisesAJour } from '@/features/joueurs/components/MisesAJour'
import { TiroirMiseAJour } from '@/features/joueurs/components/TiroirMiseAJour'
import { TiroirBanniere } from '@/features/jeu/components/TiroirBanniere'
import { TiroirCulture } from '@/features/jeu/components/TiroirCulture'
import { TiroirEnigme } from '@/features/jeu/components/TiroirEnigme'
import { TiroirNature } from '@/features/jeu/components/TiroirNature'
import { TiroirTitre } from '@/features/jeu/components/TiroirTitre'
import { Reglages } from '@/features/reglages/components/Reglages'
import { Coquille } from './coquille/Coquille'
import { PorteDEntree } from './entree/PorteDEntree'

export const routes: RouteObject[] = [
  // `lazy` en fonction, pas en objet : la forme objet ne charge qu'une fois par définition de
  // route ; un second routeur bâti sur ces mêmes routes (les tests) répond alors 404.
  { path: 'soumettre-contenu', lazy: async () => ({ Component: (await import('@/public/soumettre/PageSoumettre')).PageSoumettre }) },
  { path: 'desabonnement', lazy: async () => ({ Component: (await import('@/public/desabonnement/PageDesabonnement')).PageDesabonnement }) },
  { path: 'qui-es-tu', lazy: async () => ({ Component: (await import('@/public/questionnaire/PageQuestionnaire')).PageQuestionnaire }) },
  // Le cadre commun de /flyer et /flyercadeau : la photo et le parchemin restent, seule la page change.
  {
    lazy: async () => ({ Component: (await import('@/public/flyer/CadreFlyer')).CadreFlyer }),
    children: [
      { path: 'flyer', lazy: async () => ({ Component: (await import('@/public/flyer/CadreFlyer')).PageFlyer }) },
      { path: 'flyercadeau', lazy: async () => ({ Component: (await import('@/public/flyer/CadreFlyer')).PageCadeau }) },
    ],
  },
  {
    path: '/',
    element: (
      <PorteDEntree>
        <Coquille />
      </PorteDEntree>
    ),
    children: [
      { index: true, Component: Ouverture },
      { path: 'communaute/comptes', Component: Comptes, children: [{ path: ':id', Component: TiroirCompte }] },
      { path: 'communaute/compagnies', Component: Compagnies, children: [{ path: ':id', Component: TiroirCompagnie }] },
      { path: 'communaute/lieux', Component: Lieux, children: [{ path: ':id', Component: TiroirLieu }] },
      { path: 'communaute/signalements', Component: Signalements },
      { path: 'jeu/enigmes', Component: Enigmes, children: [{ path: 'nouvelle', Component: TiroirEnigme }, { path: ':id', Component: TiroirEnigme }] },
      { path: 'jeu/cultures', Component: Cultures, children: [{ path: ':id', Component: TiroirCulture }] },
      { path: 'jeu/natures', Component: Natures, children: [{ path: 'nouvelle', Component: TiroirNature }, { path: ':id', Component: TiroirNature }] },
      { path: 'jeu/titres', Component: Titres, children: [{ path: 'nouveau', Component: TiroirTitre }, { path: ':id', Component: TiroirTitre }] },
      { path: 'jeu/bannieres', Component: Bannieres, children: [{ path: ':id', Component: TiroirBanniere }] },
      { path: 'jeu/enigmes-signalees', Component: EnigmesSignalees },
      { path: 'jeu/energie', Component: Energie },
      { path: 'boutique/fragments', Component: Fragments, children: [{ path: ':id', Component: TiroirFragment }] },
      { path: 'boutique/fragments/correspondance', Component: Correspondance },
      { path: 'boutique/fragments/achats', Component: Achats },
      { path: 'boutique/associer', Component: AssocierUnFragment },
      { path: 'boutique/photos', Component: Photos },
      { path: 'boutique/audio', Component: Ecoutes },
      { path: 'boutique/synchro', Component: Synchro },
      { path: 'missives/ecrire', Component: EcrireMissive },
      { path: 'missives/ecrire/:id', Component: EcrireMissive },
      { path: 'missives/envois', Component: Envois },
      { path: 'missives/listes', Component: Listes },
      { path: 'missives/automatisations', Component: Automatisations },
      { path: 'missives/qui-sont-ils', Component: QuiSontIls },
      { path: 'joueurs/mises-a-jour', Component: MisesAJour, children: [{ path: 'nouvelle', Component: TiroirMiseAJour }, { path: ':id', Component: TiroirMiseAJour }] },
      { path: 'joueurs/notifications', Component: Notifications },
      { path: 'joueurs/blog', Component: Blog, children: [{ path: 'nouveau', Component: TiroirArticle }, { path: ':id', Component: TiroirArticle }] },
      { path: 'reglages', Component: Reglages },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
