import { describe, expect, it } from 'vitest'
import { avisComplet, cheminDe, etapeAvisAffichee, HISTOIRE_VIDE, toiComplet, TOI_VIDE } from './formulaire'

const params = (texte: string) => new URLSearchParams(texte)

describe('cheminDe', () => {
  it('lit le chemin de l’adresse', () => {
    expect(cheminDe(params('chemin=avis'))).toBe('avis')
    expect(cheminDe(params('chemin=photos'))).toBe('photos')
  })

  it('un lien de mission déjà imprimé ouvre les photos', () => {
    expect(cheminDe(params('quete=hoplite'))).toBe('photos')
  })

  it('sans chemin valide, c’est l’écran du choix', () => {
    expect(cheminDe(params('chemin=bidon'))).toBeNull()
    expect(cheminDe(params(''))).toBeNull()
  })
})

describe('avisComplet', () => {
  it('demande un vêtement', () => {
    expect(avisComplet({ ...HISTOIRE_VIDE, noteProduits: 4 })).toBe(false)
  })

  it('demande une note ou quelques mots', () => {
    expect(avisComplet({ ...HISTOIRE_VIDE, vetement: 'sweatshirt' })).toBe(false)
    expect(avisComplet({ ...HISTOIRE_VIDE, vetement: 'sweatshirt', avis: '   ' })).toBe(false)
    expect(avisComplet({ ...HISTOIRE_VIDE, vetement: 'sweatshirt', noteProduits: 4 })).toBe(true)
    expect(avisComplet({ ...HISTOIRE_VIDE, vetement: 'sweatshirt', avis: 'Très doux' })).toBe(true)
  })
})

describe('etapeAvisAffichee', () => {
  it('n’ouvre pas « Toi » tant que l’avis est incomplet', () => {
    expect(etapeAvisAffichee('2', HISTOIRE_VIDE)).toBe(1)
    expect(etapeAvisAffichee('2', { ...HISTOIRE_VIDE, vetement: 'tshirt', noteExperience: 5 })).toBe(2)
    expect(etapeAvisAffichee(null, { ...HISTOIRE_VIDE, vetement: 'tshirt', noteExperience: 5 })).toBe(1)
  })
})

describe('toiComplet', () => {
  const claire = { ...TOI_VIDE, prenom: 'Claire', email: 'claire@exemple.fr' }

  it('un avis seul ne demande que le prénom et l’e-mail', () => {
    expect(toiComplet(claire, 'avis')).toBe(true)
  })

  it('les photos demandent aussi les deux accords', () => {
    expect(toiComplet(claire, 'photos')).toBe(false)
    expect(toiComplet({ ...claire, accordMarque: true, accordCompte: true }, 'photos')).toBe(true)
  })
})
