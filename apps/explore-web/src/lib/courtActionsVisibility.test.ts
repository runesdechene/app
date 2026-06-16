import { describe, it, expect } from 'vitest'
import { getCourtActionsVisibility } from './courtActionsVisibility'

describe('getCourtActionsVisibility', () => {
  it('lieu vierge : seul le bouton "prendre/poser" est visible', () => {
    expect(getCourtActionsVisibility(true, 0)).toEqual({
      showSupport: false,
      showContest: true,
      showAttackers: false,
    })
  })

  it('lieu veillé sans attaquant : soutenir + prendre, pas de 3e bouton', () => {
    expect(getCourtActionsVisibility(false, 0)).toEqual({
      showSupport: true,
      showContest: true,
      showAttackers: false,
    })
  })

  it('lieu veillé avec au moins un attaquant : les trois boutons', () => {
    expect(getCourtActionsVisibility(false, 2)).toEqual({
      showSupport: true,
      showContest: true,
      showAttackers: true,
    })
  })

  it('un lieu vierge n\'affiche jamais le 3e bouton même si challengerCount > 0', () => {
    expect(getCourtActionsVisibility(true, 3).showAttackers).toBe(false)
  })
})
