import React, { useState, useEffect } from 'react'
import { LogIn, LogOut, Shield, UserCheck } from 'lucide-react'
import axios from 'axios'
import { useAuth } from '../auth/AuthContext.jsx'

const API_BASE = '/api'

export default function UserAuthHeader() {
  const { isAuthenticated, user, isRhAdmin, login, logout, switchRole, isAuth0Live, insecureOriginDetected, isForceLocal, resetForceLocal } = useAuth()
  const [avatarCustomUrl, setAvatarCustomUrl] = useState(null)
  const [puestoUsuario, setPuestoUsuario] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('')

  useEffect(() => {
    if (!isAuthenticated) return

    // Cargar perfil institucional con token de sesión
    const fetchPerfil = async () => {
      try {
        const endpoint = isRhAdmin
          ? `${API_BASE}/hr/admin/perfil/`
          : `${API_BASE}/hr/perfil/`
        const res = await axios.get(endpoint)
        if (res.data) {
          if (res.data.foto_perfil_url) {
            setAvatarCustomUrl(res.data.foto_perfil_url)
          } else {
            setAvatarCustomUrl(null)
          }
          if (res.data.puesto) {
            setPuestoUsuario(res.data.puesto)
          }
          const fullName = res.data.user
            ? `${res.data.user.first_name || ''} ${res.data.user.last_name || ''}`.trim()
            : ''
          if (fullName) {
            setNombreUsuario(fullName)
          }
        }
      } catch (err) {
        console.warn('Error al sincronizar perfil en cabecera:', err)
      }
    }

    fetchPerfil()

    // Escuchar actualizaciones dinámicas de perfil desde los dashboards
    const handleProfileUpdated = (e) => {
      if (e.detail?.foto_perfil_url !== undefined) {
        setAvatarCustomUrl(e.detail.foto_perfil_url)
      }
      if (e.detail?.puesto) {
        setPuestoUsuario(e.detail.puesto)
      }
      if (e.detail?.user) {
        const fullName = `${e.detail.user.first_name || ''} ${e.detail.user.last_name || ''}`.trim()
        if (fullName) setNombreUsuario(fullName)
      }
    }

    window.addEventListener('profile-updated', handleProfileUpdated)
    return () => window.removeEventListener('profile-updated', handleProfileUpdated)
  }, [isAuthenticated, isRhAdmin])

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={login}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <LogIn size={16} />
          <span>Iniciar Sesión con Auth0</span>
        </button>
      </div>
    )
  }

  const defaultColabAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=150'
  const defaultRhAvatar = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=150'
  const fallbackAvatar = isRhAdmin ? defaultRhAvatar : defaultColabAvatar

  // Descartar avatares de iniciales generados automáticamente por Auth0 / Gravatar
  const isAuth0Initials = user?.picture && (
    user.picture.includes('cdn.auth0.com/avatars') ||
    user.picture.includes('gravatar.com/avatar')
  )

  const displayAvatar = avatarCustomUrl || (!isAuth0Initials && user?.picture) || fallbackAvatar

  const displayPuesto = isRhAdmin
    ? (puestoUsuario && puestoUsuario.toLowerCase().includes('recursos') ? puestoUsuario : 'Especialista de Recursos Humanos')
    : (puestoUsuario || user?.puesto || 'Colaborador')

  const displayNombre = nombreUsuario || user?.name || (isRhAdmin ? 'Administrador RH' : 'Colaborador')

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
      {/* Switcher para pruebas locales si no está en vivo */}
      {!isAuth0Live && (
        <div style={{ display: 'flex', background: 'var(--muted)', padding: '0.2rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => switchRole('colaborador')}
            style={{
              border: 'none',
              background: !isRhAdmin ? 'var(--primary)' : 'transparent',
              color: !isRhAdmin ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
              padding: '0.3rem 0.65rem',
              borderRadius: 'calc(var(--radius) - 2px)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s'
            }}
          >
            <UserCheck size={13} />
            <span>Colaborador</span>
          </button>

          <button
            onClick={() => switchRole('recursos humanos')}
            style={{
              border: 'none',
              background: isRhAdmin ? 'var(--primary)' : 'transparent',
              color: isRhAdmin ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
              padding: '0.3rem 0.65rem',
              borderRadius: 'calc(var(--radius) - 2px)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              transition: 'all 0.2s'
            }}
          >
            <Shield size={13} />
            <span>Recursos Humanos</span>
          </button>
        </div>
      )}

      {insecureOriginDetected && (
        <span
          title="El navegador restringe Web Crypto en conexiones HTTP por IP. Auth0 requiere HTTPS o localhost. Modo de prueba local habilitado."
          style={{
            fontSize: '0.74rem',
            background: 'var(--muted)',
            color: 'var(--muted-foreground)',
            padding: '0.25rem 0.6rem',
            borderRadius: 'var(--radius)',
            border: '1px dashed var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          <Shield size={12} />
          <span>Demo LAN</span>
        </span>
      )}

      {isForceLocal && (
        <button
          onClick={resetForceLocal}
          className="btn-secondary"
          title="Volver a intentar inicio de sesión con Auth0"
          style={{ padding: '0.25rem 0.55rem', fontSize: '0.74rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <span>Reconectar Auth0</span>
        </button>
      )}

      {/* User Info Avatar Badge con Foto y Puesto de Trabajo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem',
        padding: '0.3rem 0.75rem',
        borderRadius: 'var(--radius)',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <img
          src={displayAvatar}
          alt={displayNombre}
          onError={(e) => {
            if (e.currentTarget.src !== fallbackAvatar) {
              e.currentTarget.src = fallbackAvatar
            }
          }}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            objectFit: 'cover',
            border: '1.5px solid var(--border)',
            flexShrink: 0
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)' }}>
            {displayNombre}
          </span>
          <span style={{
            fontSize: '0.7rem',
            color: 'var(--muted-foreground)',
            fontWeight: 500
          }}>
            {displayPuesto}
          </span>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={logout}
        className="btn-secondary"
        title="Cerrar Sesión"
        style={{ padding: '0.45rem 0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <LogOut size={16} />
      </button>
    </div>
  )
}
