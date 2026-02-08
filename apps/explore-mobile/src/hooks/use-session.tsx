import { useDependencies } from '@/ui/dependencies/Dependencies'
import { AuthData } from '@model'
import { SendOtpParams, VerifyOtpParams } from '@/services/supabase-authenticator'
import React, { createContext, useContext, useEffect, useState } from 'react'

type Session = {
  session: AuthData | null
  isAuthenticated: boolean
  ready: boolean
  sendOtp: (params: SendOtpParams) => Promise<void>
  verifyOtp: (params: VerifyOtpParams) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const Context = createContext<Session>({
  session: null,
  isAuthenticated: false,
  ready: false,
  sendOtp: async () => {},
  verifyOtp: async () => {},
  signOut: async () => {},
  refresh: async () => {},
})

export const SessionProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const [session, setSession] = useState<AuthData | null>(null)
  const [ready, setReady] = useState(false)
  const { authenticator } = useDependencies()

  const api: Session = {
    isAuthenticated: !!session,
    session: session,
    ready: ready,
    sendOtp: async (params: SendOtpParams) => authenticator.sendOtp(params),
    verifyOtp: async (params: VerifyOtpParams) => authenticator.verifyOtp(params),
    signOut: async () => authenticator.signOut(),
    refresh: async () => authenticator.refreshUser(),
  }

  useEffect(() => {
    return authenticator.onUserChange(user => {
      setSession(user)
    })
  }, [])

  useEffect(() => {
    async function work() {
      await authenticator.initialize()
      setReady(true)
    }

    work()
  }, [])

  useEffect(() => {
    async function check() {
      return authenticator.maintainValidAccessToken()
    }

    const interval = setInterval(check, 1000 * 45)
    return () => clearInterval(interval)
  }, [])

  return <Context.Provider value={api}>{children}</Context.Provider>
}

export const useSession = (): Session => useContext(Context)
