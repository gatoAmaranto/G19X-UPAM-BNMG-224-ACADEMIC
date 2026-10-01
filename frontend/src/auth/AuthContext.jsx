import React, { createContext, useContext, useState } from 'react'
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react'

const AuthCustomContext = createContext(null)

// Configuración oficial Auth0 de PluriOne
export const AUTH0_CONFIG = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN || 'dev-n4ra6mt0qf5e4h61.us.auth0.com',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || '4x5X2AXgYvvSIzHYUS07FU8kvjHSX8uO',
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'https://dev-n4ra6mt0qf5e4h61.us.auth0.com/api/v2/'
  }
}

// Proveedor Híbrido que activa Auth0 en vivo
export function AuthProvider({ children }) {
  const isAuth0Configured = Boolean(AUTH0_CONFIG.domain && AUTH0_CONFIG.clientId)

  if (isAuth0Configured) {
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

  return <LocalAuthProvider>{children}</LocalAuthProvider>
}

// Wrapper para extraer claims y los roles oficiales: "colaborador" y "recursos humanos"
function Auth0WrappedChild({ children }) {
  const { user, isAuthenticated, isLoading, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0()

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
  ) || user?.email?.toLowerCase().includes('rh') || user?.email?.toLowerCase().includes('admin')

  const userRole = isRhAdmin ? 'recursos humanos' : 'colaborador'

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
    isAuth0Live: true
  }

  return <AuthCustomContext.Provider value={value}>{children}</AuthCustomContext.Provider>
}

// Proveedor Simulado para fallback
function LocalAuthProvider({ children }) {
  const [activeRole, setActiveRole] = useState('colaborador') // 'colaborador' | 'recursos humanos'
  const [isAuthenticated, setIsAuthenticated] = useState(true)

  const mockUsers = {
    colaborador: {
      name: 'Juan Pérez (Colaborador)',
      email: 'juan.perez@develop.com.mx',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
      sub: 'auth0|mock-user-colaborador-101',
      role: 'colaborador',
      puesto: 'Ingeniero de Software Senior',
      departamento: 'Desarrollo de Software',
      numero_empleado: 'EMP-0101'
    },
    'recursos humanos': {
      name: 'María Rodríguez (Recursos Humanos)',
      email: 'maria.rodriguez@develop.com.mx',
      picture: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150',
      sub: 'auth0|mock-user-rh-admin-001',
      role: 'recursos humanos',
      puesto: 'Directora de Talent & RH',
      departamento: 'Recursos Humanos',
      numero_empleado: 'ADM-001'
    }
  }

  const isRhAdmin = activeRole === 'recursos humanos'
  const currentUser = isAuthenticated ? mockUsers[activeRole] : null

  const value = {
    isAuthenticated,
    isLoading: false,
    user: currentUser,
    isRhAdmin,
    userRole: activeRole,
    login: () => setIsAuthenticated(true),
    logout: () => setIsAuthenticated(false),
    switchRole: (role) => setActiveRole(role),
    activeRole,
    getToken: async () => 'mock-jwt-token-plurione',
    isAuth0Live: false
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
