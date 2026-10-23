import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturo un error no controlado:', error, errorInfo)
  }

  handleReload = () => {
    window.location.href = window.location.origin
  }

  handleForceLocal = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('force_local_auth', 'true')
      window.location.href = window.location.origin
    }
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || String(this.state.error)
      const isCryptoError = errorMsg.includes('secure origin') || errorMsg.includes('crypto')

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--background, #0f172a)',
          color: 'var(--foreground, #f8fafc)',
          padding: '2rem'
        }}>
          <div className="glass-panel" style={{
            maxWidth: '520px',
            width: '100%',
            padding: '2.5rem',
            textAlign: 'center',
            borderRadius: 'var(--radius, 12px)'
          }}>
            <div style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem'
            }}>
              <AlertCircle size={28} />
            </div>

            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>
              {isCryptoError ? 'Restriccion de Seguridad del Navegador' : 'Ocurrio un problema al cargar la aplicacion'}
            </h2>

            <p style={{ fontSize: '0.88rem', color: 'var(--muted-foreground, #94a3b8)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              {isCryptoError
                ? 'El navegador no permite el uso de Web Crypto API en conexiones HTTP por direccion IP. Auth0 requiere HTTPS o conectarse mediante localhost.'
                : errorMsg}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleForceLocal}
                className="btn-primary"
                style={{ padding: '0.65rem 1.25rem' }}
              >
                Continuar en modo local
              </button>
              <button
                onClick={this.handleReload}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.25rem'
                }}
              >
                <RefreshCw size={15} />
                <span>Recargar pagina</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
