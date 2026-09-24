import React, { useState } from 'react'
import { Bot, Sun, Moon, Sparkles, Building2 } from 'lucide-react'
import ChatWidget from './components/ChatWidget.jsx'
import DashboardRH from './components/DashboardRH.jsx'

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle('dark')
  }

  const handleRefreshData = () => {
    setRefreshTrigger(prev => prev + 1)
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
                PluriOne HRTech
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>Sistema de Autoservicio para Colaboradores mediante Agentes Conversacionales</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-secondary" onClick={toggleDarkMode} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            <span>{isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>
          </button>
        </div>
      </header>

      {/* Main Two-Column Layout */}
      <main style={{ flex: 1, padding: '1.5rem 2rem', maxWidth: '1350px', width: '100%', margin: '0 auto', display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem' }}>
        {/* Left Column: Dashboard & Quick Stats */}
        <div>
          <DashboardRH refreshTrigger={refreshTrigger} />
        </div>

        {/* Right Column: Conversational AI Agent Chat Widget */}
        <div>
          <ChatWidget onRefreshData={handleRefreshData} />
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '0.85rem 2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
        © 2026 PluriOne S.A. de C.V. (Develop Talent & Technology) — Puebla 46, Col. Roma Norte, CDMX.
      </footer>
    </div>
  )
}
