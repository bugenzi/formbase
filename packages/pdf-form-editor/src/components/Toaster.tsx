import React, { useState, useCallback, useRef, useEffect } from 'react'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToasterContextValue {
  toast: (message: string, type?: Toast['type']) => void
}

const ToasterContext = React.createContext<ToasterContextValue>({
  toast: () => {},
})

export function useToast() {
  return React.useContext(ToasterContext)
}

export function ToasterProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, number>>(new Map())

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev.slice(-4), { id, message, type }]) // max 5
    const timer = window.setTimeout(() => removeToast(id), 4000)
    timersRef.current.set(id, timer)
  }, [removeToast])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t))
    }
  }, [])

  return (
    <ToasterContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="pfe-toaster" role="status" aria-live="polite">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`pfe-toast pfe-toast--${t.type}`}
              onClick={() => removeToast(t.id)}
            >
              <span className="pfe-toast__icon">
                {t.type === 'success' ? '\u2713' : t.type === 'error' ? '\u2717' : '\u2139'}
              </span>
              {t.message}
            </div>
          ))}
        </div>
      )}
    </ToasterContext.Provider>
  )
}
