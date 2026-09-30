import React, { useState, useEffect } from 'react'
import { User, Calendar, FileText, Ticket, Plus, CheckCircle, Clock } from 'lucide-react'
import axios from 'axios'
import VacacionesModal from './VacacionesModal.jsx'

const API_BASE = 'http://localhost:8000/api'

export default function DashboardRH({ refreshTrigger }) {
  const [perfil, setPerfil] = useState(null)
  const [vacaciones, setVacaciones] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalVacacionesOpen, setModalVacacionesOpen] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [resPerfil, resVacaciones, resTickets] = await Promise.all([
        axios.get(`${API_BASE}/hr/perfil/`),
        axios.get(`${API_BASE}/hr/vacaciones/`),
        axios.get(`${API_BASE}/hr/tickets/`)
      ])
      setPerfil(resPerfil.data)
      setVacaciones(resVacaciones.data)
      setTickets(resTickets.data)
    } catch (err) {
      console.error('Error al cargar datos del Dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [refreshTrigger])

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
        Cargando resumen de colaborador...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Modal de Vacaciones */}
      {vacaciones && (
        <VacacionesModal
          isOpen={modalVacacionesOpen}
          onClose={() => setModalVacacionesOpen(false)}
          saldoDisponibles={vacaciones.saldo.disponibles}
          onSuccess={fetchData}
        />
      )}

      {/* Employee Profile Card */}
      {perfil && (
        <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '0.85rem', borderRadius: '50%', display: 'flex' }}>
            <User size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--foreground)' }}>
              {perfil.user.first_name} {perfil.user.last_name}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>
              {perfil.puesto} — {perfil.departamento} ({perfil.numero_empleado})
            </p>
          </div>
        </div>
      )}

      {/* Vacation Balance Summary */}
      {vacaciones && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} style={{ color: 'var(--primary)' }} />
              Saldo de Vacaciones
            </h3>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>
              {vacaciones.saldo.disponibles} días
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', textAlign: 'center', marginBottom: '1rem' }}>
            <div style={{ background: 'var(--muted)', padding: '0.6rem', borderRadius: 'var(--radius)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block' }}>Totales</span>
              <strong style={{ fontSize: '1rem' }}>{vacaciones.saldo.totales}</strong>
            </div>
            <div style={{ background: 'var(--muted)', padding: '0.6rem', borderRadius: 'var(--radius)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'block' }}>Tomados</span>
              <strong style={{ fontSize: '1rem' }}>{vacaciones.saldo.tomados}</strong>
            </div>
            <div style={{ background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '0.6rem', borderRadius: 'var(--radius)' }}>
              <span style={{ fontSize: '0.75rem', display: 'block' }}>Disponibles</span>
              <strong style={{ fontSize: '1rem' }}>{vacaciones.saldo.disponibles}</strong>
            </div>
          </div>

          <button
            onClick={() => setModalVacacionesOpen(true)}
            className="btn-primary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.55rem' }}
          >
            <Plus size={16} />
            <span>Solicitar Vacaciones</span>
          </button>

          {/* Historial de solicitudes */}
          {vacaciones.solicitudes && vacaciones.solicitudes.length > 0 && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}>
                Historial de Solicitudes
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {vacaciones.solicitudes.map((sol) => (
                  <div key={sol.id} style={{ background: 'var(--muted)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius)', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{sol.fecha_inicio} al {sol.fecha_fin}</div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--muted-foreground)' }}>{sol.dias_solicitados} días</div>
                    </div>
                    <span style={{
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: sol.estado === 'APROBADO' ? '#dcfce7' : sol.estado === 'RECHAZADO' ? '#fee2e2' : 'var(--accent)',
                      color: sol.estado === 'APROBADO' ? '#15803d' : sol.estado === 'RECHAZADO' ? '#b91c1c' : 'var(--accent-foreground)'
                    }}>
                      {sol.estado}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Support Tickets */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Ticket size={18} style={{ color: 'var(--primary)' }} />
          Mis Tickets de RH ({tickets.length})
        </h3>

        {tickets.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>No tienes tickets de atención abiertos.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {tickets.map((t) => (
              <div key={t.id} style={{ background: 'var(--muted)', padding: '0.75rem', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '0.25rem' }}>
                  <span>`{t.folio}`</span>
                  <span style={{
                    fontSize: '0.7rem',
                    padding: '0.15rem 0.4rem',
                    borderRadius: '4px',
                    background: t.estado === 'ABIERTO' ? 'var(--accent)' : 'var(--secondary)',
                    color: t.estado === 'ABIERTO' ? 'var(--accent-foreground)' : 'var(--secondary-foreground)'
                  }}>
                    {t.estado}
                  </span>
                </div>
                <div style={{ color: 'var(--foreground)', marginBottom: '0.2rem' }}>{t.asunto}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>{new Date(t.fecha_creacion).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
