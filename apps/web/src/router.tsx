import { createBrowserRouter, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import RootLayout from './routes/root'

const Landing = lazy(() => import('./routes/landing'))
const Editor = lazy(() => import('./routes/editor'))

function Loader() {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'DM Sans, system-ui, sans-serif', color: '#999' }}>
      <div style={{ width: 24, height: 24, border: '2.5px solid rgba(0,0,0,0.06)', borderTopColor: '#e8793b', borderRadius: '50%', animation: 'spin .65s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Loader />}>{children}</Suspense>
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <S><Landing /></S> },
      { path: 'editor', element: <S><Editor /></S> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
