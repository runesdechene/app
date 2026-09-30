import { describe, expect, it } from 'vitest'
import { doitAllerSurV2, versionChoisie, wantsV2 } from './v2Access'

describe('wantsV2', () => {
  it('reconnaît ?v=2', () => {
    expect(wantsV2('?v=2')).toBe(true)
    expect(wantsV2('?company=12&v=2')).toBe(true)
  })

  it('ignore tout le reste', () => {
    expect(wantsV2('')).toBe(false)
    expect(wantsV2('?v=1')).toBe(false)
    expect(wantsV2('?version=2')).toBe(false)
  })
})

describe('versionChoisie', () => {
  it('lit le cookie parmi les autres', () => {
    expect(versionChoisie('a=1; explore_version=v2; b=2')).toBe('v2')
    expect(versionChoisie('explore_version=v1')).toBe('v1')
  })

  it('rien de choisi, ou une valeur inconnue : null', () => {
    expect(versionChoisie('')).toBeNull()
    expect(versionChoisie('explore_version=v3')).toBeNull()
  })
})

describe('doitAllerSurV2', () => {
  const ici = { search: '', hash: '' }

  it('seulement si le joueur a choisi la V2', () => {
    expect(doitAllerSurV2('explore_version=v2', ici)).toBe(true)
    expect(doitAllerSurV2('explore_version=v1', ici)).toBe(false)
    expect(doitAllerSurV2('', ici)).toBe(false)
  })

  it('un retour de connexion reste sur la V1', () => {
    expect(doitAllerSurV2('explore_version=v2', { search: '', hash: '#access_token=x' })).toBe(false)
    expect(doitAllerSurV2('explore_version=v2', { search: '?code=abc', hash: '' })).toBe(false)
    expect(doitAllerSurV2('explore_version=v2', { search: '', hash: '#type=recovery' })).toBe(false)
  })

  it('les autres paramètres ne retiennent pas', () => {
    expect(doitAllerSurV2('explore_version=v2', { search: '?company=12', hash: '' })).toBe(true)
  })
})
