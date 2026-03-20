import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary for the PDF form editor.
 * Catches render errors and displays a recovery UI instead of crashing.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[FormPDF] Editor error:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="pfe-error-boundary">
          <div className="pfe-error-boundary__icon">!</div>
          <h3 className="pfe-error-boundary__title">Something went wrong</h3>
          <p className="pfe-error-boundary__message">
            {this.state.error?.message || 'An unexpected error occurred in the editor.'}
          </p>
          <button className="pfe-error-boundary__btn" onClick={this.handleReset}>
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
