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

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')

/**
 * Resuelve y normaliza URLs de imágenes de avatar y multimedia de colaboradores y administradores RH.
 * Soporta URLs relativas, absolutas, orígenes externos, data/blob URLs y compatibilidad
 * tanto con el entorno de desarrollo (con o sin proxy Vite) como con producción.
 */
export const resolveAvatarUrl = (url) => {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null

  // Data URLs o Blob URLs generadas localmente por previsualizaciones
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed
  }

  // Descartar prefijos de host internos o puertos fijos si vinieron en la BD o serializador
  let cleanPath = trimmed.replace(/^https?:\/\/(backend|localhost|127\.0\.0\.1)(:\d+)?/i, '')

  // Si tras remover hosts internos sigue siendo una URL absoluta (ej. CDN, Unsplash, Auth0), retornarla directamente
  if (/^https?:\/\//i.test(cleanPath)) {
    return cleanPath
  }

  // Asegurar barra diagonal inicial
  if (!cleanPath.startsWith('/')) {
    cleanPath = `/${cleanPath}`
  }

  // Normalizar rutas que inicien directamente con /avatares/ para anteponer /media
  if (cleanPath.startsWith('/avatares/')) {
    cleanPath = `/media${cleanPath}`
  }

  // Si API_BASE_URL es una URL absoluta (ej. http://localhost:8000/api o http://192.168.x.x:8000/api),
  // extraer su origen y anteponerlo para que la imagen apunte directamente al backend
  if (/^https?:\/\//i.test(API_BASE_URL)) {
    try {
      const origin = new URL(API_BASE_URL).origin
      return `${origin}${cleanPath}`
    } catch {
      // Si falla la extracción de URL, continuar con la ruta relativa
    }
  }

  return cleanPath
}


// Instancia centralizada de API Client para PluriOne
const apiClient = axios.create({
  baseURL: API_BASE_URL,
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
