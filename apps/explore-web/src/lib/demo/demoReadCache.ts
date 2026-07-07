const cache = new Map<string, unknown>()

export const CACHEABLE_READS: ReadonlySet<string> = new Set([
  'get_map_places',
  'get_map_veilles',
  'get_daily_enigma',
])

export function cacheKey(rpcName: string, args: unknown): string {
  return `${rpcName}:${JSON.stringify(args ?? null)}`
}

export function getCached(rpcName: string, args: unknown): unknown | undefined {
  return cache.get(cacheKey(rpcName, args))
}

export function setCached(rpcName: string, args: unknown, data: unknown): void {
  if (data === undefined) { cache.clear(); return } // sentinelle de reset pour les tests
  cache.set(cacheKey(rpcName, args), data)
}
