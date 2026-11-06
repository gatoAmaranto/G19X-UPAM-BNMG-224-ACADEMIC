import React, { createContext, useContext, useState, useEffect } from 'react'
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react'
import { setAuthTokenGetter } from '../api/apiClient.js'


const AuthCustomContext = createContext(null)

// Configuración oficial Auth0
export const AUTH0_CONFIG = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN || '',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || '',
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: import.meta.env.VITE_AUTH0_AUDIENCE || ''
  }
}

// Proveedor Híbrido que activa Auth0 en vivo o recurre a modo local si el origen no es seguro (HTTP por IP)
export function AuthProvider({ children }) {
  const isSecureContextAvailable = typeof window !== 'undefined' && Boolean(window.crypto && window.crypto.subtle)
  const isForceLocal = typeof window !== 'undefined' && sessionStorage.getItem('force_local_auth') === 'true'
  const isAuth0Configured = Boolean(AUTH0_CONFIG.domain && AUTH0_CONFIG.clientId)

  // Auth0 SPA JS requiere Web Crypto API (crypto.subtle) para PKCE, la cual los navegadores
  // sólo habilitan en orígenes seguros (HTTPS o localhost / 127.0.0.1).
  // Si se accede mediante una IP de red local (ej. http://192.168.x.x:5173),
  // se activa automáticamente el LocalAuthProvider para prevenir la pantalla blanca.
  if (!isForceLocal && isAuth0Configured && isSecureContextAvailable) {
    return (
      <Auth0Provider
        domain={AUTH0_CONFIG.domain}
        clientId={AUTH0_CONFIG.clientId}
        authorizationParams={AUTH0_CONFIG.authorizationParams}
      >
        <Auth0WrappedChild>{children}</Auth0WrappedChild>
      </Auth0Provider>
    )
  }

  return (
    <LocalAuthProvider
      insecureOriginDetected={isAuth0Configured && !isSecureContextAvailable}
    >
      {children}
    </LocalAuthProvider>
  )
}

// Wrapper para extraer claims y los roles oficiales: "colaborador" y "recursos humanos"
function Auth0WrappedChild({ children }) {
  const { user, isAuthenticated, isLoading, error, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0()

  if (error) {
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.75rem' }}>
            Error de Autenticacion con Auth0
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground, #94a3b8)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            {error.message || 'No fue posible completar la verificacion de sesion en Auth0.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => loginWithRedirect()}
              className="btn-primary"
              style={{ padding: '0.65rem 1.25rem' }}
            >
              Reintentar inicio de sesion
            </button>
            <button
              onClick={() => {
                sessionStorage.setItem('force_local_auth', 'true')
                window.location.href = window.location.origin
              }}
              className="btn-secondary"
              style={{ padding: '0.65rem 1.25rem' }}
            >
              Continuar en modo local (demo)
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Extraer roles de cualquier claim inyectado por la Action de Auth0
  let rawRoles = []
  if (user) {
    for (const key of Object.keys(user)) {
      if (key.endsWith('/roles') || key === 'roles' || key.includes('role')) {
        const val = user[key]
        if (Array.isArray(val)) {
          rawRoles.push(...val)
        } else if (typeof val === 'string') {
          rawRoles.push(val)
        }
      }
    }
  }

  // Normalizar nombres de roles a minúsculas
  const normalizedRoles = rawRoles.map(r => String(r).toLowerCase().trim())

  // Detección estricta del rol "recursos humanos" vs "colaborador"
  const isRhAdmin = normalizedRoles.some(r =>
    r === 'recursos humanos' ||
    r === 'recursos_humanos' ||
    r === 'rh_admin' ||
    r === 'rh' ||
    r === 'admin' ||
    r.includes('recursos')
  )

  const userRole = isRhAdmin ? 'recursos humanos' : 'colaborador'

  // Configurar el interceptor de peticiones Axios para adjuntar el JWT Bearer
  useEffect(() => {
    if (isAuthenticated) {
      setAuthTokenGetter(async () => {
        try {
          return await getAccessTokenSilently()
        } catch (err) {
          try {
            return await getAccessTokenSilently({
              authorizationParams: {
                audience: AUTH0_CONFIG.authorizationParams.audience
              }
            })
          } catch (innerErr) {
            console.warn('Error al obtener token silencioso JWT de Auth0:', innerErr)
            return null
          }
        }
      })
    } else {
      setAuthTokenGetter(null)
    }
  }, [isAuthenticated, getAccessTokenSilently])

  const value = {
    isAuthenticated,
    isLoading,
    user: user ? {
      name: user.name || user.nickname || (isRhAdmin ? 'Administrador de RH' : 'Colaborador'),
      email: user.email,
      picture: user.picture,
      sub: user.sub,
      role: userRole,
      puesto: isRhAdmin ? 'Especialista de Recursos Humanos' : 'Colaborador Develop',
      departamento: isRhAdmin ? 'Recursos Humanos' : 'Operaciones / Desarrollo',
      numero_empleado: isRhAdmin ? 'RH-001' : 'COL-101'
    } : null,
    isRhAdmin,
    userRole,
    login: () => loginWithRedirect(),
    logout: () => logout({ logoutParams: { returnTo: window.location.origin } }),
    getToken: getAccessTokenSilently,
    isAuth0Live: true,
    insecureOriginDetected: false
  }

  return <AuthCustomContext.Provider value={value}>{children}</AuthCustomContext.Provider>
}

// Proveedor Simulado para fallback
function LocalAuthProvider({ children, insecureOriginDetected = false }) {
  const [activeRole, setActiveRole] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('active_demo_role') || 'colaborador'
    }
    return 'colaborador'
  })
  const [isAuthenticated, setIsAuthenticated] = useState(true)

  const mockUsers = {
    colaborador: {
      name: 'Juan Pérez (Colaborador)',
      first_name: 'Juan',
      last_name: 'Pérez',
      email: 'juan.perez@develop.com.mx',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
      sub: 'auth0|mock-user-colaborador-101',
      role: 'colaborador',
      puesto: 'Desarrollador Full Stack Senior',
      departamento: 'Tecnología de la Información',
      numero_empleado: 'EMP-0101',
      dias_vacaciones_totales: 14,
      dias_vacaciones_tomados: 2,
      dias_vacaciones_retenidos: 0,
      dias_vacaciones_disponibles: 12,
      antiguedad_anios: 3,
      fecha_ingreso: '2023-03-01',
      salario_mensual: 38500,
      horario_entrada: '09:00',
      horario_salida: '18:00',
      dias_laborales: 'Lunes a Viernes',
      modalidad_trabajo: 'Híbrido'
    },
    'recursos humanos': {
      name: 'María Rodríguez (Recursos Humanos)',
      first_name: 'María',
      last_name: 'Rodríguez',
      email: 'maria.rodriguez@develop.com.mx',
      picture: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150',
      sub: 'auth0|mock-user-rh-admin-001',
      role: 'recursos humanos',
      puesto: 'Especialista en Capital Humano y Relaciones Laborales',
      departamento: 'Recursos Humanos',
      numero_empleado: 'RH-0001',
      dias_vacaciones_totales: 16,
      dias_vacaciones_tomados: 4,
      dias_vacaciones_retenidos: 0,
      dias_vacaciones_disponibles: 12,
      antiguedad_anios: 4,
      fecha_ingreso: '2022-01-15',
      salario_mensual: 48000,
      horario_entrada: '09:00',
      horario_salida: '18:00',
      dias_laborales: 'Lunes a Viernes',
      modalidad_trabajo: 'Presencial'
    }
  }

  const isRhAdmin = activeRole === 'recursos humanos'
  const currentUser = isAuthenticated ? mockUsers[activeRole] : null

  // Sincronizar inmediatamente el tokenGetter para evitar race conditions con hijos montados
  if (isAuthenticated) {
    const currentToken = activeRole === 'recursos humanos' ? 'mock-jwt-token-plurione-rh' : 'mock-jwt-token-plurione'
    setAuthTokenGetter(async () => currentToken)
  }

  // Configurar interceptor para simulación en desarrollo local
  useEffect(() => {
    if (isAuthenticated) {
      const token = activeRole === 'recursos humanos' ? 'mock-jwt-token-plurione-rh' : 'mock-jwt-token-plurione'
      setAuthTokenGetter(async () => token)
    } else {
      setAuthTokenGetter(null)
    }
  }, [isAuthenticated, activeRole])

  const switchRole = (newRole) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('active_demo_role', newRole)
    }
    const token = newRole === 'recursos humanos' ? 'mock-jwt-token-plurione-rh' : 'mock-jwt-token-plurione'
    setAuthTokenGetter(async () => token)
    setActiveRole(newRole)
  }

  const resetForceLocal = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('force_local_auth')
      window.location.reload()
    }
  }

  const value = {
    isAuthenticated,
    isLoading: false,
    user: currentUser,
    isRhAdmin,
    userRole: activeRole,
    login: () => setIsAuthenticated(true),
    logout: () => setIsAuthenticated(false),
    switchRole,
    activeRole,
    getToken: async () => (activeRole === 'recursos humanos' ? 'mock-jwt-token-plurione-rh' : 'mock-jwt-token-plurione'),
    isAuth0Live: false,
    insecureOriginDetected,
    isForceLocal: typeof window !== 'undefined' && sessionStorage.getItem('force_local_auth') === 'true',
    resetForceLocal
  }

  return <AuthCustomContext.Provider value={value}>{children}</AuthCustomContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthCustomContext)
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider')
  }
  return context
}
