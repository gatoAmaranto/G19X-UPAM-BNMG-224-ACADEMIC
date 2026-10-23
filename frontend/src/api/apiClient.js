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

// Instancia centralizada de API Client para PluriOne
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 30000
})

// Función para registrar interceptores de autenticación en una instancia de Axios
const setupAuthInterceptors = (instance) => {
  instance.interceptors.request.use(
    async (config) => {
      if (typeof tokenGetter === 'function') {
        try {
          const token = await tokenGetter()
          if (token) {
            config.headers = config.headers || {}
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

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response && error.response.status === 403) {
        console.error('Acceso denegado (403 Forbidden): Tu rol no cuenta con permisos suficientes en el servidor.')
      }
      return Promise.reject(error)
    }
  )
}

// Configurar interceptores tanto en el objeto global axios como en apiClient
setupAuthInterceptors(axios)
setupAuthInterceptors(apiClient)

export default apiClient
