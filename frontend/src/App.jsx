import React, { useState } from 'react'
import { Bot, Sun, Moon, Shield, UserCheck, Sparkles, LogIn, Lock } from 'lucide-react'
import ChatWidget from './components/ChatWidget.jsx'
import DashboardRH from './components/DashboardRH.jsx'
import AdminDashboard from './components/AdminDashboard.jsx'
import UserAuthHeader from './components/UserAuthHeader.jsx'
import { useAuth } from './auth/AuthContext.jsx'

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const { isAuthenticated, user, isRhAdmin, login, isLoading } = useAuth()

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle('dark')
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Navbar Header */}
      <header className="glass-panel" style={{ padding: '0.85rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 0, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.5rem', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center' }}>
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

        {/* Auth0 Profile Header & Theme Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <UserAuthHeader />

          <button className="btn-secondary" onClick={toggleDarkMode} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            <span>{isDarkMode ? 'Claro' : 'Oscuro'}</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, padding: '1.5rem 2rem', maxWidth: '1350px', width: '100%', margin: '0 auto' }}>
        {!isAuthenticated ? (
          /* Landing Screen when unauthenticated */
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div className="glass-panel" style={{ maxWidth: '480px', width: '100%', padding: '2.5rem', textAlign: 'center', borderRadius: 'var(--radius)' }}>
              <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', width: '54px', height: '54px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
                <Lock size={26} />
              </div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>Portal de Autoservicio de Recursos Humanos</h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--muted-foreground)', marginBottom: '1.75rem' }}>
                Inicia sesión con tu cuenta corporativa para acceder a tu saldo de vacaciones, solicitar constancias laborales y consultar con el Agente de IA.
              </p>
              <button
                onClick={login}
                className="btn-primary"
                style={{ width: '100%', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', fontSize: '0.95rem' }}
              >
                <LogIn size={18} />
                <span>Ingresar con Auth0 Single Sign-On</span>
              </button>
            </div>
          </div>
        ) : isRhAdmin ? (
          /* RH Admin View */
          <div>
            <div style={{ marginBottom: '1rem', background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '0.65rem 1rem', borderRadius: 'var(--radius)', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={16} />
              <span><strong>Rol Autenticado: Administrador de Recursos Humanos.</strong> Tienes acceso total al Backoffice de gestión y entrenamiento RAG.</span>
            </div>
            <AdminDashboard />
          </div>
        ) : (
          /* Colaborador View */
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem' }}>
            <div>
              <DashboardRH refreshTrigger={refreshTrigger} />
            </div>
            <div>
              <ChatWidget onRefreshData={handleRefreshData} />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '0.85rem 2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
        © 2026 PluriOne S.A. de C.V. (Develop Talent & Technology) — Autenticación Segura con Auth0 SSO & RBAC.
      </footer>
    </div>
  )
}
