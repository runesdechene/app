/**
 * QUOI     — la racine de toutes les adresses : la garde d'accès, puis la page demandée.
 * POURQUOI — rien de la V2 ne s'affiche avant que la garde ait dit oui. Une fois entré, un lien
 *            d'invitation (`?company=`) ouvre la fiche de sa Compagnie.
 */
import { Outlet } from 'react-router'
import { AccessGate } from './access/AccessGate'
import { Invitation } from './access/Invitation'

export function RootLayout() {
  return (
    <AccessGate>
      <Invitation />
      <Outlet />
    </AccessGate>
  )
}
