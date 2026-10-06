/**
 * QUOI     — toutes les adresses de la V2.
 * POURQUOI — tout état navigable est une URL (spec socle §4bis). Premier segment = l'onglet ;
 *            ce qui suit = un détail ouvert par-dessus (ex. /carte/explorateur/<id>), ou une
 *            feuille (/carte/ajouter).
 *            /bienvenue : la vitrine, où l'on cherche sans compte ; /bienvenue/carte : la carte des
 *            visiteurs, positions floutées, et l'aperçu d'un lieu par-dessus (…/lieu/<id>) ; /bienvenue/<étape> : les écrans d'entrée. Tous hors de la garde d'accès.
 * ATTENTION — basename '/v2' : dans le code on écrit '/carte', le navigateur affiche '/v2/carte'.
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { Vitrine } from '@/features/vitrine/components/Vitrine'
import { DaPage } from './da/DaPage'
import { TabRoute } from './navigation/TabRoute'
import { RootLayout } from './RootLayout'
import { RouteChemins, RouteClassement } from './routes/accueil'
import {
  RouteAjouter,
  RouteAjouterLieu,
  RoutePoserPin,
  RouteFichePin,
  RouteCompleterPin,
  RouteNotifications,
  RouteNouveautes,
} from './routes/carte'
import { RouteCarnet, RouteLieu, RouteModifierLieu } from './routes/lieu'
import { RouteCompagnie, RouteFonder, RouteGerer } from './routes/compagnies'
import { RouteMurmure } from './routes/messages'
import { RouteApercuLieu, RouteCarteVisiteur, RouteOnboarding } from './routes/vitrine'
import { RouteExplorateur, RouteModifier, RoutePreferences } from './routes/compte'
import { Shell } from './shell/Shell'

export const routes: RouteObject[] = [
  // La vitrine et l'entrée : avant la garde d'accès, on y arrive sans compte.
  { path: '/bienvenue', Component: Vitrine },
  {
    path: '/bienvenue/carte',
    Component: RouteCarteVisiteur,
    children: [{ path: 'lieu/:id', Component: RouteApercuLieu }],
  },
  { path: '/bienvenue/:etape', Component: RouteOnboarding },
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
              { path: 'ajouter/pin', Component: RoutePoserPin },
              { path: 'ajouter/pin/:id', Component: RouteFichePin },
              { path: 'ajouter/pin/:id/completer', Component: RouteCompleterPin },
              { path: 'notifications', Component: RouteNotifications },
              { path: 'nouveautes', Component: RouteNouveautes },
              { path: 'lieu/:id', Component: RouteLieu },
              { path: 'lieu/:id/modifier', Component: RouteModifierLieu },
              { path: 'lieu/:id/carnet', Component: RouteCarnet },
              { path: 'explorateur/:id', Component: RouteExplorateur },
              { path: 'explorateur/:id/modifier', Component: RouteModifier },
              { path: 'preferences', Component: RoutePreferences },
              { path: 'murmures/:id', Component: RouteMurmure },
              { path: 'compagnie/fonder', Component: RouteFonder },
              { path: 'compagnie/:id', Component: RouteCompagnie },
              { path: 'compagnie/:id/gerer', Component: RouteGerer },
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
