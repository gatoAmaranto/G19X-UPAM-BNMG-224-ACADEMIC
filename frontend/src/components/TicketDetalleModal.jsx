import React from 'react'
import { Ticket, X, CheckCircle, Clock, AlertCircle, MessageSquare, Calendar, ShieldCheck } from 'lucide-react'

export default function TicketDetalleModal({ isOpen, onClose, ticket }) {
  if (!isOpen || !ticket) return null

  const isResuelto = ticket.estado === 'RESUELTO'
  const isEnProceso = ticket.estado === 'EN_PROCESO'
  const isCerrado = ticket.estado === 'CERRADO'

  const estadoBadgeStyle = isResuelto
    ? { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
    : isEnProceso
    ? { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }
    : isCerrado
    ? { background: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }
    : { background: 'var(--accent)', color: 'var(--accent-foreground)', border: '1px solid var(--border)' }

  const prioridadColor = ticket.prioridad === 'ALTA'
    ? '#dc2626'
    : ticket.prioridad === 'MEDIA'
    ? '#d97706'
    : '#2563eb'

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '620px',
          background: 'var(--card)',
          color: 'var(--card-foreground)',
          padding: '1.5rem',
          borderRadius: 'var(--radius)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.5rem', borderRadius: 'var(--radius)' }}>
              <Ticket size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>
                  {ticket.folio}
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontWeight: 600,
                  ...estadoBadgeStyle
                }}>
                  {ticket.estado}
                </span>
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--foreground)', marginTop: '0.2rem' }}>
                {ticket.asunto}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: '0.25rem' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Metadatos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem', background: 'var(--muted)', padding: '0.75rem 1rem', borderRadius: 'var(--radius)' }}>
          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Fecha de Reporte</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
              <Calendar size={13} style={{ color: 'var(--muted-foreground)' }} />
              {new Date(ticket.fecha_creacion).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Prioridad</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: prioridadColor, marginTop: '0.15rem', display: 'block' }}>
              {ticket.prioridad}
            </span>
          </div>

          {ticket.fecha_actualizacion && (
            <div>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Última Actualización</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.15rem' }}>
                <Clock size={13} style={{ color: 'var(--muted-foreground)' }} />
                {new Date(ticket.fecha_actualizacion).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>
          )}
        </div>

        {/* Sección: Tu Consulta Original */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Tu Consulta o Reporte
          </h4>
          <div style={{
            background: 'var(--background)',
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            fontSize: '0.88rem',
            lineHeight: 1.5,
            whiteSpace: 'pre-line',
            color: 'var(--foreground)'
          }}>
            {ticket.descripcion}
          </div>
        </div>

        {/* Sección: Respuesta Oficial de Recursos Humanos */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted-foreground)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Dictamen y Respuesta de Recursos Humanos
          </h4>

          {ticket.respuesta_rh ? (
            <div style={{
              background: 'var(--background)',
              padding: '1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              borderLeft: '4px solid #16a34a',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem', color: '#16a34a', fontWeight: 600, fontSize: '0.86rem' }}>
                <CheckCircle size={17} />
                <span>Respuesta Oficial Registrada:</span>
              </div>
              <p style={{
                margin: 0,
                fontSize: '0.9rem',
                lineHeight: 1.55,
                whiteSpace: 'pre-line',
                color: 'var(--foreground)'
              }}>
                {ticket.respuesta_rh}
              </p>
            </div>
          ) : (
            <div style={{
              background: 'var(--background)',
              padding: '1rem',
              borderRadius: 'var(--radius)',
              border: '1px dashed var(--border)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem'
            }}>
              <Clock size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.15rem' }} />
              <div>
                <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600, color: 'var(--foreground)' }}>
                  En proceso de atención
                </p>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                  Tu solicitud fue recibida por el departamento de Recursos Humanos. En cuanto un ejecutivo dictamine y resuelva tu caso, la respuesta detallada se reflejará aquí.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
          <button
            onClick={onClose}
            className="btn-primary"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
