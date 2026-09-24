import React, { useState } from 'react'
import { MessageSquare, Bot, User, Sun, Moon, FileText, Calendar, LifeBuoy } from 'lucide-react'

export default function App() {
  const [isDarkMode, setIsDarkMode] = useState(false)

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="glass-panel" style={{ padding: '1rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 0, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.5rem', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center' }}>
            <Bot size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--foreground)' }}>Develop Talent & Technology</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>Sistema de Autoservicio para Colaboradores — PluriOne S.A. de C.V.</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-secondary" onClick={toggleDarkMode} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            <span>{isDarkMode ? 'Claro' : 'Oscuro'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main style={{ flex: 1, padding: '2rem', maxWidth: '1200px', width: '100%', margin: '0 auto', display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem' }}>
        {/* Sidebar Navigation & Quick Actions */}
        <aside className="glass-panel" style={{ padding: '1.5rem', height: 'fit-content' }}>
          <h2 style={{ fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>Acciones Rápidas</h2>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', width: '100%' }}>
              <MessageSquare size={18} />
              <span>Nuevo Chat</span>
            </button>
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', width: '100%' }}>
              <Calendar size={18} />
              <span>Consultar Vacaciones</span>
            </button>
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', width: '100%' }}>
              <FileText size={18} />
              <span>Generar Constancia</span>
            </button>
            <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', width: '100%' }}>
              <LifeBuoy size={18} />
              <span>Mis Tickets</span>
            </button>
          </nav>
        </aside>

        {/* Chat / Area Principal */}
        <section className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', height: '600px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--muted-foreground)', textAlign: 'center' }}>
            <Bot size={48} style={{ color: 'var(--primary)', marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.25rem', color: 'var(--foreground)', marginBottom: '0.5rem' }}>¿En qué te puedo ayudar hoy?</h3>
            <p style={{ maxWidth: '400px', fontSize: '0.9rem' }}>Pregúntame sobre tus días de vacaciones, solicita tu constancia laboral o resuelve dudas de políticas de RH.</p>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              placeholder="Escribe tu consulta aquí..."
              style={{
                flex: 1,
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--input)',
                color: 'var(--foreground)',
                outline: 'none'
              }}
            />
            <button className="btn-primary">Enviar</button>
          </div>
        </section>
      </main>
    </div>
  )
}
