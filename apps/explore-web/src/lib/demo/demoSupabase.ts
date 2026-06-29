import { useDemoStore } from '../../stores/demoStore'

export const FAKED_WRITES: ReadonlySet<string> = new Set([
  'discover_place',
  'answer_enigma',
  'answer_fragment_enigma',
  'invest_crowns',
  'harvest_crown',
])

export const OVERRIDDEN_READS: ReadonlySet<string> = new Set([
  'get_user_energy',
  'get_my_crowns_state',
  'get_player_profile',
])

const READ_PREFIXES = ['get_', 'list_', 'fetch_']

export function classifyRpc(name: string): 'read' | 'faked' | 'blocked' {
  if (FAKED_WRITES.has(name) || OVERRIDDEN_READS.has(name)) return 'faked'
  if (READ_PREFIXES.some((p) => name.startsWith(p))) return 'read'
  return 'blocked'
}

export function fakeResponse(
  name: string,
  args: Record<string, unknown>,
): { data: unknown; error: null } {
  const demo = useDemoStore.getState()
  switch (name) {
    case 'discover_place': {
      const placeId = String(args.p_place_id ?? '')
      if (placeId) demo.addDiscovered(placeId)
      demo.addGlory(1)
      return {
        data: { crownsGain: 0, questBonus: 0, newCrownsBalance: Infinity },
        error: null,
      }
    }
    case 'answer_enigma':
    case 'answer_fragment_enigma':
      demo.addGlory(1)
      return {
        data: { correct: true, influenceGain: 1, eruditionGain: 1, newCrownsBalance: Infinity },
        error: null,
      }
    case 'invest_crowns':
      return { data: { success: true, newCrownsBalance: Infinity }, error: null }
    case 'harvest_crown':
      return { data: { success: true, balance: Infinity }, error: null }
    case 'get_user_energy': {
      const { energy, maxEnergy } = useDemoStore.getState()
      return { data: { energy, maxEnergy, nextPointIn: 0, energyCycle: 0 }, error: null }
    }
    case 'get_my_crowns_state':
      return { data: { balance: Infinity, capped: false, harvestable: [] }, error: null }
    case 'get_player_profile': {
      const { glory } = useDemoStore.getState()
      return {
        data: { level: 1, xp_total: glory, glory, conquest_points: glory, veteran_first_era: false },
        error: null,
      }
    }
    default:
      return { data: { success: true }, error: null }
  }
}

/** No-op pour les écritures bloquées : rien ne part au réseau. */
function blockedResponse(name: string): { data: null; error: null } {
  if (import.meta.env.DEV) console.info(`[demo] écriture bloquée (no-op) : ${name}`)
  return { data: null, error: null }
}

export function wrapSupabaseForDemo<T extends { rpc: (...a: any[]) => any }>(client: T): T {
  const realRpc = client.rpc.bind(client)
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'rpc') {
        return (name: string, args: Record<string, unknown> = {}) => {
          const kind = classifyRpc(name)
          if (kind === 'read') return realRpc(name, args)
          if (kind === 'faked') return Promise.resolve(fakeResponse(name, args))
          return Promise.resolve(blockedResponse(name))
        }
      }
      return Reflect.get(target, prop, receiver)
    },
  }) as T
}
