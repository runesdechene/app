/**
 * QUOI     — un message du Registre et ses cœurs : un par personne, qu'on retire ; le cœur du
 *            survol, à la place de l'heure, tant que je n'ai pas aimé ; le double toucher n'allume
 *            que ; on voit qui a aimé ; son propre message s'aime aussi. Le sien se modifie (15 minutes)
 *            ou se retire, par un appui long (un clic droit sur PC) ; retiré, il reste une ligne.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import type { Message, Personne } from '../api/lireRegistre'
import { LigneMessage } from './LigneMessage'

const GAUTIER = { id: 'u2', nom: 'Gautier', avatar: null }
const KELPIE = { id: 'u9', nom: 'Kelpie', avatar: null }
const ASH = { id: 'u8', nom: 'Ash', avatar: null }

function message(coeurs: Personne[], aime: boolean, moi = false): Message {
  return {
    id: 7,
    canal: 'general',
    canalNom: null,
    canalCouleur: null,
    texte: 'Belle balade hier.',
    modifie: false,
    quand: '2026-09-28T07:12:00Z',
    auteur: GAUTIER,
    moi,
    mentions: [],
    mentionneMoi: false,
    coeurs,
    aime,
  }
}

const onModifier = vi.fn(() => Promise.resolve())
const onRetirer = vi.fn(() => Promise.resolve())

function monter(m: Message, aimeEnCours?: boolean) {
  const onAimer = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <ul>
          <LigneMessage
            message={m}
            suite={false}
            prefixe={null}
            aimeEnCours={aimeEnCours}
            onAimer={onAimer}
            onModifier={onModifier}
            onRetirer={onRetirer}
          />
        </ul>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return onAimer
}

test('mon cœur donné : la gélule le retire ; le cœur du survol n’apparaît plus', async () => {
  const onAimer = monter(message([KELPIE], true))
  expect(screen.queryByRole('button', { name: 'Aimer le message de Gautier' })).toBeNull()
  const coeur = screen.getByRole('button', { name: 'Aimer le message de Gautier (1)' })
  expect(coeur).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(coeur)
  expect(onAimer).toHaveBeenCalledWith(7, false)
})

test('déjà aimé par d’autres, pas par moi : le cœur du survol est là', async () => {
  const onAimer = monter(message([KELPIE], false))
  await userEvent.click(screen.getByRole('button', { name: 'Aimer le message de Gautier' }))
  expect(onAimer).toHaveBeenCalledWith(7, true)
})

test('sans cœur encore, le bouton discret allume le premier', async () => {
  const onAimer = monter(message([], false))
  await userEvent.click(screen.getByRole('button', { name: 'Aimer le message de Gautier' }))
  expect(onAimer).toHaveBeenCalledWith(7, true)
  expect(screen.queryByRole('button', { name: /Voir qui a aimé/ })).toBeNull()
})

test('le cœur se compte tout de suite, avant la réponse de la base', () => {
  monter(message([KELPIE], false), true)
  expect(screen.getByRole('button', { name: 'Voir qui a aimé (2)' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Aimer le message de Gautier (2)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('au téléphone, un double toucher allume le cœur — il ne l’éteint jamais', () => {
  const onAimer = monter(message([], false))
  const texte = screen.getByText('Belle balade hier.')
  fireEvent.pointerUp(texte, { pointerType: 'touch' })
  expect(onAimer).not.toHaveBeenCalled()
  fireEvent.pointerUp(texte, { pointerType: 'touch' })
  expect(onAimer).toHaveBeenCalledWith(7, true)
})

test('déjà aimé : le double toucher ne fait rien', () => {
  const onAimer = monter(message([KELPIE], true))
  const texte = screen.getByText('Belle balade hier.')
  fireEvent.pointerUp(texte, { pointerType: 'touch' })
  fireEvent.pointerUp(texte, { pointerType: 'touch' })
  expect(onAimer).not.toHaveBeenCalled()
})

test('on voit qui a aimé : les portraits, puis la liste des noms vers leurs profils', async () => {
  monter(message([KELPIE, ASH], false))
  await userEvent.click(screen.getByRole('button', { name: 'Voir qui a aimé (2)' }))
  const liste = screen.getByRole('dialog', { name: 'Ils ont aimé' })
  expect(within(liste).getByRole('link', { name: /Kelpie/ })).toHaveAttribute(
    'href',
    '/messages/explorateur/u9',
  )
  expect(within(liste).getByRole('link', { name: /Ash/ })).toBeInTheDocument()
})

test('mon propre message s’aime aussi (ça peut arriver)', async () => {
  const onAimer = monter(message([], false, true))
  await userEvent.click(screen.getByRole('button', { name: 'Aimer le message de Gautier' }))
  expect(onAimer).toHaveBeenCalledWith(7, true)
})

test('chaque message porte son canal : celui des bugs prend la couleur de sa gélule', () => {
  render(
    <MemoryRouter>
      <ul>
        <LigneMessage
          message={{ ...message([], false), canal: 'bugs' }}
          suite={false}
          prefixe="[Bug & Suggestions]"
          aimeEnCours={undefined}
          onAimer={vi.fn()}
          onModifier={onModifier}
          onRetirer={onRetirer}
        />
      </ul>
    </MemoryRouter>,
  )
  expect(screen.getByRole('listitem')).toHaveAttribute('data-canal', 'bugs')
})

test('retiré : « Message retiré » à sa place, sans cœur', () => {
  monter({ ...message([], false), texte: null })
  expect(screen.getByText('Message retiré')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Aimer/ })).toBeNull()
})

test('modifié : ça se voit', () => {
  monter({ ...message([], false), modifie: true })
  expect(screen.getByText('(modifié)')).toBeInTheDocument()
})

test('mon message tout frais : je le modifie', async () => {
  monter({ ...message([], false, true), quand: new Date().toISOString() })
  fireEvent.contextMenu(screen.getByText('Belle balade hier.'))
  await userEvent.click(screen.getByRole('button', { name: 'Modifier' }))
  const champ = screen.getByRole('textbox', { name: 'Ton message' })
  await userEvent.clear(champ)
  await userEvent.type(champ, 'Superbe balade hier.')
  await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
  expect(onModifier).toHaveBeenCalledWith(7, 'Superbe balade hier.')
})

test('passé quinze minutes, il ne se modifie plus mais se retire, après confirmation', async () => {
  monter(message([], false, true))
  fireEvent.contextMenu(screen.getByText('Belle balade hier.'))
  expect(screen.queryByRole('button', { name: 'Modifier' })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))
  expect(onRetirer).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Retirer le message' }))
  expect(onRetirer).toHaveBeenCalledWith(7)
})

test('le message d’un autre n’ouvre rien', () => {
  monter(message([], false))
  fireEvent.contextMenu(screen.getByText('Belle balade hier.'))
  expect(screen.queryByRole('button', { name: 'Supprimer' })).toBeNull()
})
