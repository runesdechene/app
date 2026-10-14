/**
 * QUOI     — toutes les adresses du Hub V2.
 * POURQUOI — tout état navigable est une URL (spec Hub V2 §4).
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'

export const routes: RouteObject[] = [
  { path: '/', element: <p>Accueil du Hub</p> },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
