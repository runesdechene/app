/**
 * QUOI     — toutes les adresses du Hub V2.
 * POURQUOI — tout état navigable est une URL (spec Hub V2 §4) ; le menu (coquille/menu.ts) est la
 *            liste des adresses, l'accueil a son écran, les autres attendent leur plan.
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { Ouverture } from '@/features/accueil/components/Ouverture'
import { Compagnies } from '@/features/communaute/components/Compagnies'
import { Comptes } from '@/features/communaute/components/Comptes'
import { Lieux } from '@/features/communaute/components/Lieux'
import { Signalements } from '@/features/communaute/components/Signalements'
import { TiroirCompagnie } from '@/features/communaute/components/TiroirCompagnie'
import { TiroirCompte } from '@/features/communaute/components/TiroirCompte'
import { TiroirLieu } from '@/features/communaute/components/TiroirLieu'
import { Cultures } from '@/features/jeu/components/Cultures'
import { Enigmes } from '@/features/jeu/components/Enigmes'
import { EnigmesSignalees } from '@/features/jeu/components/EnigmesSignalees'
import { TiroirCulture } from '@/features/jeu/components/TiroirCulture'
import { TiroirEnigme } from '@/features/jeu/components/TiroirEnigme'
import { BientotIci } from './coquille/BientotIci'
import { Coquille } from './coquille/Coquille'
import { MENU } from './coquille/menu'
import { PorteDEntree } from './entree/PorteDEntree'

// Les écrans faits quittent « bientôt » ; chaque tâche suivante ajoute le sien.
const ECRANS_FAITS = new Set(['/communaute/comptes', '/communaute/compagnies', '/communaute/lieux', '/communaute/signalements', '/jeu/enigmes', '/jeu/enigmes-signalees', '/jeu/cultures'])

const autres = MENU.flatMap((d) => d.liens)
  .filter((l) => l.chemin !== '/' && !ECRANS_FAITS.has(l.chemin))
  .map((l) => ({ path: l.chemin.slice(1), Component: BientotIci }))

export const routes: RouteObject[] = [
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
      { path: 'jeu/enigmes-signalees', Component: EnigmesSignalees },
      ...autres,
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
