/**
 * QUOI     — où mène « fermer » un détail.
 * POURQUOI — le cas piège : l'app ouverte directement sur /carte/compte (lien partagé) n'a
 *            aucun historique ; « retour » quitterait l'app. Il faut alors remplacer par la racine.
 */
import { closeDetailTarget } from './closeDetail'

test('avec un historique dans l’app, fermer = retour arrière', () => {
  expect(closeDetailTarget({ pathname: '/carte/compte', hasInAppHistory: true })).toEqual({
    kind: 'back',
  })
})

test('ouvert à froid, fermer = remplacer par la racine de l’onglet', () => {
  expect(closeDetailTarget({ pathname: '/carte/compte', hasInAppHistory: false })).toEqual({
    kind: 'replace',
    to: '/carte',
  })
})

test('onglet illisible : repli sur l’Accueil', () => {
  expect(closeDetailTarget({ pathname: '/zzz/compte', hasInAppHistory: false })).toEqual({
    kind: 'replace',
    to: '/accueil',
  })
})
