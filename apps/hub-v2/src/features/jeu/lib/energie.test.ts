import { DEFAUTS, depuisLignes, erreurReglages, resume, versLignes, type Reglages } from './energie'

const avec = (changes: Partial<Reglages>): Reglages => ({ ...DEFAUTS, ...changes })

test('les réglages par défaut sont valides', () => {
  expect(erreurReglages(DEFAUTS)).toBeNull()
})

test('chaque valeur est un entier positif ou nul', () => {
  const message = 'Chaque valeur doit être un nombre entier positif.'
  expect(erreurReglages(avec({ cout1: -1 }))).toBe(message)
  expect(erreurReglages(avec({ gratuitKm: 1.5 }))).toBe(message)
  expect(erreurReglages(avec({ palier3Km: Number.NaN }))).toBe(message)
})

test('la jauge compte au moins un point', () => {
  expect(erreurReglages(avec({ maxSansFragment: 0 }))).toBe('La jauge doit compter au moins 1 point.')
})

test('un point met au moins dix minutes à revenir', () => {
  expect(erreurReglages(avec({ minutesParPoint: 9 }))).toBe('Un point ne peut pas revenir en moins de 10 minutes.')
  expect(erreurReglages(avec({ minutesParPoint: 10 }))).toBeNull()
})

test('les bornes hautes : acceptées pile, refusées au-dessus', () => {
  expect(erreurReglages(avec({ maxSansFragment: 1000 }))).toBeNull()
  expect(erreurReglages(avec({ maxSansFragment: 1001 }))).toBe('La jauge ne dépasse pas 1000 points.')
  expect(erreurReglages(avec({ minutesParPoint: 1440 }))).toBeNull()
  expect(erreurReglages(avec({ minutesParPoint: 1441 }))).toBe('Un point se recharge en 24 h au plus.')
  expect(erreurReglages(avec({ palier3Km: 20000 }))).toBeNull()
  expect(erreurReglages(avec({ palier3Km: 20001 }))).toBe('Une distance ne dépasse pas 20 000 km.')
  expect(erreurReglages(avec({ cout4: 1000 }))).toBeNull()
  expect(erreurReglages(avec({ cout4: 1001 }))).toBe('Un coût ne dépasse pas 1000 points.')
})

test('les distances vont croissant', () => {
  const message = 'Les distances doivent aller croissant : zone gratuite, puis palier 1, 2, 3.'
  expect(erreurReglages(avec({ gratuitKm: 150 }))).toBe(message)
  expect(erreurReglages(avec({ palier2Km: 150 }))).toBe(message)
  expect(erreurReglages(avec({ palier3Km: 400 }))).toBe(message)
})

test('plus un lieu est loin, plus il coûte', () => {
  const message = 'Plus un lieu est loin, plus il coûte : prix 1 ≤ 2 ≤ 3 ≤ au-delà.'
  expect(erreurReglages(avec({ cout2: 0 }))).toBe(message)
  expect(erreurReglages(avec({ cout4: 2 }))).toBe(message)
  expect(erreurReglages(avec({ cout1: 2, cout2: 2 }))).toBeNull()
})

test('versLignes(depuisLignes(x)) rend x, le cycle passant des minutes aux secondes', () => {
  const reglages = avec({ maxSansFragment: 12, minutesParPoint: 45, cout4: 7 })
  const lignes = versLignes(reglages)
  expect(lignes).toHaveLength(10)
  expect(lignes).toContainEqual({ key: 'energy_base_cycle', value: '2700' })
  expect(lignes).toContainEqual({ key: 'default_max_energy', value: '12' })
  expect(depuisLignes(lignes)).toEqual(reglages)
})

test('une clé absente ou illisible reprend sa valeur par défaut', () => {
  expect(depuisLignes([])).toEqual(DEFAUTS)
  expect(depuisLignes([{ key: 'decouverte_cout_1', value: 'beaucoup' }, { key: 'decouverte_cout_2', value: '5' }]))
    .toEqual(avec({ cout2: 5 }))
})

test('le résumé dit la règle, au pluriel quand il faut', () => {
  expect(resume(DEFAUTS)).toBe(
    'Gratuit jusqu’à 50 km, puis 1 point jusqu’à 150 km, 2 points jusqu’à 500 km, 3 points jusqu’à 1000 km, '
    + '4 points au-delà. Sans position, un lieu coûte le prix « Au-delà ».',
  )
})
