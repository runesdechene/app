import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, vi } from 'vitest'
import { PageQuestionnaire } from './PageQuestionnaire'

type Appel = { url: string; methode: string; corps: unknown }

function monter(adresse: string, lecture: unknown = { prenom: 'Kelpie', portrait: null }, envoi: unknown = { ok: true, prenom: 'Kelpie', compte: false }) {
  const appels: Appel[] = []
  vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
    appels.push({ url, methode: init?.method ?? 'GET', corps: typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : null })
    if ((init?.method ?? 'GET') === 'GET') return Promise.resolve(Response.json(lecture))
    return Promise.resolve(Response.json(envoi))
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

test('le lien ouvre l’accueil à son prénom, sans rien demander', async () => {
  monter('/qui-es-tu?j=u1.sig')
  expect(await screen.findByText('Bonjour Kelpie')).toBeInTheDocument()
  expect(screen.queryByLabelText('Ton e-mail')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Commencer →' }))
  expect(screen.getByRole('heading', { name: 'Quelle époque t’appelle ?' })).toBeInTheDocument()
})

test('le lien d’une époque la coche, et rien n’est envoyé avant le bouton', async () => {
  const appels = monter('/qui-es-tu?j=u1.sig&epoque=celtes&q=1')
  expect(await screen.findByRole('checkbox', { name: 'Les Celtes et les Gaulois' })).toBeChecked()
  expect(appels.every((a) => a.methode === 'GET')).toBe(true)
})

test('« Une autre » ouvre un champ pour dire laquelle', async () => {
  monter('/qui-es-tu?j=u1.sig&q=1')
  expect(await screen.findByRole('checkbox', { name: 'L’Antiquité égyptienne' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Laquelle ?')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Une autre' }))
  await userEvent.type(screen.getByLabelText('Laquelle ?'), 'Les Mayas')
  expect(screen.getByLabelText('Laquelle ?')).toHaveValue('Les Mayas')
})

test('une troisième époque ne se coche pas', async () => {
  monter('/qui-es-tu?j=u1.sig&q=1')
  await userEvent.click(await screen.findByRole('checkbox', { name: 'L’Empire romain d’Orient et d’Occident' }))
  await userEvent.click(screen.getByRole('checkbox', { name: 'Le Moyen Âge' }))
  expect(screen.getByRole('checkbox', { name: 'La Grèce antique' })).toBeDisabled()
})

test('une question par écran ; « Précédent » revient en arrière', async () => {
  monter('/qui-es-tu?j=u1.sig&q=1')
  await userEvent.click(await screen.findByRole('button', { name: 'Suivant →' }))
  expect(screen.getByRole('heading', { name: 'Comment as-tu découvert Runes de Chêne ?' })).toBeInTheDocument()
  expect(screen.queryByRole('checkbox', { name: 'L’Empire romain d’Orient et d’Occident' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '← Précédent' }))
  expect(screen.getByRole('checkbox', { name: 'L’Empire romain d’Orient et d’Occident' })).toBeInTheDocument()
})

test('« Envoyer mes réponses » poste les réponses des sept écrans, puis « C’est noté » salue le prénom', async () => {
  const appels = monter('/qui-es-tu?j=u1.sig&epoque=celtes&q=2')
  await userEvent.click(await screen.findByRole('checkbox', { name: 'Un flyer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Suivant →' }))
  await userEvent.click(screen.getByRole('button', { name: 'Suivant →' }))
  await userEvent.click(screen.getByRole('button', { name: 'Suivant →' }))
  await userEvent.type(screen.getByLabelText('Ta réponse'), 'Plus de Celtes')
  await userEvent.click(screen.getByRole('button', { name: 'Suivant →' }))
  await userEvent.click(screen.getByRole('button', { name: 'Suivant →' }))
  await userEvent.selectOptions(screen.getByLabelText('Jour'), '12')
  await userEvent.selectOptions(screen.getByLabelText('Mois'), '3')
  await userEvent.click(screen.getByRole('button', { name: 'Envoyer mes réponses' }))
  const envoi = appels.find((a) => a.methode === 'POST')
  expect(envoi?.corps).toEqual({
    jeton: 'u1.sig',
    reponses: {
      epoques: ['celtes'], epoque_autre: null, decouverte: ['flyer'], amene: [], plait: [],
      attente: 'Plus de Celtes', departement: null, anniv_jour: 12, anniv_mois: 3,
    },
    compte: false,
  })
  expect(await screen.findByText('Merci, Kelpie')).toBeInTheDocument()
  expect(screen.getByText('Le pin de la Rune')).toBeInTheDocument()
  expect(screen.queryByText(/Ton compte Explore est prêt/)).not.toBeInTheDocument()
})

test('la case du compte part avec les réponses, et la fin le confirme', async () => {
  const appels = monter('/qui-es-tu?j=u1.sig&q=7', undefined, { ok: true, prenom: 'Kelpie', compte: true })
  await userEvent.click(await screen.findByRole('checkbox', { name: /Créer aussi mon compte Explore/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Envoyer mes réponses' }))
  expect(appels.find((a) => a.methode === 'POST')?.corps).toMatchObject({ compte: true })
  expect(await screen.findByText(/Ton compte Explore est prêt/)).toBeInTheDocument()
})

test('ses réponses d’avant sont déjà cochées', async () => {
  monter('/qui-es-tu?j=u1.sig&q=1', {
    prenom: 'Kelpie',
    portrait: { epoques: ['rome'], decouverte: [], amene: ['cadeau'], plait: [], attente: null, departement: null, anniv_jour: null, anniv_mois: null },
  })
  expect(await screen.findByRole('checkbox', { name: 'L’Empire romain d’Orient et d’Occident' })).toBeChecked()
  await userEvent.click(screen.getByRole('button', { name: 'Suivant →' }))
  await userEvent.click(screen.getByRole('button', { name: 'Suivant →' }))
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

test('une panne du serveur ne se fait pas passer pour un lien mort', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('{}', { status: 500 }))))
  render(
    <MemoryRouter initialEntries={['/qui-es-tu?j=u1.sig']}>
      <PageQuestionnaire />
    </MemoryRouter>,
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(/réessaie dans un instant/)
})
