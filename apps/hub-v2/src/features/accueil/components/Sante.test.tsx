import { render, screen } from '@testing-library/react'
import { Sante } from './Sante'

const maintenant = new Date('2026-10-14T12:00:00Z')
const sante = { derniere_commande: '2026-10-14T10:00:00Z', notifications: 10, notifications_lues: 4 }
const il_y_a = (heures: number) => new Date(maintenant.getTime() - heures * 3600_000).toISOString()

type Boutique = Parameters<typeof Sante>[0]['boutique']
const arrivee: Boutique = { shopify: { ok: true, latence: 182, erreur: null }, shopifyErreur: null, fiches: il_y_a(5) }

function afficher(boutique: Boutique) {
  render(<Sante sante={sante} boutique={boutique} maintenant={maintenant} />)
}

function point(titre: string) {
  const ligne = screen.getByText(titre).closest('div')
  return ligne?.querySelector('span[data-ok]')?.getAttribute('data-ok')
}

test('Shopify joignable : point vert et la latence', () => {
  afficher(arrivee)
  expect(screen.getByText('Boutique joignable · 182 ms')).toBeInTheDocument()
  expect(point('Synchro Shopify')).toBe('true')
})

test('Shopify en panne : point orange et le message', () => {
  afficher({ ...arrivee, shopify: { ok: false, latence: 90, erreur: 'Shopify 401: Unauthorized' } })
  expect(screen.getByText('Shopify 401: Unauthorized')).toBeInTheDocument()
  expect(point('Synchro Shopify')).toBe('false')
})

test('fonction Netlify injoignable : point orange et le message', () => {
  afficher({ ...arrivee, shopify: undefined, shopifyErreur: 'Les fonctions Netlify ne répondent pas (HTTP 404).' })
  expect(screen.getByText('Les fonctions Netlify ne répondent pas (HTTP 404).')).toBeInTheDocument()
  expect(point('Synchro Shopify')).toBe('false')
})

test('fiches reconstruites il y a 5 h : vert', () => {
  afficher(arrivee)
  expect(screen.getByText('Reconstruites il y a 5 h')).toBeInTheDocument()
  expect(point('Fiches publiques')).toBe('true')
})

test('fiches reconstruites il y a 40 h : orange', () => {
  afficher({ ...arrivee, fiches: il_y_a(40) })
  expect(screen.getByText('Dernière reconstruction il y a 40 h')).toBeInTheDocument()
  expect(point('Fiches publiques')).toBe('false')
})

test('fiches jamais relevées : orange', () => {
  afficher({ ...arrivee, fiches: null })
  expect(screen.getByText('Jamais relevée')).toBeInTheDocument()
  expect(point('Fiches publiques')).toBe('false')
})

test('tant que les réponses ne sont pas arrivées, les lignes n’apparaissent pas', () => {
  afficher({ shopify: undefined, shopifyErreur: null, fiches: undefined })
  expect(screen.queryByText('Synchro Shopify')).not.toBeInTheDocument()
  expect(screen.queryByText('Fiches publiques')).not.toBeInTheDocument()
  expect(screen.getByText('Commandes Shopify')).toBeInTheDocument()
})
