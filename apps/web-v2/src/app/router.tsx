/**
 * QUOI     — toutes les adresses de la V2.
 * POURQUOI — tout état navigable est une URL (spec socle §4bis). Premier segment = l'onglet ;
 *            ce qui suit = un détail ouvert par-dessus (ex. /carte/explorateur/<id>), ou une
 *            feuille (/carte/ajouter).
 *            /bienvenue/<étape> : les écrans d'entrée, hors de la garde d'accès.
 * ATTENTION — basename '/v2' : dans le code on écrit '/carte', le navigateur affiche '/v2/carte'.
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { Onboarding } from '@/features/onboarding/components/Onboarding'
import { DaPage } from './da/DaPage'
import { TabRoute } from './navigation/TabRoute'
import { RootLayout } from './RootLayout'
import { RouteChemins, RouteClassement } from './routes/accueil'
import { RouteAjouter, RouteAjouterLieu, RouteNotifications } from './routes/carte'
import { RouteCarnet, RouteLieu, RouteModifierLieu } from './routes/lieu'
import { RouteMurmure } from './routes/messages'
import { RouteExplorateur, RouteModifier, RoutePreferences } from './routes/compte'
import { Shell } from './shell/Shell'

export const routes: RouteObject[] = [
  // L'entrée (onboarding) : avant la garde d'accès, on y arrive sans compte.
  { path: '/bienvenue/:etape?', Component: Onboarding },
  {
    path: '/',
    Component: RootLayout,
    children: [
      { path: 'da', Component: DaPage },
      {
        Component: Shell,
        children: [
          { index: true, element: <Navigate to="/accueil" replace /> },
          {
            path: ':tab',
            Component: TabRoute,
            children: [
              { index: true, element: null },
              { path: 'ajouter', Component: RouteAjouter },
              { path: 'ajouter/lieu/:etape', Component: RouteAjouterLieu },
              { path: 'notifications', Component: RouteNotifications },
              { path: 'lieu/:id', Component: RouteLieu },
              { path: 'lieu/:id/modifier', Component: RouteModifierLieu },
              { path: 'lieu/:id/carnet', Component: RouteCarnet },
              { path: 'explorateur/:id', Component: RouteExplorateur },
              { path: 'explorateur/:id/modifier', Component: RouteModifier },
              { path: 'preferences', Component: RoutePreferences },
              { path: 'murmures/:id', Component: RouteMurmure },
              { path: 'classement', Component: RouteClassement },
              { path: 'chemins', Component: RouteChemins },
            ],
          },
          { path: '*', element: <Navigate to="/accueil" replace /> },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes, { basename: '/v2' })
