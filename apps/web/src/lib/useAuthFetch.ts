import { useCallback } from 'react'
import { useAuth } from '@clerk/react'
import { hasClerk } from './auth'

/**
 * Returns a fetch function that automatically attaches
 * the Clerk session token as a Bearer header.
 *
 * When Clerk isn't configured, returns plain fetch.
 *
 * IMPORTANT: This hook must only be called inside components
 * that are wrapped by ClerkProvider (which is always true when hasClerk is true).
 */

const plainFetch = (path: string, init?: RequestInit) => fetch(path, init)

// When no Clerk, export a simple hook that returns plain fetch
// When Clerk is active, export the auth-aware version
// The conditional is on a module-level constant (not dynamic), so it's safe
export const useAuthFetch: () => (path: string, init?: RequestInit) => Promise<Response> =
  hasClerk ? useClerkAuthFetch : () => plainFetch

function useClerkAuthFetch() {
  const { getToken } = useAuth()

  return useCallback(async (path: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)

    try {
      const token = await getToken()
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
    } catch {
      // No session — proceed without token
    }

    return fetch(path, { ...init, headers })
  }, [getToken])
}
