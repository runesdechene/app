/**
 * QUOI     — toutes les adresses du Hub V2.
 * POURQUOI — tout état navigable est une URL (spec Hub V2 §4).
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { PorteDEntree } from './entree/PorteDEntree'

export const routes: RouteObject[] = [
  { path: '/', element: <PorteDEntree><p>Accueil du Hub</p></PorteDEntree> },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
