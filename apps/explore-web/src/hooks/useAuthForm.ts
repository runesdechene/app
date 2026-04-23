import { useState } from 'react'
import { supabase } from '../lib/supabase'

export type AuthStep = 'form' | 'sent'

export interface UseAuthFormResult {
  email: string
  setEmail: (v: string) => void
  code: string
  setCode: (v: string) => void
  step: AuthStep
  setStep: (s: AuthStep) => void
  loading: boolean
  error: string | null
  requestCode: () => Promise<void>
  verifyCode: () => Promise<void>
  reset: () => void
}

export interface UseAuthFormOptions {
  onSuccess?: () => void
}

export function useAuthForm(options: UseAuthFormOptions = {}): UseAuthFormResult {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<AuthStep>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function requestCode() {
    setError(null)
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      })
      if (err) {
        setError(err.message)
      } else {
        setStep('sent')
      }
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode() {
    setError(null)
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'email',
      })
      if (err) {
        setError('Code invalide ou expiré')
      } else {
        options.onSuccess?.()
      }
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setStep('form')
    setCode('')
    setError(null)
  }

  return { email, setEmail, code, setCode, step, setStep, loading, error, requestCode, verifyCode, reset }
}
