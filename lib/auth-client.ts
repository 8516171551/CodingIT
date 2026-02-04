'use client'

import { ViewType } from '@/components/auth'
import { useState, useEffect, useCallback } from 'react'
import { usePostHog } from 'posthog-js/react'

export interface User {
  id: string
  email: string
  name: string | null
}

export interface Session {
  user: User
}

export function useAuth(
  setAuthDialog: (value: boolean) => void,
  setAuthView: (value: ViewType) => void,
) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const posthog = usePostHog()

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/user')
      const data = await response.json()
      
      if (data.user) {
        setSession({ user: data.user })
        posthog.identify(data.user.id, {
          email: data.user.email,
          name: data.user.name,
        })
      } else {
        setSession(null)
      }
    } catch (error) {
      console.error('Failed to check session:', error)
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [posthog])

  useEffect(() => {
    checkSession()
  }, [checkSession])

  return {
    session,
    loading,
    refreshSession: checkSession,
  }
}

export async function signIn(email: string, password: string): Promise<{ user: User } | { error: string }> {
  try {
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await response.json()
    
    if (!response.ok) {
      return { error: data.error || 'Failed to sign in' }
    }

    return { user: data.user }
  } catch (error: any) {
    return { error: error.message || 'Failed to sign in' }
  }
}

export async function signUp(email: string, password: string, name?: string): Promise<{ user: User } | { error: string }> {
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })

    const data = await response.json()
    
    if (!response.ok) {
      return { error: data.error || 'Failed to sign up' }
    }

    return { user: data.user }
  } catch (error: any) {
    return { error: error.message || 'Failed to sign up' }
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch('/api/auth/signout', {
      method: 'POST',
    })
  } catch (error) {
    console.error('Failed to sign out:', error)
  }
}
