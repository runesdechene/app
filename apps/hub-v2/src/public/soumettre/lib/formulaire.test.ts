import { describe, expect, it } from 'vitest'
import { avisComplet, cheminDe, ecranAffiche, etapeDeLaFrise, HISTOIRE_VIDE, numeroDeLEcran, toiComplet, TOI_VIDE, type Contenu } from './formulaire'

const params = (texte: string) => new URLSearchParams(texte)
const AVIS = { ...HISTOIRE_VIDE, vetement: 'tshirt', noteExperience: 5 }
const contenu = (taille: string | null): Contenu => ({ fichier: new File(['x'], 'a.jpg'), apercu: 'blob:a', taille })

describe('cheminDe', () => {
  it('lit le chemin de l’adresse', () => {
    expect(cheminDe(params('chemin=avis'))).toBe('avis')
    expect(cheminDe(params('chemin=photos'))).toBe('photos')
  })

  it('un lien de mission déjà imprimé ouvre les photos', () => {
    expect(cheminDe(params('quete=hoplite'))).toBe('photos')
  })

  it('sans chemin valide, c’est l’étape du choix', () => {
    expect(cheminDe(params('chemin=bidon'))).toBeNull()
    expect(cheminDe(params(''))).toBeNull()
  })
})

describe('avisComplet', () => {
  it('demande un vêtement, et une note ou quelques mots', () => {
    expect(avisComplet({ ...HISTOIRE_VIDE, noteProduits: 4 })).toBe(false)
    expect(avisComplet({ ...HISTOIRE_VIDE, vetement: 'sweatshirt', avis: '   ' })).toBe(false)
    expect(avisComplet({ ...HISTOIRE_VIDE, vetement: 'sweatshirt', noteProduits: 4 })).toBe(true)
    expect(avisComplet({ ...HISTOIRE_VIDE, vetement: 'sweatshirt', avis: 'Très doux' })).toBe(true)
  })
})

describe('ecranAffiche : un avis', () => {
  it('rien n’ouvre tant que l’avis est incomplet', () => {
    expect(ecranAffiche('avis', '5', HISTOIRE_VIDE, [])).toBe('avis')
  })

  it('les photos sont facultatives : sans photo, on va des photos à « Toi »', () => {
    expect(ecranAffiche('avis', '3', AVIS, [])).toBe('photos')
    expect(ecranAffiche('avis', '4', AVIS, [])).toBe('photos')
    expect(ecranAffiche('avis', '5', AVIS, [])).toBe('toi')
  })

  it('avec une photo sans taille, « Toi » attend les tailles', () => {
    expect(ecranAffiche('avis', '5', AVIS, [contenu(null)])).toBe('tailles')
    expect(ecranAffiche('avis', '5', AVIS, [contenu('M')])).toBe('toi')
  })
})

describe('ecranAffiche : des photos', () => {
  it('rien n’ouvre sans une photo', () => {
    expect(ecranAffiche('photos', '5', HISTOIRE_VIDE, [])).toBe('photos')
  })

  it('l’avis est facultatif une fois les tailles posées', () => {
    expect(ecranAffiche('photos', '4', HISTOIRE_VIDE, [contenu(null)])).toBe('tailles')
    expect(ecranAffiche('photos', '4', HISTOIRE_VIDE, [contenu('M')])).toBe('avis')
    expect(ecranAffiche('photos', '5', HISTOIRE_VIDE, [contenu('M')])).toBe('toi')
  })

  it('une étape absente ou fantaisiste ouvre le début du chemin', () => {
    expect(ecranAffiche('photos', null, HISTOIRE_VIDE, [])).toBe('photos')
    expect(ecranAffiche('photos', '9', HISTOIRE_VIDE, [contenu('M')])).toBe('photos')
  })
})

describe('la frise et l’adresse', () => {
  it('le choix est l’étape 1 ; les tailles comptent avec les photos', () => {
    expect(etapeDeLaFrise('avis', 'avis')).toBe(2)
    expect(etapeDeLaFrise('avis', 'tailles')).toBe(3)
    expect(etapeDeLaFrise('photos', 'tailles')).toBe(2)
    expect(etapeDeLaFrise('photos', 'avis')).toBe(3)
    expect(etapeDeLaFrise('photos', 'toi')).toBe(4)
  })

  it('le numéro dans l’adresse suit l’ordre du chemin, le choix valant 1', () => {
    expect(numeroDeLEcran('avis', 'avis')).toBe(2)
    expect(numeroDeLEcran('photos', 'tailles')).toBe(3)
    expect(numeroDeLEcran('photos', 'toi')).toBe(5)
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
