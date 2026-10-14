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
import { TiroirCompagnie } from '@/features/communaute/components/TiroirCompagnie'
import { TiroirCompte } from '@/features/communaute/components/TiroirCompte'
import { TiroirLieu } from '@/features/communaute/components/TiroirLieu'
import { BientotIci } from './coquille/BientotIci'
import { Coquille } from './coquille/Coquille'
import { MENU } from './coquille/menu'
import { PorteDEntree } from './entree/PorteDEntree'

// Les écrans faits quittent « bientôt » ; chaque tâche suivante ajoute le sien.
const ECRANS_FAITS = new Set(['/communaute/comptes', '/communaute/compagnies', '/communaute/lieux'])

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
      ...autres,
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
