import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { categoryOf } from './categories.ts'
import { formatPayload } from './payloads.ts'

Deno.test('un mot sur un lieu ouvre la fiche du lieu', () => {
  const p = formatPayload('new_comment', { actorName: 'Luna', placeTitle: 'Château de Joux', placeId: 'p1' })
  assertEquals(p?.title, 'Luna a commenté Château de Joux')
  assertEquals(p?.url, '/accueil/lieu/p1')
})

Deno.test('sans nom ni lieu, des replis sobres', () => {
  const p = formatPayload('new_comment', {})
  assertEquals(p?.title, 'Quelqu’un a commenté un de tes lieux')
  assertEquals(p?.url, '/accueil')
})

Deno.test('une mention ouvre les Messages', () => {
  const p = formatPayload('mention', { actorName: 'Luna', extrait: 'On y va samedi ?' })
  assertEquals(p?.title, 'Luna t’a mentionné')
  assertEquals(p?.body, 'On y va samedi ?')
  assertEquals(p?.url, '/messages')
})

Deno.test('un salut de message ouvre les Messages, un salut de visite le lieu', () => {
  assertEquals(formatPayload('salut', { evenement: 'message:42' })?.url, '/messages')
  assertEquals(formatPayload('salut', { evenement: 'visite:p1:u2', placeId: 'p1' })?.url, '/accueil/lieu/p1')
})

Deno.test('une demande pour une Compagnie ouvre sa page de gestion', () => {
  const p = formatPayload('demande_compagnie', { actorName: 'Rémy', compagnieId: 'f1', compagnieNom: 'Le Lys de Fer' })
  assertEquals(p?.title, 'Rémy demande à rejoindre Le Lys de Fer')
  assertEquals(p?.url, '/accueil/compagnie/f1/gerer')
})

Deno.test('une Nouveauté ouvre la page Nouveautés', () => {
  const p = formatPayload('mise_a_jour', { titre: 'Ton Passeport d’Explorateur' })
  assertEquals(p?.body, 'Ton Passeport d’Explorateur')
  assertEquals(p?.url, '/accueil/nouveautes')
})

Deno.test('les types de la V1 se taisent', () => {
  for (const type of ['daily_enigma_ready', 'expedition_message', 'place_taken_remote', 'announcement']) {
    assertEquals(categoryOf(type), 'silent')
    assertEquals(formatPayload(type, {}), null)
  }
  assertEquals(categoryOf('milestone_vues'), 'recap')
  assertEquals(categoryOf('mention'), 'important')
})

Deno.test('les notifications ajoutées le 08/10 (mig 464) partent, avec leur écran', () => {
  for (const type of ['visite', 'revendication_reprise', 'nouveau_membre', 'enigme_du_jour']) {
    assertEquals(categoryOf(type), 'important')
  }
  assertEquals(formatPayload('visite', { actorName: 'Kelpie', placeTitle: 'Montmajour', placeId: 'p1' })?.url, '/accueil/lieu/p1')
  assertEquals(formatPayload('revendication_reprise', { actorName: 'Kelpie', placeTitle: 'Montmajour', placeId: 'p1' })?.title, 'Kelpie a revendiqué Montmajour')
  assertEquals(formatPayload('nouveau_membre', { actorName: 'Kelpie', compagnieId: 'c1', compagnieNom: 'Les Arpenteurs' })?.url, '/accueil/compagnie/c1')
  assertEquals(formatPayload('enigme_du_jour', {})?.url, '/carte')
})

Deno.test('une réponse d’énigme acceptée part et ouvre « Les énigmes » (mig 473)', () => {
  assertEquals(categoryOf('enigme_acceptee'), 'important')
  const p = formatPayload('enigme_acceptee', { extrait: 'n° 287' })
  assertEquals(p?.title, 'Ta réponse est acceptée')
  assertEquals(p?.body, 'Énigme n° 287 : ton point t’est rendu.')
  assertEquals(p?.url, '/accueil/enigmes')
})
