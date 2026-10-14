import type { Activite } from '../api/fil'
import { phraseDuFil } from './phraseDuFil'

const luna = { id: 'u1', nom: 'Luna', avatar: null }
const dolmen = { id: 'p1', nom: 'Dolmen de la Pierre Levée', departement: 'Aude' }
const base = { quand: '2026-10-14T09:02:00Z', qui: luna, lieu: null, donnees: {} }

test('un lieu ajouté, pas encore vérifié', () => {
  const a: Activite = { ...base, type: 'lieu', sorte: 'ajout', lieu: dolmen, donnees: { verifie: false, masque: false } }
  expect(phraseDuFil(a)).toEqual({ titre: 'Luna a ajouté « Dolmen de la Pierre Levée »', detail: 'En attente de modération' })
})

test('une inscription par flyer, cliente validée', () => {
  const a: Activite = { ...base, type: 'compte', sorte: 'inscription', donnees: { provenance: 'flyer', client: true } }
  expect(phraseDuFil(a)).toEqual({ titre: 'Luna s’est inscrit', detail: 'Arrivé par un flyer · client validé' })
})

test('une énigme percée au deuxième essai', () => {
  const a: Activite = { ...base, type: 'enigme', sorte: 'percee', donnees: { enigme: 242, culture: 'Celte', essai: 2 } }
  expect(phraseDuFil(a)).toEqual({ titre: 'Luna a percé l’énigme n° 242', detail: 'Culture Celte · juste au 2e essai' })
})

test('un compte supprimé : « Un Voyageur », jamais de plantage', () => {
  const a: Activite = { ...base, type: 'visite', sorte: 'sur_place', qui: null, lieu: dolmen, donnees: { premiere: true } }
  expect(phraseDuFil(a).titre).toBe('Un Voyageur a posé sa marque à « Dolmen de la Pierre Levée »')
})

test('un lieu disparu : la phrase tient sans le lieu', () => {
  const a: Activite = { ...base, type: 'lieu', sorte: 'modification', lieu: null, donnees: {} }
  expect(phraseDuFil(a).titre).toBe('Luna a modifié un lieu')
})

test('une notification regroupée', () => {
  const a: Activite = { ...base, type: 'notification', sorte: 'daily_enigma', qui: null, donnees: { envoyees: 412, lues: 61 } }
  expect(phraseDuFil(a)).toEqual({ titre: 'Notification « daily_enigma » envoyée', detail: '412 destinataires · 61 l’ont lue' })
})
