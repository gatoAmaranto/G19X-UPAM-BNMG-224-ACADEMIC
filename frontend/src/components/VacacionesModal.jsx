import React, { useState } from 'react'
import { Calendar, X, Check, AlertTriangle, Send } from 'lucide-react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000/api/hr'

export default function VacacionesModal({ isOpen, onClose, saldoDisponibles, onSuccess }) {
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  // Calcular número de días seleccionados
  const calcularDias = () => {
    if (!fechaInicio || !fechaFin) return 0
    const start = new Date(fechaInicio)
    const end = new Date(fechaFin)
    if (end < start) return 0
    const diffTime = Math.abs(end - start)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays
  }

  const diasSolicitados = calcularDias()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!fechaInicio || !fechaFin) {
      setErrorMsg('Por favor selecciona una fecha de inicio y una fecha de fin.')
      return
    }

    if (diasSolicitados <= 0) {
      setErrorMsg('La fecha de fin debe ser posterior o igual a la fecha de inicio.')
      return
    }

    if (diasSolicitados > saldoDisponibles) {
      setErrorMsg(`No tienes suficientes días disponibles. Tienes ${saldoDisponibles} días y seleccionaste ${diasSolicitados}.`)
      return
    }

    try {
      setLoading(true)
      const response = await axios.post(`${API_BASE}/vacaciones/`, {
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        dias_solicitados: diasSolicitados,
        motivo: motivo
      })

      if (onSuccess) {
        onSuccess(response.data)
      }
      onClose()
    } catch (err) {
      console.error('Error al registrar solicitud de vacaciones:', err)
      setErrorMsg(err.response?.data?.error || 'Error al conectar con el servidor para registrar la solicitud.')
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
        maxWidth: '480px',
        background: 'var(--card)',
        padding: '1.5rem',
        borderRadius: 'var(--radius)',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
      }}>
        {/* Header Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.4rem', borderRadius: 'var(--radius)' }}>
              <Calendar size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--foreground)' }}>Solicitar Días de Vacaciones</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>Disponibles actualmente: <strong>{saldoDisponibles} días</strong></p>
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
          {/* Fechas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--foreground)' }}>
                Fecha de Inicio *
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
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
                Fecha de Fin *
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
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
          </div>

          {/* Días Calculados Badge */}
          {diasSolicitados > 0 && (
            <div style={{ background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Días solicitados a procesar:</span>
              <strong style={{ fontSize: '1rem' }}>{diasSolicitados} días</strong>
            </div>
          )}

          {/* Motivo Opcional */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', color: 'var(--foreground)' }}>
              Motivo o Notas (Opcional)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: Vacaciones familiares de fin de año..."
              rows={2}
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
            <button type="submit" className="btn-primary" disabled={loading || diasSolicitados <= 0} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Send size={16} />
              <span>{loading ? 'Enviando...' : 'Enviar Solicitud a RH'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
