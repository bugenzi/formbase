/**
 * Create an authenticated fetch function using a Clerk getToken function.
 * Call this inside a component: const fetchWithAuth = useAuthFetch()
 */
export function createAuthFetch(getToken: (() => Promise<string | null>) | null) {
  return async function authFetch(path: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers)

    if (getToken) {
      const token = await getToken()
      if (token) {
        headers.set('Authorization', `Bearer ${token}`)
      }
    }

    return fetch(path, { ...init, headers })
  }
}
