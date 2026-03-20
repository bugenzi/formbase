import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { hasClerk } from '../lib/auth'
import '../styles/sign-in.css'

function ClerkSignIn() {
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    import('@clerk/react').then(mod => setComp(() => mod.SignIn))
  }, [])

  if (!Comp) {
    return (
      <div className="si">
        <div className="si__card si__card--local">
          <div className="si__loading" />
        </div>
      </div>
    )
  }

  return (
    <div className="si">
      <div className="si__card">
        <Comp
          routing="hash"
          signUpUrl="/sign-in"
          afterSignInUrl="/dashboard"
          afterSignUpUrl="/dashboard"
        />
      </div>
    </div>
  )
}

function LocalSignIn() {
  const nav = useNavigate()
  return (
    <div className="si">
      <div className="si__card si__card--local">
        <Link to="/" className="si__logo">
          <div className="si__logo-mark">F</div>
          <span className="si__logo-text">Formbase</span>
        </Link>
        <h2 className="si__title">Auth not configured</h2>
        <p className="si__desc">
          No <code>VITE_CLERK_PUBLISHABLE_KEY</code> found. Running in local mode without authentication.
        </p>
        <div className="si__actions">
          <button className="si__btn si__btn--primary" onClick={() => nav('/editor')}>
            Open Editor
          </button>
          <button className="si__btn si__btn--ghost" onClick={() => nav('/dashboard')}>
            Dashboard
          </button>
        </div>
        <p className="si__hint">
          To enable auth, add your Clerk keys to <code>apps/web/.env</code> and <code>apps/server/.env</code>
        </p>
      </div>
    </div>
  )
}

export default function SignInRoute() {
  if (hasClerk) return <ClerkSignIn />
  return <LocalSignIn />
}
