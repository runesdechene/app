import { describe, it, expect, beforeEach, vi } from 'vitest'
import { classifyRpc, fakeResponse, wrapSupabaseForDemo, FAKED_WRITES, OVERRIDDEN_READS } from './demoSupabase'
import { useDemoStore } from '../../stores/demoStore'

describe('classifyRpc', () => {
  it('classe les écritures faked', () => {
    expect(classifyRpc('discover_place')).toBe('faked')
    expect(classifyRpc('answer_enigma')).toBe('faked')
    expect(classifyRpc('invest_crowns')).toBe('faked')
  })
  it('classe les lectures', () => {
    expect(classifyRpc('get_map_places')).toBe('read')
    expect(classifyRpc('list_something')).toBe('read')
  })
  it('classe toute écriture inconnue comme blocked', () => {
    expect(classifyRpc('plant_flag')).toBe('blocked')
    expect(classifyRpc('mute_user')).toBe('blocked')
    expect(classifyRpc('send_chat_message')).toBe('blocked')
  })
})

describe('fakeResponse', () => {
  beforeEach(() => { useDemoStore.getState().reset() })

  it('discover_place ajoute la découverte et renvoie un succès sans error', () => {
    const r = fakeResponse('discover_place', { p_place_id: 'place-9' })
    expect(r.error).toBeNull()
    expect(useDemoStore.getState().discoveredIds.has('place-9')).toBe(true)
  })

  it('answer_enigma renvoie toujours un succès (pas de champ error)', () => {
    const r = fakeResponse('answer_enigma', { p_enigma_id: 'e1' }) as { data: any }
    expect(r.data.error).toBeUndefined()
    expect(r.data.correct).toBe(true)
  })
})

describe('lectures ∞ overridées', () => {
  beforeEach(() => { useDemoStore.getState().reset() })

  it('get_user_energy renvoie une jauge pleine', () => {
    const { data } = fakeResponse('get_user_energy', {}) as { data: any }
    expect(data.energy).toBe(data.maxEnergy)
    expect(data.nextPointIn).toBe(0)
  })

  it('get_my_crowns_state renvoie balance infinie et capped=false', () => {
    const { data } = fakeResponse('get_my_crowns_state', {}) as { data: any }
    expect(data.balance).toBe(Infinity)
    expect(data.capped).toBe(false)
    expect(Array.isArray(data.harvestable)).toBe(true)
  })

  it('get_user_energy est classé faked (pas read)', () => {
    expect(classifyRpc('get_user_energy')).toBe('faked')
  })
})

describe('wrapSupabaseForDemo', () => {
  beforeEach(() => { useDemoStore.getState().reset() })

  it('une écriture faked ne touche jamais le client réel', async () => {
    const realRpc = vi.fn()
    const client = { rpc: realRpc, from: vi.fn() }
    const wrapped = wrapSupabaseForDemo(client)
    const { error } = await wrapped.rpc('discover_place', { p_place_id: 'x' })
    expect(error).toBeNull()
    expect(realRpc).not.toHaveBeenCalled()
  })

  it('une écriture bloquée ne touche jamais le client réel', async () => {
    const realRpc = vi.fn()
    const wrapped = wrapSupabaseForDemo({ rpc: realRpc })
    await wrapped.rpc('plant_flag', {})
    expect(realRpc).not.toHaveBeenCalled()
  })

  it('une lecture passe au client réel', () => {
    const builder = {}
    const realRpc = vi.fn().mockReturnValue(builder)
    const wrapped = wrapSupabaseForDemo({ rpc: realRpc })
    const out = wrapped.rpc('get_map_places', { p_type: 'all' })
    expect(realRpc).toHaveBeenCalledWith('get_map_places', { p_type: 'all' })
    expect(out).toBe(builder)
  })
})
