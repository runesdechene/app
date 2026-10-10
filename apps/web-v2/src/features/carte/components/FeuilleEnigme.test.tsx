/**
 * QUOI     — la feuille d'une énigme : la question, une seule réponse, le verdict, l'erreur.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { FeuilleEnigme } from './FeuilleEnigme'

const ouvrirEnigme = vi.fn<(id: number) => Promise<unknown>>()
const percerEnigme = vi.fn<(id: number, r: string) => Promise<unknown>>()
const signalerEnigme = vi.fn<(numero: number, raison: string, precision: string, proposition: string) => Promise<void>>()
vi.mock('../api/enigmes', () => ({
  ouvrirEnigme: (id: number) => ouvrirEnigme(id),
  percerEnigme: (id: number, r: string) => percerEnigme(id, r),
  signalerEnigme: (numero: number, raison: string, precision: string, proposition: string) =>
    signalerEnigme(numero, raison, precision, proposition),
}))

const calendrier = vi.hoisted(() => ({
  lireCalendrier: vi.fn((): Promise<'chretien' | 'rome'> => Promise.resolve('chretien')),
  reglerCalendrier: vi.fn(),
}))
vi.mock('@/shared/lib/calendrierDuCompte', () => calendrier)

const onFermer = vi.fn()

function monter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <FeuilleEnigme touchee={{ id: 4, x: 100, y: 200 }} onFermer={onFermer} />
    </QueryClientProvider>,
  )
}

// jsdom n'anime rien : une fois l'énigme chargée (le sceau porte `data-retourne`), la fin du
// retournement se déclenche à la main.
async function retourner() {
  await waitFor(() => {
    expect(document.querySelector('[data-retourne]')).not.toBeNull()
  })
  const sceau = document.querySelector('[data-retourne]')
  if (sceau) fireEvent.animationEnd(sceau)
}

const enigme = {
  culture: { id: 'byzantine', nom: 'Byzance', icone: null, couleur: null },
  recit: 'Justinien voulait bâtir…',
  question: 'Quel monument Justinien a-t-il fait construire ?',
  format: 'qcm',
  choix: ['Sainte-Sophie', 'Sainte-Irène'],
  numero: 242,
}

test('le sceau retourné, la question et ses réponses ; une réponse juste montre les gains', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  percerEnigme.mockResolvedValue({
    juste: true, reponse: 'Sainte-Sophie', explication: 'La plus grande coupole…', xp: 1, gagnes: 1,
    points: 5, total: 130, nouveauxTitres: ['Apprentie de Byzance'], prochain: { nom: 'Lettrée de Byzance', seuil: 10 },
    resteEnAttente: 2, niveau: { niveau: 12, avant: 0.5, apres: 0.52 },
  })
  monter()
  await retourner()
  fireEvent.click(await screen.findByRole('button', { name: 'Sainte-Sophie' }))
  expect(await screen.findByText('+1 XP')).toBeInTheDocument()
  expect(screen.getByText('La réponse : Sainte-Sophie')).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Niveau 12' })).toBeInTheDocument()
  expect(screen.getByRole('progressbar', { name: 'Byzance' })).toBeInTheDocument()
  expect(percerEnigme).toHaveBeenCalledWith(4, 'Sainte-Sophie')
  expect(screen.getByText('Te voilà Apprentie de Byzance. Il se porte depuis ton profil.')).toBeInTheDocument()
  expect(screen.getByText('La plus grande coupole…')).toBeInTheDocument()
  expect(screen.getByText('Encore 2 énigmes')).toBeInTheDocument()
  expect(screen.getByText('Elles t’attendent sur la carte. Une nouvelle apparaît chaque jour.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Retour à la carte' }))
  expect(onFermer).toHaveBeenCalled()
})

test('une énigme rendormie le dit', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  percerEnigme.mockRejectedValue({ code: 'P0002' })
  monter()
  await retourner()
  fireEvent.click(await screen.findByRole('button', { name: 'Sainte-Irène' }))
  expect(await screen.findByText('Cette énigme s’est rendormie.')).toBeInTheDocument()
})

test('deux touchers rapides n’envoient qu’une réponse', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  percerEnigme.mockReturnValue(new Promise(() => undefined))
  monter()
  await retourner()
  const bouton = await screen.findByRole('button', { name: 'Sainte-Sophie' })
  fireEvent.click(bouton)
  fireEvent.click(bouton)
  await waitFor(() => {
    expect(percerEnigme).toHaveBeenCalledTimes(1)
  })
})

test('l’en-tête dit « Énigme » et la culture ; sans icône, le sceau porte son initiale', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  monter()
  await retourner()
  // Son numéro fixe, le même pour tous : « je bloque sur la 242 ».
  expect(await screen.findByText('Énigme n° 242')).toBeInTheDocument()
  expect(screen.getByText('Byzance')).toBeInTheDocument()
  expect(screen.getByTestId('sceau-culture')).toHaveTextContent('B')
})

test('le logo de la culture se peint à sa couleur, jamais en noir', async () => {
  ouvrirEnigme.mockResolvedValue({ ...enigme, culture: { ...enigme.culture, icone: 'https://x/chrisme.svg', couleur: '#a93d76' } })
  monter()
  await retourner()
  const sceau = await screen.findByTestId('sceau-culture')
  expect(sceau.querySelector('img')).toBeNull()
  expect(sceau.querySelector('[style*="--icone"]')?.getAttribute('style')).toContain('https://x/chrisme.svg')
})

test('les réponses portent une lettre, hors de leur nom', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  monter()
  await retourner()
  const bouton = await screen.findByRole('button', { name: 'Sainte-Irène' })
  expect(bouton).toHaveTextContent('B')
})

test('une réponse fausse : pas cette fois, la bonne réponse, et le savais-tu', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  percerEnigme.mockResolvedValue({
    juste: false, reponse: 'Sainte-Sophie', explication: 'La plus grande coupole…', xp: 0, gagnes: 0,
    points: 4, total: 130, nouveauxTitres: [], prochain: { nom: 'Apprentie de Byzance', seuil: 4 },
    resteEnAttente: 2, niveau: { niveau: 12, avant: 0.5, apres: 0.5 },
  })
  monter()
  await retourner()
  fireEvent.click(await screen.findByRole('button', { name: 'Sainte-Irène' }))
  expect(await screen.findByText('Pas cette fois')).toBeInTheDocument()
  expect(screen.getByText('La réponse : Sainte-Sophie')).toBeInTheDocument()
  expect(screen.getByText('La plus grande coupole…')).toBeInTheDocument()
  expect(screen.queryByText('+1 XP')).toBeNull()
})

const FAUX = {
  juste: false, reponse: 'Sainte-Sophie', explication: 'La plus grande coupole…', xp: 0, gagnes: 0,
  points: 5, total: 130, nouveauxTitres: [], prochain: null,
  resteEnAttente: 2, niveau: { niveau: 12, avant: 0.5, apres: 0.5 },
}

test('avant la réponse, un seul lien : « Signaler une erreur » sous la question', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  monter()
  await retourner()
  await screen.findByRole('button', { name: 'Sainte-Sophie' })
  expect(screen.getByRole('button', { name: 'Signaler une erreur' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Signaler une erreur ou une injustice' })).toBeNull()
})

test('signaler l’énoncé avant de répondre, proposer la bonne réponse, puis répondre quand même', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  percerEnigme.mockResolvedValue(FAUX)
  signalerEnigme.mockResolvedValue(undefined)
  monter()
  await retourner()
  fireEvent.click(await screen.findByRole('button', { name: 'Signaler une erreur' }))
  // Pas encore de réponse : rien à faire accepter.
  expect(screen.queryByRole('radio', { name: 'Ma réponse aurait dû être acceptée' })).toBeNull()
  expect(screen.queryByRole('textbox', { name: 'Quelle serait la bonne réponse ?' })).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: 'L’énoncé est faux ou ambigu' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Quelle serait la bonne réponse ?' }), {
    target: { value: 'Sainte-Irène' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Envoyer le signalement' }))
  expect(await screen.findByText('Merci')).toBeInTheDocument()
  expect(signalerEnigme).toHaveBeenCalledWith(242, 'erreur', '', 'Sainte-Irène')
  fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Sainte-Irène' }))
  expect(await screen.findByText('Pas cette fois')).toBeInTheDocument()
})

test('la réponse tapée survit au signalement', async () => {
  ouvrirEnigme.mockResolvedValue({ ...enigme, format: 'free', choix: null })
  monter()
  await retourner()
  fireEvent.change(await screen.findByRole('textbox', { name: 'Ta réponse' }), { target: { value: 'Eudes' } })
  fireEvent.click(screen.getByRole('button', { name: 'Signaler une erreur' }))
  fireEvent.click(screen.getByTestId('voile'))
  expect(await screen.findByRole('textbox', { name: 'Ta réponse' })).toHaveValue('Eudes')
})

test('après une bonne réponse, on signale encore le contenu, pas une réponse refusée', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  percerEnigme.mockResolvedValue({ ...FAUX, juste: true })
  monter()
  await retourner()
  fireEvent.click(await screen.findByRole('button', { name: 'Sainte-Sophie' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Signaler une erreur ou une injustice' }))
  expect(screen.getByRole('radio', { name: 'L’énoncé, la réponse ou l’explication est faux' })).toBeInTheDocument()
  expect(screen.queryByRole('radio', { name: 'Ma réponse aurait dû être acceptée' })).toBeNull()
})

test('après le verdict, signaler : une raison, un mot, un merci, puis retour à l’énigme', async () => {
  ouvrirEnigme.mockResolvedValue(enigme)
  percerEnigme.mockResolvedValue(FAUX)
  signalerEnigme.mockResolvedValue(undefined)
  monter()
  await retourner()
  fireEvent.click(await screen.findByRole('button', { name: 'Sainte-Irène' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Signaler une erreur ou une injustice' }))
  // La proposition ne vaut que pour une erreur de contenu : sa réponse, la base la connaît.
  fireEvent.click(screen.getByRole('radio', { name: 'Ma réponse aurait dû être acceptée' }))
  expect(screen.queryByRole('textbox', { name: 'Quelle serait la bonne réponse ?' })).toBeNull()
  fireEvent.change(screen.getByRole('textbox', { name: 'Un mot de plus' }), {
    target: { value: 'les deux sont justes' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Envoyer le signalement' }))
  expect(await screen.findByText('Merci')).toBeInTheDocument()
  expect(signalerEnigme).toHaveBeenCalledWith(242, 'reponse_refusee', 'les deux sont justes', '')
  fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
  expect(await screen.findByText('Pas cette fois')).toBeInTheDocument()
})

test('en calendrier de Rome : les dates converties, le choix stocké part au serveur', async () => {
  calendrier.lireCalendrier.mockResolvedValue('rome')
  ouvrirEnigme.mockResolvedValue({
    ...enigme,
    recit: 'En {52 av. J.-C.}, Vercingétorix se rend.',
    question: 'Quand Alésia tombe-t-elle ?',
    choix: ['{52 av. J.-C.}', '{58 av. J.-C.}'],
  })
  percerEnigme.mockResolvedValue({
    juste: true, reponse: '{52 av. J.-C.}', explication: 'César le raconte en {51 av. J.-C.}.', xp: 1, gagnes: 1,
    points: 5, total: 130, nouveauxTitres: [], prochain: null,
    resteEnAttente: 0, niveau: { niveau: 12, avant: 0.5, apres: 0.52 },
  })
  monter()
  await retourner()
  expect(await screen.findByText('En 702 ap. la fondation de Rome, Vercingétorix se rend.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '702 ap. la fondation de Rome' }))
  expect(await screen.findByText('La réponse : 702 ap. la fondation de Rome')).toBeInTheDocument()
  expect(percerEnigme).toHaveBeenCalledWith(4, '{52 av. J.-C.}')
  expect(screen.getByText('César le raconte en 703 ap. la fondation de Rome.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '702 ap. la fondation de Rome' })).toHaveAttribute('data-juste', 'true')
})
