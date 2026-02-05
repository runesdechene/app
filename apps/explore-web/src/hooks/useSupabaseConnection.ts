import { useState, useEffect, useCallback } from 'react'
import { testConnection, fetchTables } from '../lib/supabase'

interface ConnectionState {
  status: 'idle' | 'connecting' | 'connected' | 'error'
  tables: string[]
  error: string | null
}

interface UseSupabaseConnectionReturn extends ConnectionState {
  retry: () => Promise<void>
}

export function useSupabaseConnection(): UseSupabaseConnectionReturn {
  const [state, setState] = useState<ConnectionState>({
    status: 'idle',
    tables: [],
    error: null
  })

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, status: 'connecting', error: null }))

    const result = await testConnection()
    
    if (!result.ok) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: result.error || 'Connexion échouée'
      }))
      return
    }

    const tables = await fetchTables()
    
    setState({
      status: 'connected',
      tables,
      error: null
    })
  }, [])

  useEffect(() => {
    connect()
  }, [connect])

  return {
    ...state,
    retry: connect
  }
}
