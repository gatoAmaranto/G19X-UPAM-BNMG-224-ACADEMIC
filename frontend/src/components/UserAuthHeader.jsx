import React from 'react'
import { LogIn, LogOut, Shield, UserCheck, Key } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'

export default function UserAuthHeader() {
  const { isAuthenticated, user, isRhAdmin, login, logout, switchRole, isAuth0Live } = useAuth()

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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      {/* Auth0 Status Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.72rem',
        padding: '0.2rem 0.55rem',
        borderRadius: '20px',
        background: isAuth0Live ? '#dcfce7' : 'var(--muted)',
        color: isAuth0Live ? '#15803d' : 'var(--muted-foreground)',
        border: '1px solid var(--border)',
        fontWeight: 600
      }}>
        <Key size={12} />
        <span>{isAuth0Live ? 'Auth0 Conectado' : 'Auth0 Simulación'}</span>
      </div>

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

      {/* User Info Avatar Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.25rem 0.6rem', borderRadius: 'var(--radius)', background: 'var(--card)', border: '1px solid var(--border)' }}>
        {user?.picture ? (
          <img
            src={user.picture}
            alt={user.name}
            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: 'var(--primary-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>
            {user?.name?.[0] || 'U'}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--foreground)' }}>
            {user?.name}
          </span>
          <span style={{
            fontSize: '0.7rem',
            color: isRhAdmin ? 'var(--primary)' : 'var(--muted-foreground)',
            fontWeight: isRhAdmin ? 700 : 500
          }}>
            {isRhAdmin ? 'Recursos Humanos' : 'Colaborador'}
          </span>
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={logout}
        className="btn-secondary"
        title="Cerrar Sesión"
        style={{ padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <LogOut size={16} />
      </button>
    </div>
  )
}
