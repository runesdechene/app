/**
 * QUOI     — les Préférences : trois cartes, des interrupteurs qui écrivent la bonne clé et
 *            reviennent en arrière si l'écriture échoue, le changement d'e-mail, le lien Hub.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { PreferencesPage } from './PreferencesPage'

const api = vi.hoisted(() => ({
  SOUMETTRE_PHOTO_URL: 'https://hub.runesdechene.com/soumettre-contenu',
  mesPreferences: vi.fn(() =>
    Promise.resolve({
      email: 'uriel@lahoussaye.fr',
      brouillerPistes: true,
      pushImportant: true,
      pushRecap: false,
      showDepartement: true,
      showEnvies: true,
      lieuxEnCouleur: false,
      titleGender: 'm' as const,
    }),
  ),
  reglerPreference: vi.fn(() => Promise.resolve()),
  reglerBrouillage: vi.fn(() => Promise.resolve()),
  changerEmail: vi.fn(() => Promise.resolve()),
}))
vi.mock('../api/preferences', () => api)

function ouvrir() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <PreferencesPage />
    </QueryClientProvider>,
  )
}

test('les trois cartes et leurs réglages', async () => {
  ouvrir()
  expect(await screen.findByRole('region', { name: 'Ce qu’on t’envoie' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Ta présence sur la carte' })).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Ton compte' })).toBeInTheDocument()
  expect(screen.getByRole('switch', { name: 'Les nouvelles importantes' })).toBeChecked()
  expect(screen.getByRole('switch', { name: 'Le récit de la semaine' })).not.toBeChecked()
  expect(screen.getByRole('switch', { name: 'Montrer tes envies' })).toBeChecked()
})

test('un interrupteur écrit sa clé', async () => {
  ouvrir()
  await userEvent.click(await screen.findByRole('switch', { name: 'Montrer tes envies' }))
  expect(api.reglerPreference).toHaveBeenCalledWith('show_envies', false)
  expect(screen.getByRole('switch', { name: 'Montrer tes envies' })).not.toBeChecked()
})

test('« Mes lieux en couleur » écrit sa clé', async () => {
  ouvrir()
  await userEvent.click(await screen.findByRole('switch', { name: 'Mes lieux en couleur' }))
  expect(api.reglerPreference).toHaveBeenCalledWith('lieux_en_couleur', true)
})

test('le brouillage passe par sa propre fonction', async () => {
  ouvrir()
  await userEvent.click(await screen.findByRole('switch', { name: 'Brouiller tes pistes' }))
  expect(api.reglerBrouillage).toHaveBeenCalledWith(false)
})

test('une écriture refusée : l’interrupteur revient et un message le dit', async () => {
  api.reglerPreference.mockRejectedValueOnce(new Error('réseau'))
  ouvrir()
  const recit = await screen.findByRole('switch', { name: 'Le récit de la semaine' })
  await userEvent.click(recit)
  await waitFor(() => {
    expect(recit).not.toBeChecked()
  })
  expect(screen.getByRole('alert')).toHaveTextContent('pas pu être enregistré')
})

test('changer d’e-mail envoie un lien de confirmation', async () => {
  ouvrir()
  await userEvent.click(await screen.findByRole('button', { name: /Ton adresse e-mail/ }))
  await userEvent.type(screen.getByLabelText('Nouvelle adresse'), 'nouvelle@exemple.fr')
  await userEvent.click(screen.getByRole('button', { name: 'Changer' }))
  expect(api.changerEmail).toHaveBeenCalledWith('nouvelle@exemple.fr')
  expect(
    await screen.findByText(/Un lien de confirmation a été envoyé à nouvelle@exemple.fr/),
  ).toBeInTheDocument()
})

test('« Un fragment qui n’apparaît pas ? » mène au formulaire du Hub', async () => {
  ouvrir()
  const lien = await screen.findByRole('link', { name: /Un fragment qui n’apparaît pas/ })
  expect(lien).toHaveAttribute('href', 'https://hub.runesdechene.com/soumettre-contenu')
  expect(lien).toHaveAttribute('target', '_blank')
})

test('deux réglages de suite, le premier refusé : seul le premier revient', async () => {
  let refuser: (e: Error) => void = () => undefined
  api.reglerPreference.mockImplementationOnce(
    () =>
      new Promise((_, reject) => {
        refuser = reject
      }),
  )
  ouvrir()
  const recit = await screen.findByRole('switch', { name: 'Le récit de la semaine' })
  const envies = screen.getByRole('switch', { name: 'Montrer tes envies' })
  await userEvent.click(recit)
  await userEvent.click(envies)
  refuser(new Error('réseau'))
  await waitFor(() => {
    expect(recit).not.toBeChecked()
  })
  expect(envies).not.toBeChecked()
})

test('préférences illisibles : un message et « Réessayer », jamais un écran vide', async () => {
  api.mesPreferences.mockRejectedValueOnce(new Error('réseau'))
  ouvrir()
  expect(await screen.findByText('Tes préférences n’ont pas pu être chargées')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
})
