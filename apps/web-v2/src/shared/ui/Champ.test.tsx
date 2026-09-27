/**
 * QUOI     — le champ de saisie : libellé associé, limite tenue à la saisie, zone multiligne.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Champ } from './Champ'

function Pilote(options: { max?: number; multiligne?: boolean }) {
  const [valeur, setValeur] = useState('')
  return <Champ libelle="Ta présentation" valeur={valeur} onChange={setValeur} {...options} />
}

test('le libellé nomme le champ', () => {
  render(<Pilote />)
  expect(screen.getByLabelText('Ta présentation')).toBeInTheDocument()
})

test('au-delà de la limite, la saisie est tronquée et le compteur passe au plein', async () => {
  render(<Pilote max={10} />)
  const champ = screen.getByLabelText('Ta présentation')
  await userEvent.click(champ)
  await userEvent.paste('a'.repeat(40))
  expect(champ).toHaveValue('a'.repeat(10))
  const compteur = screen.getByText('10 / 10')
  expect(compteur.className).toMatch(/plein/)
})

test('multiligne : une zone de texte', () => {
  render(<Pilote multiligne />)
  expect(screen.getByLabelText('Ta présentation').tagName).toBe('TEXTAREA')
})

function PiloteDepuis({ depart }: { depart: string }) {
  const [valeur, setValeur] = useState(depart)
  return <Champ libelle="Ta présentation" valeur={valeur} onChange={setValeur} max={10} />
}

test('un texte déjà trop long se raccourcit sans être coupé d’un coup', async () => {
  render(<PiloteDepuis depart={'a'.repeat(15)} />)
  const champ = screen.getByLabelText('Ta présentation')
  await userEvent.type(champ, '{Backspace}')
  expect(champ).toHaveValue('a'.repeat(14))
  await userEvent.type(champ, 'b')
  expect(champ).toHaveValue('a'.repeat(14))
})

test('la limite ne coupe jamais un emoji en deux', async () => {
  render(<Pilote max={3} />)
  const champ = screen.getByLabelText('Ta présentation')
  await userEvent.click(champ)
  await userEvent.paste('ab🇫🇷x')
  expect(champ).toHaveValue('ab🇫🇷')
  expect(screen.getByText('3 / 3')).toBeInTheDocument()
})
