import { describe, it, expect } from 'vitest'
import { companyImagePath } from './companyImageUpload'

describe('companyImagePath', () => {
  it('génère le chemin correct pour un companyId', () => {
    expect(companyImagePath('abc-123')).toBe('companies/abc-123.webp')
  })

  it('gère un UUID standard', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(companyImagePath(id)).toBe(`companies/${id}.webp`)
  })
})
