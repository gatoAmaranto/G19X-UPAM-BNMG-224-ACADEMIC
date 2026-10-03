import axios from 'axios'

let tokenGetter = null

/**
 * Registra la función encargada de proveer el token JWT de Auth0 (ej. getAccessTokenSilently)
 */
export const setAuthTokenGetter = (getter) => {
  tokenGetter = getter
}

/**
 * Obtiene el token JWT actual de forma asíncrona (si está disponible)
 */
export const getStoredToken = async () => {
  if (typeof tokenGetter === 'function') {
    try {
      return await tokenGetter()
    } catch (err) {
      console.warn('Error al obtener token de Auth0:', err)
      return null
    }
  }
  return null
}

// Configurar Interceptor de Solicitud en el objeto global axios
// Esto asegura que tanto llamadas directas a axios como llamadas a través de instancias tengan el token
axios.interceptors.request.use(
  async (config) => {
    if (typeof tokenGetter === 'function') {
      try {
        const token = await tokenGetter()
        if (token) {
          config.headers = config.headers || {}
          // Si el header no ha sido fijado manualmente, inyectar el Bearer token
          if (!config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`
          }
        }
      } catch (err) {
        console.warn('No se pudo inyectar el token Bearer en la petición Axios:', err)
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Interceptor de respuesta para manejar 401/403 de forma limpia
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 403) {
      console.error('Acceso denegado (403 Forbidden): Tu rol no cuenta con permisos suficientes en el servidor.')
    }
    return Promise.reject(error)
  }
)

// Instancia centralizada de API Client para PluriOne
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 30000
})

export default apiClient
