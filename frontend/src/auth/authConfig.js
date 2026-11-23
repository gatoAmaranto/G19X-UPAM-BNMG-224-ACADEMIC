// Configuración oficial y validaciones de Auth0 para PluriOne
export const AUTH0_CONFIG = {
  domain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH0_DOMAIN) || '',
  clientId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH0_CLIENT_ID) || '',
  authorizationParams: {
    redirect_uri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
    audience: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AUTH0_AUDIENCE) || ''
  }
}

export const isPlaceholderAuth0 = (val) => {
  if (!val || typeof val !== 'string') return true
  const lower = val.trim().toLowerCase()
  return (
    !lower ||
    lower.includes('tu_dominio') ||
    lower.includes('tu_client_id') ||
    lower.includes('placeholder') ||
    lower.includes('example.com')
  )
}
