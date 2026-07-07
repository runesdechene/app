import { describe, it, expect, beforeEach, vi } from 'vitest'
import { classifyRpc, fakeResponse, wrapSupabaseForDemo, FAKED_WRITES, OVERRIDDEN_READS, validatedEnigmaResponse } from './demoSupabase'
import { useDemoStore } from '../../stores/demoStore'
import { getCached, setCached } from './demoReadCache'

describe('classifyRpc', () => {
  it('classe les écritures faked', () => {
    expect(classifyRpc('discover_place')).toBe('faked')
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

describe('classifyRpc — validated', () => {
  it('classe answer_enigma / answer_fragment_enigma comme validated', () => {
    expect(classifyRpc('answer_enigma')).toBe('validated')
    expect(classifyRpc('answer_fragment_enigma')).toBe('validated')
  })
})

describe('validatedEnigmaResponse', () => {
  beforeEach(() => { useDemoStore.getState().reset() })

  it('bonne réponse : renvoie correct/answer/explanation réels + incrémente la Gloire', async () => {
    const realRpc = vi.fn().mockResolvedValue({
      data: { correct: true, answer: 'Durin', explanation: 'Roi nain.', difficulty: 'medium' },
      error: null,
    })
    const gloryBefore = useDemoStore.getState().glory
    const { data, error } = await validatedEnigmaResponse(realRpc, { p_enigma_id: 5, p_answer: 'durin' }) as { data: any; error: any }
    expect(error).toBeNull()
    expect(realRpc).toHaveBeenCalledWith('check_enigma_answer', { p_enigma_id: 5, p_answer: 'durin' })
    expect(data.correct).toBe(true)
    expect(data.explanation).toBe('Roi nain.')
    expect(data.crownsGain).toBe(2) // medium
    expect(data.newCrownsBalance).toBe(Infinity)
    expect(useDemoStore.getState().glory).toBe(gloryBefore + 1)
  })

  it('mauvaise réponse : correct=false mais explication présente', async () => {
    const realRpc = vi.fn().mockResolvedValue({
      data: { correct: false, answer: 'Durin', explanation: 'Roi nain.', difficulty: 'easy' },
      error: null,
    })
    const { data } = await validatedEnigmaResponse(realRpc, { p_enigma_id: 5, p_answer: 'nope' }) as { data: any }
    expect(data.correct).toBe(false)
    expect(data.explanation).toBe('Roi nain.')
    expect(data.crownsGain).toBe(1) // easy
  })
})

describe('wrapSupabaseForDemo — answer_enigma validé', () => {
  beforeEach(() => { useDemoStore.getState().reset() })

  it('route vers check_enigma_answer, jamais vers answer_enigma réel', async () => {
    const realRpc = vi.fn().mockResolvedValue({
      data: { correct: true, answer: 'X', explanation: 'Y', difficulty: 'hard' },
      error: null,
    })
    const wrapped = wrapSupabaseForDemo({ rpc: realRpc, from: vi.fn(), storage: { from: vi.fn() } })
    const { data } = await wrapped.rpc('answer_enigma', { p_enigma_id: 9, p_answer: 'x' }) as { data: any }
    expect(realRpc).toHaveBeenCalledWith('check_enigma_answer', { p_enigma_id: 9, p_answer: 'x' })
    expect(realRpc).not.toHaveBeenCalledWith('answer_enigma', expect.anything())
    expect(data.correct).toBe(true)
    expect(data.crownsGain).toBe(3) // hard
  })
})

describe('fakeResponse', () => {
  beforeEach(() => { useDemoStore.getState().reset() })

  it('discover_place ajoute la découverte et renvoie un succès sans error', () => {
    const r = fakeResponse('discover_place', { p_place_id: 'place-9' })
    expect(r.error).toBeNull()
    expect(useDemoStore.getState().discoveredIds.has('place-9')).toBe(true)
  })

  // FIX 3: default branch throws for unknown names
  it('default branch throws for unknown rpc names', () => {
    expect(() => fakeResponse('unknown_rpc_xyz', {})).toThrow('[demo] fakeResponse called for unknown name: unknown_rpc_xyz')
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

describe('wrapSupabaseForDemo — rpc', () => {
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

  it('une lecture non-cacheable passe au client réel (synchrone)', () => {
    const builder = {}
    const realRpc = vi.fn().mockReturnValue(builder)
    const wrapped = wrapSupabaseForDemo({ rpc: realRpc })
    // list_places is not in CACHEABLE_READS → must be returned synchronously
    const out = wrapped.rpc('list_places', { p_type: 'all' })
    expect(realRpc).toHaveBeenCalledWith('list_places', { p_type: 'all' })
    expect(out).toBe(builder)
  })
})

// FIX 1 — from() intercept
describe('wrapSupabaseForDemo — from(table)', () => {
  let insertSpy: ReturnType<typeof vi.fn>
  let selectSpy: ReturnType<typeof vi.fn>
  let fakeBuilder: any
  let client: any
  let wrapped: any

  beforeEach(() => {
    useDemoStore.getState().reset()
    insertSpy = vi.fn().mockResolvedValue({ data: [{}], error: null })
    selectSpy = vi.fn().mockReturnValue({ data: [{}], error: null })
    fakeBuilder = {
      insert: insertSpy,
      select: selectSpy,
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    }
    client = {
      rpc: vi.fn(),
      from: vi.fn().mockReturnValue(fakeBuilder),
      storage: { from: vi.fn() },
    }
    wrapped = wrapSupabaseForDemo(client)
  })

  it('insert() no-ops: resolves { data: null, error: null }, real insert NOT called', async () => {
    const result = await wrapped.from('places_viewed').insert({ place_id: 'x' })
    expect(result).toEqual({ data: null, error: null })
    expect(insertSpy).not.toHaveBeenCalled()
  })

  it('insert().select() is chainable and still resolves { data: null, error: null }', async () => {
    const result = await wrapped.from('places_viewed').insert({ place_id: 'x' }).select()
    expect(result).toEqual({ data: null, error: null })
  })

  it('select() delegates to real builder', () => {
    wrapped.from('places').select('*')
    expect(selectSpy).toHaveBeenCalledWith('*')
  })
})

// FIX 1 — storage intercept
describe('wrapSupabaseForDemo — storage', () => {
  let uploadSpy: ReturnType<typeof vi.fn>
  let getPublicUrlSpy: ReturnType<typeof vi.fn>
  let fakeFileApi: any
  let client: any
  let wrapped: any

  beforeEach(() => {
    uploadSpy = vi.fn().mockResolvedValue({ data: { path: 'p' }, error: null })
    getPublicUrlSpy = vi.fn().mockReturnValue({ data: { publicUrl: 'http://example.com/p' } })
    fakeFileApi = {
      upload: uploadSpy,
      update: vi.fn(),
      remove: vi.fn(),
      move: vi.fn(),
      copy: vi.fn(),
      createSignedUploadUrl: vi.fn(),
      download: vi.fn(),
      list: vi.fn(),
      getPublicUrl: getPublicUrlSpy,
      createSignedUrl: vi.fn(),
      createSignedUrls: vi.fn(),
    }
    client = {
      rpc: vi.fn(),
      from: vi.fn(),
      storage: { from: vi.fn().mockReturnValue(fakeFileApi) },
    }
    wrapped = wrapSupabaseForDemo(client)
  })

  it('storage.from().upload() resolves { data: { path }, error: null }, real upload NOT called', async () => {
    const result = await wrapped.storage.from('place-images').upload('mypath', new Blob())
    expect(result).toEqual({ data: { path: 'mypath' }, error: null })
    expect(uploadSpy).not.toHaveBeenCalled()
  })

  it('storage.from().getPublicUrl() delegates to real file API (sync)', () => {
    wrapped.storage.from('place-images').getPublicUrl('mypath')
    expect(getPublicUrlSpy).toHaveBeenCalledWith('mypath')
  })
})

// FIX 2 — cache live reads
describe('wrapSupabaseForDemo — cache live (FIX 2)', () => {
  beforeEach(() => {
    useDemoStore.getState().reset()
    // Clear cache using the sentinel
    setCached('__reset__', null, undefined as any)
  })

  it('cacheable read success: writes through to cache', async () => {
    const freshData = [{ id: 1 }]
    const realRpc = vi.fn().mockResolvedValue({ data: freshData, error: null })
    const wrapped = wrapSupabaseForDemo({ rpc: realRpc, from: vi.fn(), storage: { from: vi.fn() } })
    await wrapped.rpc('get_map_places', { p_type: 'all' })
    expect(getCached('get_map_places', { p_type: 'all' })).toEqual(freshData)
  })

  it('cacheable read failure: returns cached value when realRpc rejects', async () => {
    const cachedData = [{ id: 42 }]
    setCached('get_map_places', { p_type: 'all' }, cachedData)
    const realRpc = vi.fn().mockRejectedValue(new Error('network error'))
    const wrapped = wrapSupabaseForDemo({ rpc: realRpc, from: vi.fn(), storage: { from: vi.fn() } })
    const result = await wrapped.rpc('get_map_places', { p_type: 'all' })
    expect(result).toEqual({ data: cachedData, error: null })
  })
})
