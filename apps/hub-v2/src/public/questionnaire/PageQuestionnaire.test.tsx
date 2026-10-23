import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, vi } from 'vitest'
import { PageQuestionnaire } from './PageQuestionnaire'

type Appel = { url: string; methode: string; corps: unknown }

function monter(adresse: string, lecture: unknown = { prenom: 'Kelpie', portrait: null }) {
  const appels: Appel[] = []
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    appels.push({ url, methode: init?.method ?? 'GET', corps: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : null })
    if ((init?.method ?? 'GET') === 'GET') return Promise.resolve(Response.json(lecture))
    return Promise.resolve(Response.json({ ok: true, prenom: 'Kelpie' }))
  }))
  render(
    <MemoryRouter initialEntries={[adresse]}>
      <PageQuestionnaire />
    </MemoryRouter>,
  )
  return appels
}

afterEach(() => {
  vi.unstubAllGlobals()
})

test('le lien d’une époque la coche, et rien n’est envoyé avant le bouton', async () => {
  const appels = monter('/qui-es-tu?j=u1.sig&epoque=celtes')
  expect(await screen.findByRole('checkbox', { name: 'Les Celtes et les Gaulois' })).toBeChecked()
  expect(appels.every((a) => a.methode === 'GET')).toBe(true)
})

test('une troisième époque ne se coche pas', async () => {
  monter('/qui-es-tu?j=u1.sig')
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Rome' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Le Moyen Âge' }))
  expect(screen.getByRole('checkbox', { name: 'La Grèce antique' })).toBeDisabled()
})

test('« Envoyer mes réponses » poste les clés, puis « C’est noté » salue le prénom et rappelle le pin', async () => {
  const appels = monter('/qui-es-tu?j=u1.sig&epoque=celtes')
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Un flyer' }))
  await userEvent.type(screen.getByLabelText('Ta réponse'), 'Plus de Celtes')
  await userEvent.selectOptions(screen.getByLabelText('Jour'), '12')
  await userEvent.selectOptions(screen.getByLabelText('Mois'), '3')
  await userEvent.click(screen.getByRole('button', { name: 'Envoyer mes réponses' }))
  const envoi = appels.find((a) => a.methode === 'POST')
  expect(envoi?.corps).toEqual({
    jeton: 'u1.sig',
    reponses: {
      epoques: ['celtes'], decouverte: ['flyer'], amene: [], plait: [],
      attente: 'Plus de Celtes', departement: null, anniv_jour: 12, anniv_mois: 3,
    },
  })
  expect(await screen.findByText('Merci, Kelpie')).toBeInTheDocument()
  expect(screen.getByText('Le pin de la Rune')).toBeInTheDocument()
})

test('ses réponses d’avant sont déjà cochées', async () => {
  monter('/qui-es-tu?j=u1.sig', {
    prenom: 'Kelpie',
    portrait: { epoques: ['rome'], decouverte: [], amene: ['cadeau'], plait: [], attente: null, departement: null, anniv_jour: null, anniv_mois: null },
  })
  expect(await screen.findByRole('checkbox', { name: 'Rome' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Offrir un cadeau' })).toBeChecked()
})

test('sans lien, la page demande l’adresse et n’écrit rien d’autre', async () => {
  const appels = monter('/qui-es-tu')
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Ton e-mail'), 'kelpie@exemple.fr')
  await userEvent.click(screen.getByRole('button', { name: 'Recevoir mon lien' }))
  expect(appels).toEqual([{ url: '/.netlify/functions/questionnaire', methode: 'POST', corps: { email: 'kelpie@exemple.fr' } }])
  expect(await screen.findByText(/Regarde ta boîte/)).toBeInTheDocument()
})

test('un lien invalide le dit', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json({ error: 'Lien invalide' }, { status: 403 }))))
  render(
    <MemoryRouter initialEntries={['/qui-es-tu?j=faux']}>
      <PageQuestionnaire />
    </MemoryRouter>,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(/ne fonctionne plus/)
})
