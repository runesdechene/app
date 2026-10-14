/**
 * QUOI     — toutes les adresses du Hub V2.
 * POURQUOI — tout état navigable est une URL (spec Hub V2 §4) ; le menu (coquille/menu.ts) est la
 *            liste des adresses, l'accueil a son écran, les autres attendent leur plan.
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { Ouverture } from '@/features/accueil/components/Ouverture'
import { Comptes } from '@/features/communaute/components/Comptes'
import { BientotIci } from './coquille/BientotIci'
import { Coquille } from './coquille/Coquille'
import { MENU } from './coquille/menu'
import { PorteDEntree } from './entree/PorteDEntree'

// Les écrans faits quittent « bientôt » ; chaque tâche suivante ajoute le sien.
const ECRANS_FAITS = new Set(['/communaute/comptes'])

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
      { path: 'communaute/comptes', Component: Comptes, children: [] },
      ...autres,
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
