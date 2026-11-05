/**
 * QUOI     — l'invitation « Ne rate plus rien » : Activer abonne ce téléphone (et donne l'accord aux
 *            nouvelles si la case est cochée), la case n'est montrée qu'à qui ne l'a pas donné,
 *            « Plus tard » la repousse, et elle attend que l'invitation à installer soit réglée.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'

const etat = vi.hoisted(() => ({ accord: false, installationEnAttente: false }))
const push = vi.hoisted(() => ({ abonner: vi.fn(() => Promise.resolve()) }))
const nouvelles = vi.hoisted(() => ({
  lireAccordNouvelles: vi.fn(() => Promise.resolve(etat.accord)),
  donnerAccordNouvelles: vi.fn(() => Promise.resolve()),
}))
const invitation = vi.hoisted(() => ({
  aInviterCeTelephone: vi.fn(() => true),
  repousserInvitation: vi.fn(),
}))
vi.mock('@/features/compte/lib/push', () => push)
vi.mock('@/shared/supabase/nouvelles', () => nouvelles)
vi.mock('@/features/compte/lib/invitationNotifications', () => invitation)
vi.mock('@/shared/hooks/useAutorisationPosition', () => ({
  useAutorisationPosition: () => ({ autorisation: 'accordee' }),
}))
vi.mock('./installation', () => ({
  installation: {
    suivre: () => () => undefined,
    possible: () => etat.installationEnAttente,
    repoussee: () => !etat.installationEnAttente,
  },
  estInstallee: () => false,
  surIPhone: () => false,
}))

import { InvitationNotifications } from './InvitationNotifications'

function ouvrir() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <InvitationNotifications />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  Object.assign(etat, { accord: false, installationEnAttente: false })
  vi.clearAllMocks()
})

test('Activer abonne ce téléphone et donne l’accord aux nouvelles si la case est cochée', async () => {
  ouvrir()
  await userEvent.click(await screen.findByRole('checkbox'))
  await userEvent.click(screen.getByRole('button', { name: 'Activer' }))
  expect(push.abonner).toHaveBeenCalled()
  expect(nouvelles.donnerAccordNouvelles).toHaveBeenCalled()
  await waitFor(() => {
    expect(screen.queryByRole('dialog', { name: 'Ne rate plus rien' })).toBeNull()
  })
})

test('sans la case cochée, seules les notifications', async () => {
  ouvrir()
  await screen.findByRole('checkbox')
  await userEvent.click(screen.getByRole('button', { name: 'Activer' }))
  expect(push.abonner).toHaveBeenCalled()
  expect(nouvelles.donnerAccordNouvelles).not.toHaveBeenCalled()
})

test('l’accord déjà donné : pas de case', async () => {
  etat.accord = true
  ouvrir()
  await waitFor(() => {
    expect(nouvelles.lireAccordNouvelles).toHaveBeenCalled()
  })
  expect(screen.queryByRole('checkbox')).toBeNull()
  expect(screen.getByText(/pour les notifications/)).toBeInTheDocument()
})

test('« Plus tard » la repousse', async () => {
  ouvrir()
  await userEvent.click(screen.getByRole('button', { name: 'Plus tard' }))
  expect(invitation.repousserInvitation).toHaveBeenCalled()
  expect(screen.queryByRole('dialog', { name: 'Ne rate plus rien' })).toBeNull()
})

test('elle attend que l’invitation à installer soit réglée', () => {
  etat.installationEnAttente = true
  ouvrir()
  expect(screen.queryByRole('dialog', { name: 'Ne rate plus rien' })).toBeNull()
})
