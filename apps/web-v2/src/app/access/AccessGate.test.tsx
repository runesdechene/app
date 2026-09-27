/**
 * QUOI     — vérifie que la garde applique chaque décision à l'écran.
 * POURQUOI — la décision est testée seule (decideAccess.test) ; ici on vérifie le branchement.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AccessGate } from './AccessGate'
import { useV2Access } from './useV2Access'

vi.mock('./useV2Access', () => ({ useV2Access: vi.fn() }))

afterEach(() => {
  vi.mocked(useV2Access).mockReset()
})

test('affiche l’app quand l’accès est accordé', () => {
  vi.mocked(useV2Access).mockReturnValue({
    state: { status: 'ready', hasSession: true, hasAccess: true },
    retry: vi.fn(),
  })
  render(<AccessGate leave={vi.fn()}>contenu V2</AccessGate>)
  expect(screen.getByText('contenu V2')).toBeInTheDocument()
})

test('renvoie vers la V1 sans accès, sans rien afficher de la V2', () => {
  const leave = vi.fn()
  vi.mocked(useV2Access).mockReturnValue({
    state: { status: 'ready', hasSession: true, hasAccess: false },
    retry: vi.fn(),
  })
  render(<AccessGate leave={leave}>contenu V2</AccessGate>)
  expect(leave).toHaveBeenCalledOnce()
  expect(screen.queryByText('contenu V2')).not.toBeInTheDocument()
})

test('hors connexion : message, bouton Réessayer et lien vers la V1', async () => {
  const retry = vi.fn()
  vi.mocked(useV2Access).mockReturnValue({ state: { status: 'error' }, retry })
  render(<AccessGate leave={vi.fn()}>contenu V2</AccessGate>)
  expect(screen.getByText(/hors connexion/i)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
  expect(retry).toHaveBeenCalledOnce()
  expect(screen.getByRole('link', { name: 'Retour à la V1' })).toHaveAttribute('href', '/')
})

test('rien pendant le chargement', () => {
  const leave = vi.fn()
  vi.mocked(useV2Access).mockReturnValue({ state: { status: 'loading' }, retry: vi.fn() })
  render(<AccessGate leave={leave}>contenu V2</AccessGate>)
  expect(screen.queryByText('contenu V2')).not.toBeInTheDocument()
  expect(leave).not.toHaveBeenCalled()
})
