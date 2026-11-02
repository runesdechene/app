/**
 * QUOI     — la carte d'un Fragment, la même au profil et au Codex, dans ses trois états.
 * POURQUOI — spec du Codex (02/11) : inconnu (silhouette), scanné (net, sans couleur, ×N), porté
 *            (la carte dorée du profil, le check à la couleur de la collection).
 */
import { render, screen } from '@testing-library/react'
import { CarteFragment } from './CarteFragment'

test('inconnu : ni le nom ni le motif ne se lisent', () => {
  render(<CarteFragment nom="Avalon" image="https://x/a.png" etat="inconnu" />)
  expect(screen.getByText('???')).toBeInTheDocument()
  expect(screen.queryByText('Avalon')).toBeNull()
})

test('scanné : le nom et le nombre de scans', () => {
  render(<CarteFragment nom="Morrigan" image={null} etat="scanne" scans={3} />)
  expect(screen.getByText('Morrigan')).toBeInTheDocument()
  expect(screen.getByText('×3')).toBeInTheDocument()
})

test('porté : le nom et le check, sans compteur de scans', () => {
  render(<CarteFragment nom="Hoplite" image={null} etat="porte" scans={2} />)
  expect(screen.getByText('Hoplite')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'Porté' })).toBeInTheDocument()
  expect(screen.queryByText('×2')).toBeNull()
})

test('les marques « Nouveau » et d’édition', () => {
  render(
    <CarteFragment
      nom="Skjaldmö"
      image={null}
      etat="inconnu"
      nouveau
      edition="Exclusif Yggdrasil"
    />,
  )
  expect(screen.getByText('Nouveau')).toBeInTheDocument()
  expect(screen.getByText('Exclusif Yggdrasil')).toBeInTheDocument()
})
