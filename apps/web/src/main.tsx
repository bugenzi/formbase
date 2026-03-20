import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ClerkProvider } from '@clerk/react'
import { router } from './router'
import './styles/global.css'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined

function Root() {
  if (clerkPubKey) {
    return (
      <ClerkProvider publishableKey={clerkPubKey}>
        <RouterProvider router={router} />
      </ClerkProvider>
    )
  }
  return <RouterProvider router={router} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
