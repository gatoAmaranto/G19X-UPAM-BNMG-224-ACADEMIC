import React, { useState, useEffect } from 'react'
import { User, Calendar, FileText, Ticket, Plus, CheckCircle, Clock, Eye, Download } from 'lucide-react'
import axios from 'axios'
import VacacionesModal from './VacacionesModal.jsx'
import TicketModal from './TicketModal.jsx'
import ConstanciaPreviewModal from './ConstanciaPreviewModal.jsx'
import TicketDetalleModal from './TicketDetalleModal.jsx'


const API_BASE = 'http://localhost:8000/api'

export default function DashboardRH({ refreshTrigger }) {
  const [perfil, setPerfil] = useState(null)
  const [vacaciones, setVacaciones] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalVacacionesOpen, setModalVacacionesOpen] = useState(false)
  const [modalTicketOpen, setModalTicketOpen] = useState(false)
  const [modalConstanciaOpen, setModalConstanciaOpen] = useState(false)
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null)


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
      {/* Modales */}
      {vacaciones && (
        <VacacionesModal
          isOpen={modalVacacionesOpen}
          onClose={() => setModalVacacionesOpen(false)}
          saldoDisponibles={vacaciones.saldo.disponibles}
          onSuccess={fetchData}
        />
      )}

      <TicketModal
        isOpen={modalTicketOpen}
        onClose={() => setModalTicketOpen(false)}
        onSuccess={fetchData}
      />

      <ConstanciaPreviewModal
        isOpen={modalConstanciaOpen}
        onClose={() => setModalConstanciaOpen(false)}
      />

      <TicketDetalleModal
        isOpen={Boolean(ticketSeleccionado)}
        ticket={ticketSeleccionado}
        onClose={() => setTicketSeleccionado(null)}
      />


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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Ticket size={18} style={{ color: 'var(--primary)' }} />
            Mis Tickets de RH ({tickets.length})
          </h3>

          <button
            onClick={() => setModalTicketOpen(true)}
            className="btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <Plus size={14} />
            <span>Nuevo Ticket</span>
          </button>
        </div>

        {tickets.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)' }}>No tienes tickets de atención abiertos.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {tickets.map((t) => {
              const isResuelto = t.estado === 'RESUELTO'
              const isEnProceso = t.estado === 'EN_PROCESO'
              const isCerrado = t.estado === 'CERRADO'
              const badgeBg = isResuelto ? '#dcfce7' : isEnProceso ? '#fef3c7' : isCerrado ? 'var(--muted)' : 'var(--accent)'
              const badgeColor = isResuelto ? '#15803d' : isEnProceso ? '#b45309' : isCerrado ? 'var(--muted-foreground)' : 'var(--accent-foreground)'

              return (
                <div
                  key={t.id}
                  style={{
                    background: 'var(--muted)',
                    padding: '0.85rem',
                    borderRadius: 'var(--radius)',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, marginBottom: '0.3rem' }}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.82rem' }}>{t.folio}</span>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '0.15rem 0.45rem',
                      borderRadius: '4px',
                      background: badgeBg,
                      color: badgeColor,
                      fontWeight: 600
                    }}>
                      {t.estado}
                    </span>
                  </div>

                  <div style={{ color: 'var(--foreground)', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.88rem' }}>
                    {t.asunto}
                  </div>

                  <div style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span>{new Date(t.fecha_creacion).toLocaleDateString()}</span>
                    <span style={{
                      fontSize: '0.7rem',
                      color: t.prioridad === 'ALTA' ? '#dc2626' : t.prioridad === 'MEDIA' ? '#d97706' : '#2563eb',
                      fontWeight: 600
                    }}>
                      Prioridad {t.prioridad}
                    </span>
                  </div>

                  {/* Respuesta oficial de Recursos Humanos si ya fue resuelto/atendido */}
                  {t.respuesta_rh ? (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.55rem 0.7rem',
                      borderRadius: 'var(--radius)',
                      background: 'var(--card)',
                      borderLeft: '3px solid #16a34a',
                      fontSize: '0.78rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, color: '#16a34a', marginBottom: '0.2rem' }}>
                        <CheckCircle size={13} />
                        <span>Respuesta de Recursos Humanos:</span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--foreground)', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                        {t.respuesta_rh}
                      </p>
                    </div>
                  ) : (
                    <div style={{
                      marginTop: '0.35rem',
                      fontSize: '0.72rem',
                      color: 'var(--muted-foreground)',
                      fontStyle: 'italic',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem'
                    }}>
                      <Clock size={12} />
                      <span>En revisión por el equipo de RH...</span>
                    </div>
                  )}

                  {/* Acción para ver detalle completo */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => setTicketSeleccionado(t)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        padding: '0.15rem 0.3rem'
                      }}
                    >
                      <Eye size={13} />
                      <span>Ver detalle completo</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
