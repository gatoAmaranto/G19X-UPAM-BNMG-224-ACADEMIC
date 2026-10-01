import React, { createContext, useContext, useState, useEffect } from 'react'
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react'

const AuthCustomContext = createContext(null)

// Configuración por defecto para Auth0
export const AUTH0_CONFIG = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN || 'dev-plurione-hr.us.auth0.com',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || 'PluriOneHRClientAppId',
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'https://api.plurione.com/'
  }
}

// Proveedor Híbrido que maneja Auth0 + Modo Simulación Local RBAC
export function AuthProvider({ children }) {
  const isAuth0Configured = Boolean(
    import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID
  )

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

// Wrapper para extraer claims y roles de Auth0
function Auth0WrappedChild({ children }) {
  const { user, isAuthenticated, isLoading, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0()

  // Extraer roles del claim de Auth0 (ej. https://plurione.com/roles o user_metadata)
  const roles = user?.['https://plurione.com/roles'] || user?.roles || ['colaborador']
  const isRhAdmin = roles.includes('rh_admin') || user?.email?.includes('admin')

  const value = {
    isAuthenticated,
    isLoading,
    user: user ? {
      name: user.name || user.nickname,
      email: user.email,
      picture: user.picture,
      sub: user.sub,
      role: isRhAdmin ? 'rh_admin' : 'colaborador',
      puesto: isRhAdmin ? 'Gerente de Recursos Humanos' : 'Ingeniero de Software',
      departamento: isRhAdmin ? 'Recursos Humanos' : 'Desarrollo de Software',
      numero_empleado: isRhAdmin ? 'ADM-001' : 'EMP-0101'
    } : null,
    isRhAdmin,
    login: () => loginWithRedirect(),
    logout: () => logout({ logoutParams: { returnTo: window.location.origin } }),
    getToken: getAccessTokenSilently,
    isAuth0Live: true
  }

  return <AuthCustomContext.Provider value={value}>{children}</AuthCustomContext.Provider>
}

// Proveedor Simulado para Pruebas Locales Inmediatas de RBAC
function LocalAuthProvider({ children }) {
  const [activeRole, setActiveRole] = useState('colaborador') // 'colaborador' | 'rh_admin'
  const [isAuthenticated, setIsAuthenticated] = useState(true)

  const mockUsers = {
    colaborador: {
      name: 'Juan Pérez',
      email: 'juan.perez@develop.com.mx',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150',
      sub: 'auth0|mock-user-colaborador-101',
      role: 'colaborador',
      puesto: 'Ingeniero de Software Senior',
      departamento: 'Desarrollo de Software',
      numero_empleado: 'EMP-0101'
    },
    rh_admin: {
      name: 'María Rodríguez (Admin RH)',
      email: 'maria.rodriguez@develop.com.mx',
      picture: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150',
      sub: 'auth0|mock-user-rh-admin-001',
      role: 'rh_admin',
      puesto: 'Directora de Talent & RH',
      departamento: 'Recursos Humanos',
      numero_empleado: 'ADM-001'
    }
  }

  const currentUser = isAuthenticated ? mockUsers[activeRole] : null
  const isRhAdmin = activeRole === 'rh_admin'

  const value = {
    isAuthenticated,
    isLoading: false,
    user: currentUser,
    isRhAdmin,
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
