/**
 * QUOI     — la racine de toutes les adresses : la garde d'accès, puis la page demandée.
 * POURQUOI — rien de la V2 ne s'affiche avant que la garde ait dit oui.
 */
import { Outlet } from 'react-router'
import { AccessGate } from './access/AccessGate'

export function RootLayout() {
  return (
    <AccessGate>
      <Outlet />
    </AccessGate>
  )
}
