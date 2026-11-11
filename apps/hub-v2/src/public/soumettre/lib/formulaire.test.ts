import { describe, expect, it } from 'vitest'
import { avisComplet, etapeAffichee, HISTOIRE_VIDE, toiComplet, TOI_VIDE, type Contenu } from './formulaire'

const AVIS = { ...HISTOIRE_VIDE, vetement: 'tshirt', noteExperience: 5 }
const contenu = (taille: string | null): Contenu => ({ fichier: new File(['x'], 'a.jpg'), apercu: 'blob:a', taille })

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

describe('etapeAffichee : 1 ton avis, 2 tes photos, 3 les tailles, 4 toi', () => {
  it('rien n’ouvre tant que l’avis est incomplet', () => {
    expect(etapeAffichee('4', HISTOIRE_VIDE, [])).toBe(1)
  })

  it('sans photo, on passe des photos à « Toi » ; les tailles ne s’ouvrent pas', () => {
    expect(etapeAffichee('2', AVIS, [])).toBe(2)
    expect(etapeAffichee('3', AVIS, [])).toBe(2)
    expect(etapeAffichee('4', AVIS, [])).toBe(4)
  })

  it('avec une photo sans taille, « Toi » attend les tailles', () => {
    expect(etapeAffichee('4', AVIS, [contenu(null)])).toBe(3)
    expect(etapeAffichee('4', AVIS, [contenu('M')])).toBe(4)
  })

  it('une étape absente ou fantaisiste ouvre le début', () => {
    expect(etapeAffichee(null, AVIS, [])).toBe(1)
    expect(etapeAffichee('9', AVIS, [])).toBe(1)
  })
})

describe('toiComplet', () => {
  const claire = { ...TOI_VIDE, prenom: 'Claire', email: 'claire@exemple.fr' }

  it('sans photo, le prénom et l’e-mail suffisent', () => {
    expect(toiComplet(claire, false)).toBe(true)
  })

  it('avec des photos, il faut aussi les deux accords', () => {
    expect(toiComplet(claire, true)).toBe(false)
    expect(toiComplet({ ...claire, accordMarque: true, accordCompte: true }, true)).toBe(true)
  })
})
