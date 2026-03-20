import { Outlet } from 'react-router-dom'

/**
 * Root layout — wraps all routes.
 * Add global providers, nav, or analytics here.
 */
export default function RootLayout() {
  return <Outlet />
}
