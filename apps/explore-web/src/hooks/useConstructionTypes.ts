import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface ConstructionTypeInfo {
  level: number
  name: string
  description: string
  image_url: string | null
  cost: number
  conquest_bonus: number
}

let _ctCache: ConstructionTypeInfo[] | null = null

export function useConstructionTypes(): ConstructionTypeInfo[] {
  const [types, setTypes] = useState<ConstructionTypeInfo[]>(_ctCache ?? [])

  useEffect(() => {
    if (_ctCache) return
    supabase.rpc('get_construction_types').then(({ data }) => {
      if (data && Array.isArray(data)) {
        _ctCache = data as ConstructionTypeInfo[]
        setTypes(data as ConstructionTypeInfo[])
      }
    })
  }, [])

  return types
}

export function ctByLevel(types: ConstructionTypeInfo[], level: number): ConstructionTypeInfo | undefined {
  return types.find(t => t.level === level)
}
