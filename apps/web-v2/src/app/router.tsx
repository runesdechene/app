/**
 * QUOI     — toutes les adresses de la V2.
 * POURQUOI — tout état navigable est une URL (spec socle §4bis). Premier segment = l'onglet ;
 *            ce qui suit = un détail ouvert par-dessus (ex. /carte/explorateur/<id>), ou le menu
 *            avatar (/carte/menu).
 * ATTENTION — basename '/v2' : dans le code on écrit '/carte', le navigateur affiche '/v2/carte'.
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { DaPage } from './da/DaPage'
import { TabRoute } from './navigation/TabRoute'
import { RootLayout } from './RootLayout'
import { RouteExplorateur, RouteMenu, RouteModifier, RoutePreferences } from './routes/compte'
import { Shell } from './shell/Shell'

export const routes: RouteObject[] = [
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
              { path: 'menu', Component: RouteMenu },
              { path: 'explorateur/:id', Component: RouteExplorateur },
              { path: 'explorateur/:id/modifier', Component: RouteModifier },
              { path: 'preferences', Component: RoutePreferences },
            ],
          },
          { path: '*', element: <Navigate to="/accueil" replace /> },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes, { basename: '/v2' })
