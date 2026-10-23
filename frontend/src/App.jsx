import React, { useState, useEffect, useRef } from 'react'
import { Bot, Sun, Moon, Lock, LogIn } from 'lucide-react'

import ColaboradorDashboard from './components/ColaboradorDashboard.jsx'
import AdminDashboard from './components/AdminDashboard.jsx'
import UserAuthHeader from './components/UserAuthHeader.jsx'
import { useAuth } from './auth/AuthContext.jsx'

export default function App() {
  // 1. Detectar preferencia guardada en localStorage o la del sistema operativo por defecto
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) {
      return savedTheme === 'dark'
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const { isAuthenticated, user, isRhAdmin, login, isLoading, isAuth0Live } = useAuth()
  const hasAttemptedAutoLogin = useRef(false)

  // Aplicar clase .dark en <html>
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  // Escuchar si el usuario cambia el tema del sistema operativo (si no ha fijado una preferencia manual)
  useEffect(() => {
    if (!window.matchMedia) return
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e) => {
      const savedTheme = localStorage.getItem('theme')
      if (!savedTheme) {
        setIsDarkMode(e.matches)
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  // 2. Redirección automática a Auth0 únicamente si está en modo en vivo y no se ha intentado
  useEffect(() => {
    if (isAuth0Live && !isLoading && !isAuthenticated && !hasAttemptedAutoLogin.current) {
      hasAttemptedAutoLogin.current = true
      login()
    }
  }, [isAuth0Live, isLoading, isAuthenticated, login])

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  const handleRefreshData = () => {
    setRefreshTrigger(prev => prev + 1)
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)', color: 'var(--foreground)' }}>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <Bot size={32} style={{ marginBottom: '1rem', color: 'var(--primary)' }} />
          <h3>Cargando sesión con Auth0...</h3>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)', color: 'var(--foreground)' }}>
        {/* Header no autenticado */}
        <header className="glass-panel" style={{ padding: '0.85rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 0, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <img
              src="/icon-512.png"
              alt="Logo Develop Talent & Technology"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextSibling) {
                  e.currentTarget.nextSibling.style.display = 'flex';
                }
              }}
              style={{ maxHeight: '42px', maxWidth: '140px', objectFit: 'contain' }}
            />
            <div style={{ display: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.5rem', borderRadius: 'var(--radius)', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)' }}>Develop Talent & Technology</h1>
                <span style={{ fontSize: '0.7rem', background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                  PluriOne Auth0 RBAC
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>Sistema de Autoservicio para Colaboradores mediante Agentes Conversacionales</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              className="btn-secondary"
              onClick={toggleDarkMode}
              title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            >
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
              <span>{isDarkMode ? 'Claro' : 'Oscuro'}</span>
            </button>
          </div>
        </header>

        {/* Card de Inicio de Sesión Auth0 */}
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="glass-panel" style={{ maxWidth: '420px', width: '100%', padding: '2.5rem', textAlign: 'center', borderRadius: 'var(--radius)' }}>
            <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', width: '54px', height: '54px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <Lock size={26} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Redirigiendo a Auth0...</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--muted-foreground)', marginBottom: '1.25rem' }}>
              Conectando con el inicio de sesión corporativo seguro.
            </p>
            <button
              onClick={login}
              className="btn-primary"
              style={{ width: '100%', padding: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', fontSize: '0.9rem' }}
            >
              <LogIn size={16} />
              <span>Continuar a Auth0</span>
            </button>
          </div>
        </main>

        <footer style={{ borderTop: '1px solid var(--border)', padding: '0.85rem 2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
          © 2026 PluriOne S.A. de C.V. (Develop Talent & Technology) — Autenticación Segura con Auth0 SSO & RBAC.
        </footer>
      </div>
    )
  }

  return isRhAdmin ? (
    <AdminDashboard isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
  ) : (
    <ColaboradorDashboard
      refreshTrigger={refreshTrigger}
      onRefreshData={handleRefreshData}
      isDarkMode={isDarkMode}
      toggleDarkMode={toggleDarkMode}
    />
  )
}
