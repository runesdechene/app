/**
 * QUOI     — un message du Registre et ses cœurs : un par personne, qu'on retire ; le double
 *            toucher n'allume que ; on voit qui a aimé ; son propre message ne s'aime pas.
 */
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
    texte: 'Belle balade hier.',
    quand: '2026-09-28T07:12:00Z',
    auteur: GAUTIER,
    moi,
    mentions: [],
    mentionneMoi: false,
    coeurs,
    aime,
  }
}

function monter(m: Message, aimeEnCours?: boolean) {
  const onAimer = vi.fn()
  render(
    <MemoryRouter>
      <ul>
        <LigneMessage
          message={m}
          suite={false}
          prefixe={false}
          aimeEnCours={aimeEnCours}
          onAimer={onAimer}
        />
      </ul>
    </MemoryRouter>,
  )
  return onAimer
}

test('un cœur sur le message d’un autre, et on peut le retirer', async () => {
  const onAimer = monter(message([KELPIE], true))
  const coeur = screen.getByRole('button', { name: 'Aimer le message de Gautier' })
  expect(coeur).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(coeur)
  expect(onAimer).toHaveBeenCalledWith(7, false)
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
  expect(screen.getByRole('button', { name: 'Aimer le message de Gautier' })).toHaveAttribute(
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

test('mon message ne s’aime pas : on y lit qui l’a aimé, sans bouton cœur', () => {
  const onAimer = monter(message([KELPIE], false, true))
  expect(screen.queryByRole('button', { name: /Aimer/ })).toBeNull()
  expect(screen.getByRole('button', { name: 'Voir qui a aimé (1)' })).toBeInTheDocument()
  const texte = screen.getByText('Belle balade hier.')
  fireEvent.pointerUp(texte, { pointerType: 'touch' })
  fireEvent.pointerUp(texte, { pointerType: 'touch' })
  expect(onAimer).not.toHaveBeenCalled()
})
