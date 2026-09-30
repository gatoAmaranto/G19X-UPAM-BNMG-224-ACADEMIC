import React, { useState } from 'react'
import { Ticket, X, AlertTriangle, Send } from 'lucide-react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000/api/hr'

export default function TicketModal({ isOpen, onClose, onSuccess }) {
  const [asunto, setAsunto] = useState('')
  const [prioridad, setPrioridad] = useState('MEDIA')
  const [descripcion, setDescripcion] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!asunto.trim() || !descripcion.trim()) {
      setErrorMsg('Por favor ingresa un asunto y una descripción detallada para el ticket.')
      return
    }

    try {
      setLoading(true)
      const response = await axios.post(`${API_BASE}/tickets/`, {
        asunto: asunto,
        prioridad: prioridad,
        descripcion: descripcion
      })

      if (onSuccess) {
        onSuccess(response.data)
      }
      // Limpiar formulario
      setAsunto('')
      setPrioridad('MEDIA')
      setDescripcion('')
      onClose()
    } catch (err) {
      console.error('Error al crear ticket:', err)
      setErrorMsg(err.response?.data?.error || 'Error al conectar con el servidor para registrar el ticket.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '1rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '500px',
        background: 'var(--card)',
        padding: '1.5rem',
        borderRadius: 'var(--radius)',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
      }}>
        {/* Header Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.4rem', borderRadius: 'var(--radius)' }}>
              <Ticket size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--foreground)' }}>Crear Ticket de Soporte RH</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>Canalización directa a la Mesa de Ayuda de Recursos Humanos</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius)', fontSize: '0.82rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <AlertTriangle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Asunto & Prioridad */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--foreground)' }}>
                Asunto / Título *
              </label>
              <input
                type="text"
                value={asunto}
                onChange={(e) => setAsunto(e.target.value)}
                placeholder="Ej: Corrección en recibo de nómina"
                required
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--input)',
                  color: 'var(--foreground)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--foreground)' }}>
                Prioridad *
              </label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--input)',
                  color: 'var(--foreground)',
                  fontSize: '0.85rem'
                }}
              >
                <option value="BAJA">Baja</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta</option>
              </select>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--foreground)' }}>
              Descripción Detallada *
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Explica detalladamente la duda, caso o problema que deseas que el equipo de RH revise..."
              rows={4}
              required
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--input)',
                color: 'var(--foreground)',
                fontSize: '0.85rem',
                resize: 'none'
              }}
            />
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading} style={{ fontSize: '0.85rem' }}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !asunto.trim() || !descripcion.trim()} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Send size={16} />
              <span>{loading ? 'Creando Ticket...' : 'Crear Ticket de Soporte'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
