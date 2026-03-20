import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@clerk/react'
import { hasClerk } from '../lib/auth'

/**
 * Protected layout — wraps routes that require sign-in.
 *
 * - Clerk NOT configured → pass through (local dev)
 * - Clerk configured + not signed in → redirect to /sign-in
 * - Clerk configured + signed in → render children
 *
 * NOTE: useAuth() is only called inside ClerkGuard, which only renders
 * when hasClerk is true. main.tsx wraps with ClerkProvider when hasClerk is true,
 * so the hook is always inside a provider when called.
 */
export default function AuthLayout() {
  if (!hasClerk) return <Outlet />
  return <ClerkGuard />
}

function ClerkGuard() {
  const { isSignedIn, isLoaded } = useAuth()

  if (!isLoaded) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        color: '#999',
      }}>
        Loading...
      </div>
    )
  }

  if (!isSignedIn) return <Navigate to="/sign-in" replace />

  return <Outlet />
}
