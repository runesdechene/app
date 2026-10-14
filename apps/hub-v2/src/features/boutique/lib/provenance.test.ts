import { vi } from 'vitest'
import { envoyerParLots, etiquettesDeProvenance, preparerEtiquetage } from './provenance'

const client = (tags: string) => ({ id: 1, email: 'a@b.fr', tags, created_at: '2025-01-01T00:00:00Z' })

test('un joueur : source:app et app-player, ses étiquettes gardées (héritage compris)', () => {
  expect(etiquettesDeProvenance({ email: 'a@b.fr', client: 1, provenance: 'flyer' }, client('vip, heritage-vikings')))
    .toBe('vip, heritage-vikings, source:app, app-player')
})
test('un client de la boutique : source:shopify seule', () => {
  expect(etiquettesDeProvenance({ email: 'a@b.fr', client: 1, provenance: 'shopify' }, client(''))).toBe('source:shopify')
})
test('déjà une source, ou pas de client Shopify : on ne touche à rien', () => {
  expect(etiquettesDeProvenance({ email: 'a@b.fr', client: 1, provenance: 'app' }, client('source:stand'))).toBeNull()
  expect(etiquettesDeProvenance({ email: 'a@b.fr', client: 1, provenance: 'app' }, undefined)).toBeNull()
})
test('des lots de 25, les ignorés comptés', () => {
  const comptes = Array.from({ length: 30 }, (_, i) => ({ email: `${String(i)}@x.fr`, client: i, provenance: 'app' }))
  const clients = comptes.slice(0, 27).map((c) => ({ id: c.client, email: c.email, tags: '', created_at: '' }))
  const { lots, ignores } = preparerEtiquetage(comptes, clients)
  expect(lots.map((l) => l.length)).toEqual([25, 2])
  expect(ignores).toBe(3)
})
test('un lot en échec réseau compte ses clients en erreur et n’arrête pas les autres', async () => {
  const lot = (n: number) => Array.from({ length: n }, (_, i) => ({ customerId: i, email: `${String(i)}@x.fr`, tags: 'source:app' }))
  const envoyer = vi.fn().mockRejectedValueOnce(new Error('réseau')).mockResolvedValueOnce([{ email: '0@x.fr', success: true }])
  const fin = await envoyerParLots([lot(2), lot(1)], envoyer, () => undefined, 0)
  expect(fin).toEqual({ fait: 3, total: 3, erreursCompte: 2, erreurs: ['Lot 1 — erreur réseau : réseau'] })
  expect(envoyer).toHaveBeenCalledTimes(2)
})
test('un client refusé par Shopify est nommé', async () => {
  const envoyer = vi.fn().mockResolvedValue([{ email: 'a@b.fr', success: false, reason: 'Customer not found' }])
  const fin = await envoyerParLots([[{ customerId: 1, email: 'a@b.fr', tags: 'source:app' }]], envoyer, () => undefined, 0)
  expect(fin).toEqual({ fait: 1, total: 1, erreursCompte: 1, erreurs: ['a@b.fr — Customer not found'] })
})
