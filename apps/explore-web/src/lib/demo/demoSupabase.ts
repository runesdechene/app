import { useDemoStore } from '../../stores/demoStore'
import { CACHEABLE_READS, getCached, setCached } from './demoReadCache'

export const FAKED_WRITES: ReadonlySet<string> = new Set([
  'discover_place',
  'invest_crowns',
  'harvest_crown',
])

export const VALIDATED_WRITES: ReadonlySet<string> = new Set([
  'answer_enigma',
  'answer_fragment_enigma',
])

const CROWNS_BY_DIFFICULTY: Record<string, number> = {
  very_easy: 1, easy: 1, medium: 2, hard: 3,
}

// NB : get_player_profile N'EST PAS overridé — on le laisse passer en lecture
// réelle pour que la modale profil ait un objet complet (nom, titres, bio…).
// Le compte démo est un vrai compte vierge (niveau 1) ; la Gloire de session
// reste visible via les toasts. Faker un profil partiel cassait l'ouverture.
export const OVERRIDDEN_READS: ReadonlySet<string> = new Set([
  'get_user_energy',
  'get_my_crowns_state',
])

const READ_PREFIXES = ['get_', 'list_', 'fetch_']

// Lectures réelles dont le nom ne porte aucun préfixe reconnu. Liste nominative
// et pas un préfixe `preview_` : une future RPC ainsi nommée pourrait écrire, et
// l'invariant de la borne est zéro écriture.
export const EXTRA_READS: ReadonlySet<string> = new Set([
  'preview_action_cost',
])

export function classifyRpc(name: string): 'read' | 'faked' | 'validated' | 'blocked' {
  if (VALIDATED_WRITES.has(name)) return 'validated'
  if (FAKED_WRITES.has(name) || OVERRIDDEN_READS.has(name)) return 'faked'
  if (EXTRA_READS.has(name)) return 'read'
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
    // FIX 3: unknown name → loud error rather than silent success
    default:
      throw new Error(`[demo] fakeResponse called for unknown name: ${name}`)
  }
}

/**
 * answer_enigma en démo : vraie validation via check_enigma_answer (lecture seule),
 * puis reconstruction du payload attendu par EnigmaResult. Aucune écriture.
 */
export async function validatedEnigmaResponse(
  realRpc: (name: string, args: Record<string, unknown>) => any,
  args: Record<string, unknown>,
): Promise<{ data: unknown; error: unknown }> {
  const { data, error } = await realRpc('check_enigma_answer', {
    p_enigma_id: args.p_enigma_id,
    p_answer: args.p_answer,
  })
  if (error || !data || (data as { error?: string }).error) {
    return { data: null, error: error ?? (data as { error?: string })?.error ?? 'check_failed' }
  }
  const d = data as { correct: boolean; answer: string; explanation: string; difficulty: string }
  const demo = useDemoStore.getState()
  demo.addGlory(1)
  return {
    data: {
      correct: d.correct,
      answer: d.answer,
      explanation: d.explanation,
      influenceGain: 1,
      eruditionGain: 1,
      crownsGain: CROWNS_BY_DIFFICULTY[d.difficulty] ?? 1,
      newCrownsBalance: Infinity,
      newErudition: 0,
      newGlory: useDemoStore.getState().glory,
    },
    error: null,
  }
}

/** No-op pour les écritures bloquées (rpc) : rien ne part au réseau. */
function blockedResponse(name: string): { data: null; error: null } {
  // FIX 4: gate the log so it never prints under Vitest
  if (import.meta.env.DEV && !import.meta.env.VITEST) {
    console.info(`[demo] écriture bloquée (no-op) : ${name}`)
  }
  return { data: null, error: null }
}

// ── FIX 1 helpers ──────────────────────────────────────────────────────────

const MUTATING_METHODS = new Set(['insert', 'update', 'upsert', 'delete'])
const STORAGE_MUTATING_METHODS = new Set([
  'upload', 'uploadToSignedUrl', 'update', 'remove', 'move', 'copy', 'createSignedUploadUrl',
])
// NB : les écritures bucket-admin (createBucket/deleteBucket/emptyBucket/updateBucket)
// vivent sur `storage` lui-même, pas sur `storage.from()`, et passent donc en
// Reflect.get. Hors scope : aucune n'est appelée dans l'app et le compte démo
// n'a pas les droits d'admin bucket.

/**
 * Returns a self-returning Proxy that is thenable → `await noop` resolves
 * `{ data: null, error: null }`, and any method call returns the same noop.
 * Used as the return value of intercepted from().insert/update/upsert/delete.
 */
function makeNoOpBuilder(): any {
  const noop: any = new Proxy({} as any, {
    get(_t, prop) {
      if (prop === 'then') {
        // Standard thenable protocol: call resolve synchronously.
        return (onFulfilled: (v: any) => any) =>
          Promise.resolve({ data: null, error: null }).then(onFulfilled)
      }
      // Every other property access returns a function that returns noop
      // so chaining (.select(), .eq(), .single(), …) is always safe.
      return (..._args: any[]) => noop
    },
  })
  return noop
}

export function wrapSupabaseForDemo<T extends { rpc: (...a: any[]) => any }>(client: T): T {
  const realRpc = client.rpc.bind(client)
  // Capture optional from/storage before building the proxy
  const realFrom: ((table: string) => any) | undefined =
    typeof (client as any).from === 'function'
      ? (client as any).from.bind(client)
      : undefined
  const realStorage: any = (client as any).storage

  return new Proxy(client, {
    get(target, prop, receiver) {
      // ── rpc ──────────────────────────────────────────────────────────────
      if (prop === 'rpc') {
        return (name: string, args: Record<string, unknown> = {}) => {
          const kind = classifyRpc(name)

          if (kind === 'read') {
            // FIX 2: cacheable reads → async wrapper with write-through + fallback
            if (CACHEABLE_READS.has(name)) {
              return (async () => {
                let result: any
                try {
                  result = await realRpc(name, args)
                } catch (_err) {
                  const cached = getCached(name, args)
                  if (cached !== undefined) return { data: cached, error: null }
                  throw _err
                }
                if (result.error || !result.data) {
                  const cached = getCached(name, args)
                  if (cached !== undefined) return { data: cached, error: null }
                  return result
                }
                setCached(name, args, result.data)
                return result
              })()
            }
            // Non-cacheable reads: return the real builder synchronously
            return realRpc(name, args)
          }

          if (kind === 'validated') return validatedEnigmaResponse(realRpc, args)
          if (kind === 'faked') return Promise.resolve(fakeResponse(name, args))
          return Promise.resolve(blockedResponse(name))
        }
      }

      // ── from(table) ──────────────────────────────────────────────────────
      if (prop === 'from' && realFrom) {
        return (table: string) => {
          return new Proxy({} as any, {
            get(_b, method) {
              const methodName = String(method)
              if (MUTATING_METHODS.has(methodName)) {
                // Return a function that, when called, returns a no-op builder
                return (..._args: any[]) => makeNoOpBuilder()
              }
              // Non-mutating: delegate to the real query builder
              const realBuilder = realFrom(table)
              const val = (realBuilder as any)[methodName]
              return typeof val === 'function' ? val.bind(realBuilder) : val
            },
          })
        }
      }

      // ── storage ──────────────────────────────────────────────────────────
      if (prop === 'storage' && realStorage) {
        return new Proxy(realStorage, {
          get(storageTarget, storageProp, storageReceiver) {
            if (storageProp === 'from') {
              return (bucket: string) => {
                const realFileApi = realStorage.from(bucket)
                return new Proxy(realFileApi, {
                  get(fileTarget, fileProp, fileReceiver) {
                    const name = String(fileProp)
                    if (STORAGE_MUTATING_METHODS.has(name)) {
                      return (...args: any[]) => {
                        if (name === 'upload' || name === 'update') {
                          // Resolve with path so callers reading data.path don't crash
                          const path = typeof args[0] === 'string' ? args[0] : undefined
                          return Promise.resolve({ data: { path }, error: null })
                        }
                        return Promise.resolve({ data: null, error: null })
                      }
                    }
                    // Read methods (download, list, getPublicUrl, …) pass through
                    return Reflect.get(fileTarget, fileProp, fileReceiver)
                  },
                })
              }
            }
            return Reflect.get(storageTarget, storageProp, storageReceiver)
          },
        })
      }

      // Everything else (auth, channel, …) passes through
      return Reflect.get(target, prop, receiver)
    },
  }) as T
}
