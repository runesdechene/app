/**
 * QUOI     — l'invitation à installer : le bouton du navigateur s'il sait installer, le geste à
 *            faire sur iPhone, jamais avant l'invitation de position, et « Plus tard » jusqu'à la
 *            prochaine ouverture — ou jusqu'à la ligne du menu du profil.
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type { Autorisation } from '@/shared/lib/position'
import { ecouterInstallation, repousserInvitation } from './installation'
import { InvitationInstaller } from './InvitationInstaller'

const position = vi.hoisted((): { autorisation: Autorisation | null } => ({
  autorisation: 'accordee',
}))
vi.mock('@/shared/hooks/useAutorisationPosition', () => ({
  useAutorisationPosition: () => position,
}))

const TITRE = 'Installer Runes de Chêne'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) Chrome/130.0'
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1'
const prompt = vi.fn(() => Promise.resolve())

ecouterInstallation()

// Le navigateur dit qu'il sait installer.
function proposerInstallation() {
  act(() => {
    window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'), { prompt }))
  })
}

function surLeTelephone(userAgent: string, installee = false) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent)
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: installee } as MediaQueryList)
}

beforeEach(() => {
  repousserInvitation(false)
  localStorage.clear()
  position.autorisation = 'accordee'
  prompt.mockClear()
  window.dispatchEvent(new Event('appinstalled')) // repart sans demande gardée
  surLeTelephone(ANDROID)
})

test('le navigateur sait installer : « Installer » ouvre sa fenêtre', async () => {
  render(<InvitationInstaller />)
  expect(screen.queryByText(TITRE)).toBeNull()
  proposerInstallation()
  await userEvent.click(screen.getByRole('button', { name: 'Installer' }))
  expect(prompt).toHaveBeenCalled()
  expect(screen.queryByText(TITRE)).toBeNull()
})

test('« Plus tard » la fait taire jusqu’à la prochaine ouverture', async () => {
  proposerInstallation()
  const { unmount } = render(<InvitationInstaller />)
  await userEvent.click(screen.getByRole('button', { name: 'Plus tard' }))
  unmount()
  render(<InvitationInstaller />)
  expect(screen.queryByText(TITRE)).toBeNull()
})

test('fermée par la croix, « Installer l’appli » du menu la fait revenir', async () => {
  surLeTelephone(IPHONE)
  render(<InvitationInstaller />)
  await userEvent.click(screen.getByRole('button', { name: 'Plus tard' }))
  expect(screen.queryByText(TITRE)).toBeNull()
  act(() => {
    repousserInvitation(false)
  })
  expect(screen.getByText(TITRE)).toBeInTheDocument()
})

test('sur iPhone, le geste à faire, sans bouton Installer', () => {
  surLeTelephone(IPHONE)
  render(<InvitationInstaller />)
  expect(screen.getByRole('img', { name: 'Partager' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Installer' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Plus tard' })).toBeInTheDocument() // la croix
})

test('rien dans l’appli déjà installée', () => {
  surLeTelephone(IPHONE, true)
  render(<InvitationInstaller />)
  expect(screen.queryByText(TITRE)).toBeNull()
})

test('rien tant que l’invitation de position attend', () => {
  position.autorisation = 'a-demander'
  proposerInstallation()
  render(<InvitationInstaller />)
  expect(screen.queryByText(TITRE)).toBeNull()
})
