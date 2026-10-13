import React, { useState, useMemo } from 'react'
import {
  Ticket, Search, Filter, Plus, CheckCircle, Clock, AlertCircle,
  Copy, Check, ArrowLeft, Calendar, ShieldCheck, MessageSquare,
  ChevronRight, RefreshCw, Layers, FileText
} from 'lucide-react'

export default function CentroTicketsColaborador({
  tickets = [],
  onCrearTicket,
  onRefresh,
  onConsultarChat
}) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('TODOS') // 'TODOS' | 'ABIERTO' | 'EN_PROCESO' | 'RESUELTO'
  const [filtroPrioridad, setFiltroPrioridad] = useState('TODAS') // 'TODAS' | 'ALTA' | 'MEDIA' | 'BAJA'
  const [ticketSeleccionadoId, setTicketSeleccionadoId] = useState(() => {
    return tickets.length > 0 ? tickets[0].id : null
  })
  const [folioCopiado, setFolioCopiado] = useState(false)

  // Metricas de tickets
  const totalTickets = tickets.length
  const ticketsAbiertos = tickets.filter(t => t.estado === 'ABIERTO').length
  const ticketsEnProceso = tickets.filter(t => t.estado === 'EN_PROCESO').length
  const ticketsResueltos = tickets.filter(t => t.estado === 'RESUELTO').length

  // Filtrado reactivo
  const ticketsFiltrados = useMemo(() => {
    return tickets.filter((t) => {
      const coincideEstado = filtroEstado === 'TODOS' || t.estado === filtroEstado
      const coincidePrioridad = filtroPrioridad === 'TODAS' || t.prioridad === filtroPrioridad
      const query = busqueda.toLowerCase().trim()
      const coincideBusqueda = !query ||
        t.folio.toLowerCase().includes(query) ||
        t.asunto.toLowerCase().includes(query) ||
        t.descripcion.toLowerCase().includes(query) ||
        (t.respuesta_rh && t.respuesta_rh.toLowerCase().includes(query))
      return coincideEstado && coincidePrioridad && coincideBusqueda
    })
  }, [tickets, filtroEstado, filtroPrioridad, busqueda])

  // Ticket actualmente seleccionado para la vista individual
  const ticketActual = useMemo(() => {
    if (!ticketSeleccionadoId) return null
    return tickets.find(t => t.id === ticketSeleccionadoId) || null
  }, [tickets, ticketSeleccionadoId])

  const handleCopiarFolio = (folio) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(folio)
      setFolioCopiado(true)
      setTimeout(() => setFolioCopiado(false), 2000)
    }
  }

  const getEstadoBadge = (estado) => {
    switch (estado) {
      case 'RESUELTO':
        return {
          bg: '#dcfce7',
          color: '#15803d',
          border: '#bbf7d0',
          label: 'Resuelto'
        }
      case 'EN_PROCESO':
        return {
          bg: '#fef3c7',
          color: '#b45309',
          border: '#fde68a',
          label: 'En Proceso'
        }
      case 'ABIERTO':
      default:
        return {
          bg: '#fee2e2',
          color: '#b91c1c',
          border: '#fecaca',
          label: 'Abierto'
        }
    }
  }

  const getPrioridadBadge = (prioridad) => {
    switch (prioridad) {
      case 'ALTA':
        return { bg: '#fee2e2', color: '#b91c1c', label: 'Alta' }
      case 'MEDIA':
        return { bg: '#fef3c7', color: '#b45309', label: 'Media' }
      case 'BAJA':
      default:
        return { bg: 'var(--muted)', color: 'var(--muted-foreground)', label: 'Baja' }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Tarjetas Superiores de Métricas y Acceso Rápido */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.85rem' }}>
        {/* Total Registrados */}
        <div
          onClick={() => { setFiltroEstado('TODOS'); setFiltroPrioridad('TODAS') }}
          style={{
            background: 'var(--card)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            border: filtroEstado === 'TODOS' ? '1px solid var(--primary)' : '1px solid var(--border)',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>Total Folios</span>
            <Ticket size={16} style={{ color: 'var(--primary)' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--foreground)' }}>
            {totalTickets}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>Expediente completo</span>
        </div>

        {/* Abiertos */}
        <div
          onClick={() => setFiltroEstado('ABIERTO')}
          style={{
            background: 'var(--card)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            border: filtroEstado === 'ABIERTO' ? '1px solid #b91c1c' : '1px solid var(--border)',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#b91c1c', fontWeight: 600 }}>Abiertos</span>
            <AlertCircle size={16} style={{ color: '#b91c1c' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#b91c1c' }}>
            {ticketsAbiertos}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>Pendientes de revisión</span>
        </div>

        {/* En Proceso */}
        <div
          onClick={() => setFiltroEstado('EN_PROCESO')}
          style={{
            background: 'var(--card)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            border: filtroEstado === 'EN_PROCESO' ? '1px solid #b45309' : '1px solid var(--border)',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 600 }}>En Proceso</span>
            <Clock size={16} style={{ color: '#b45309' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#b45309' }}>
            {ticketsEnProceso}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>En análisis por RH</span>
        </div>

        {/* Resueltos */}
        <div
          onClick={() => setFiltroEstado('RESUELTO')}
          style={{
            background: 'var(--card)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            border: filtroEstado === 'RESUELTO' ? '1px solid #15803d' : '1px solid var(--border)',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>Resueltos</span>
            <CheckCircle size={16} style={{ color: '#15803d' }} />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#15803d' }}>
            {ticketsResueltos}
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>Dictamen concluido</span>
        </div>
      </div>

      {/* 2. Barra de Control: Búsqueda, Filtros y Botón de Creación */}
      <div style={{
        background: 'var(--muted)',
        padding: '1rem',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Input de Búsqueda */}
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
            <input
              type="text"
              placeholder="Buscar por folio (TK-), asunto o palabras clave..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2.2rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--input)',
                color: 'var(--foreground)',
                fontSize: '0.85rem'
              }}
            />
          </div>

          {/* Botones de Acción */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="btn-secondary"
                title="Actualizar tickets"
                style={{ padding: '0.45rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <RefreshCw size={14} />
                <span>Actualizar</span>
              </button>
            )}

            <button
              onClick={onCrearTicket}
              className="btn-primary"
              style={{ padding: '0.45rem 0.95rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
            >
              <Plus size={15} />
              <span>Nuevo Ticket</span>
            </button>
          </div>
        </div>

        {/* Chips de Filtro de Estado y Prioridad */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          {/* Filtros por Estado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Filter size={12} /> Estado:
            </span>
            {[
              { id: 'TODOS', label: `Todos (${totalTickets})` },
              { id: 'ABIERTO', label: `Abiertos (${ticketsAbiertos})` },
              { id: 'EN_PROCESO', label: `En Proceso (${ticketsEnProceso})` },
              { id: 'RESUELTO', label: `Resueltos (${ticketsResueltos})` }
            ].map((opcion) => (
              <button
                key={opcion.id}
                onClick={() => setFiltroEstado(opcion.id)}
                style={{
                  background: filtroEstado === opcion.id ? 'var(--primary)' : 'var(--card)',
                  color: filtroEstado === opcion.id ? 'var(--primary-foreground)' : 'var(--foreground)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  transition: 'all 0.15s ease'
                }}
              >
                {opcion.label}
              </button>
            ))}
          </div>

          {/* Filtros por Prioridad */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--muted-foreground)' }}>
              Prioridad:
            </span>
            {['TODAS', 'ALTA', 'MEDIA', 'BAJA'].map((prio) => (
              <button
                key={prio}
                onClick={() => setFiltroPrioridad(prio)}
                style={{
                  background: filtroPrioridad === prio ? 'var(--foreground)' : 'var(--card)',
                  color: filtroPrioridad === prio ? 'var(--background)' : 'var(--muted-foreground)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '8px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  transition: 'all 0.15s ease'
                }}
              >
                {prio === 'TODAS' ? 'Todas' : prio}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Área Principal Master-Detail: Listado a la izquierda, Vista Individual a la derecha */}
      {ticketsFiltrados.length === 0 ? (
        <div style={{
          padding: '2.5rem',
          textAlign: 'center',
          background: 'var(--muted)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)'
        }}>
          <Ticket size={36} style={{ color: 'var(--muted-foreground)', margin: '0 auto 0.75rem', opacity: 0.6 }} />
          <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
            No se encontraron tickets
          </h4>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
            {busqueda || filtroEstado !== 'TODOS' || filtroPrioridad !== 'TODAS'
              ? 'No hay registros que coincidan con los filtros o criterio de búsqueda aplicados.'
              : 'Aún no has generado ninguna solicitud o ticket de soporte a Recursos Humanos.'}
          </p>
          <button
            onClick={onCrearTicket}
            className="btn-primary"
            style={{ fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
          >
            Registrar mi primer ticket
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 380px) 1fr',
          gap: '1.25rem',
          alignItems: 'start'
        }}>
          {/* Panel Izquierdo: Lista Maestra de Tickets */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            maxHeight: '750px',
            overflowY: 'auto',
            paddingRight: '0.25rem'
          }}>
            <div style={{ fontSize: '0.76rem', color: 'var(--muted-foreground)', fontWeight: 600, padding: '0 0.25rem' }}>
              Mostrando {ticketsFiltrados.length} de {totalTickets} tickets
            </div>

            {ticketsFiltrados.map((ticket) => {
              const esSeleccionado = ticketActual?.id === ticket.id
              const badgeEstado = getEstadoBadge(ticket.estado)
              const badgePrioridad = getPrioridadBadge(ticket.prioridad)

              return (
                <div
                  key={ticket.id}
                  onClick={() => setTicketSeleccionadoId(ticket.id)}
                  style={{
                    background: esSeleccionado ? 'var(--card)' : 'var(--muted)',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius)',
                    border: esSeleccionado ? '2px solid var(--primary)' : '1px solid var(--border)',
                    boxShadow: esSeleccionado ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.45rem'
                  }}
                >
                  {/* Encabezado de la tarjeta: Folio y Estado */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      color: esSeleccionado ? 'var(--primary)' : 'var(--foreground)'
                    }}>
                      {ticket.folio}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '10px',
                        background: badgeEstado.bg,
                        color: badgeEstado.color,
                        border: `1px solid ${badgeEstado.border}`
                      }}>
                        {badgeEstado.label}
                      </span>
                    </div>
                  </div>

                  {/* Asunto */}
                  <h4 style={{
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'var(--foreground)',
                    margin: 0,
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {ticket.asunto}
                  </h4>

                  {/* Pie de tarjeta: Prioridad, Fecha y Estado de Dictamen */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '0.2rem',
                    fontSize: '0.72rem',
                    color: 'var(--muted-foreground)'
                  }}>
                    <span style={{
                      padding: '0.1rem 0.35rem',
                      borderRadius: '4px',
                      fontWeight: 600,
                      background: badgePrioridad.bg,
                      color: badgePrioridad.color
                    }}>
                      {badgePrioridad.label}
                    </span>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {ticket.respuesta_rh && (
                        <span style={{ color: '#15803d', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600 }}>
                          <CheckCircle size={12} />
                          <span>Resuelto</span>
                        </span>
                      )}
                      <span>
                        {new Date(ticket.fecha_creacion).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                      </span>
                      <ChevronRight size={13} style={{ color: esSeleccionado ? 'var(--primary)' : 'var(--muted-foreground)' }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Panel Derecho: Vista Individual Detallada del Ticket Seleccionado */}
          {ticketActual ? (
            <div style={{
              background: 'var(--card)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
              minHeight: '520px'
            }}>
              {/* Encabezado del Expediente Individual */}
              <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.45rem', borderRadius: 'var(--radius)', display: 'flex' }}>
                      <Ticket size={20} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {ticketActual.folio}
                        </span>
                        <button
                          onClick={() => handleCopiarFolio(ticketActual.folio)}
                          title="Copiar folio al portapapeles"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: folioCopiado ? '#15803d' : 'var(--muted-foreground)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.35rem',
                            borderRadius: '4px'
                          }}
                        >
                          {folioCopiado ? <Check size={13} /> : <Copy size={13} />}
                          <span>{folioCopiado ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>
                      <span style={{ fontSize: '0.76rem', color: 'var(--muted-foreground)' }}>
                        Expediente Individual de Atención y Soporte
                      </span>
                    </div>
                  </div>

                  {/* Badges de Estado y Prioridad */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      padding: '0.25rem 0.65rem',
                      borderRadius: '12px',
                      background: getEstadoBadge(ticketActual.estado).bg,
                      color: getEstadoBadge(ticketActual.estado).color,
                      border: `1px solid ${getEstadoBadge(ticketActual.estado).border}`
                    }}>
                      {getEstadoBadge(ticketActual.estado).label}
                    </span>

                    <span style={{
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      padding: '0.25rem 0.65rem',
                      borderRadius: '8px',
                      background: getPrioridadBadge(ticketActual.prioridad).bg,
                      color: getPrioridadBadge(ticketActual.prioridad).color
                    }}>
                      Prioridad {getPrioridadBadge(ticketActual.prioridad).label}
                    </span>
                  </div>
                </div>

                {/* Asunto Principal del Ticket */}
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)', margin: '0.65rem 0 0 0' }}>
                  {ticketActual.asunto}
                </h3>
              </div>

              {/* Barra de Progreso / Ciclo de Vida del Ticket */}
              <div style={{
                background: 'var(--muted)',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)'
              }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.65rem' }}>
                  Seguimiento de Atención
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', position: 'relative' }}>
                  {/* Etapa 1: Registro */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#15803d', fontWeight: 700, fontSize: '0.78rem' }}>
                      <CheckCircle size={15} />
                      <span>1. Registrado</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
                      {new Date(ticketActual.fecha_creacion).toLocaleDateString('es-MX')} {new Date(ticketActual.fecha_creacion).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Etapa 2: En Análisis */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      color: ticketActual.estado === 'RESUELTO' || ticketActual.estado === 'EN_PROCESO' ? '#15803d' : '#b45309',
                      fontWeight: 700,
                      fontSize: '0.78rem'
                    }}>
                      {ticketActual.estado === 'RESUELTO' || ticketActual.estado === 'EN_PROCESO' ? (
                        <CheckCircle size={15} />
                      ) : (
                        <Clock size={15} />
                      )}
                      <span>2. Revisión RH</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
                      {ticketActual.estado === 'ABIERTO' ? 'En cola de espera' : 'Canalizado al equipo'}
                    </span>
                  </div>

                  {/* Etapa 3: Dictamen y Resolución */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      color: ticketActual.estado === 'RESUELTO' ? '#15803d' : 'var(--muted-foreground)',
                      fontWeight: 700,
                      fontSize: '0.78rem'
                    }}>
                      {ticketActual.estado === 'RESUELTO' ? (
                        <CheckCircle size={15} />
                      ) : (
                        <Clock size={15} />
                      )}
                      <span>3. Dictaminado</span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
                      {ticketActual.estado === 'RESUELTO' ? 'Respuesta emitida' : 'Pendiente de dictamen'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Consulta / Reporte Original del Colaborador */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText size={15} style={{ color: 'var(--primary)' }} />
                  <h4 style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Descripción de tu Consulta o Reporte
                  </h4>
                </div>
                <div style={{
                  background: 'var(--background)',
                  padding: '1rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  fontSize: '0.88rem',
                  lineHeight: 1.6,
                  color: 'var(--foreground)',
                  whiteSpace: 'pre-line'
                }}>
                  {ticketActual.descripcion}
                </div>
              </div>

              {/* Dictamen y Respuesta Oficial de Recursos Humanos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={16} style={{ color: ticketActual.respuesta_rh ? '#16a34a' : 'var(--muted-foreground)' }} />
                  <h4 style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Dictamen Oficial de Recursos Humanos
                  </h4>
                </div>

                {ticketActual.respuesta_rh ? (
                  <div style={{
                    background: 'var(--card)',
                    padding: '1.15rem',
                    borderRadius: 'var(--radius)',
                    borderLeft: '4px solid #16a34a',
                    borderTop: '1px solid var(--border)',
                    borderRight: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#16a34a', fontWeight: 700, fontSize: '0.85rem' }}>
                      <CheckCircle size={16} />
                      <span>Respuesta oficial emitida al colaborador:</span>
                    </div>

                    <p style={{
                      margin: 0,
                      color: 'var(--foreground)',
                      fontSize: '0.88rem',
                      lineHeight: 1.6,
                      whiteSpace: 'pre-line'
                    }}>
                      {ticketActual.respuesta_rh}
                    </p>

                    {ticketActual.fecha_actualizacion && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.35rem' }}>
                        Atendido formalmente el {new Date(ticketActual.fecha_actualizacion).toLocaleDateString('es-MX')} a las {new Date(ticketActual.fecha_actualizacion).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{
                    background: 'var(--muted)',
                    padding: '1.25rem',
                    borderRadius: 'var(--radius)',
                    border: '1px dashed var(--border)',
                    textAlign: 'center',
                    color: 'var(--muted-foreground)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Clock size={24} style={{ color: '#b45309' }} />
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--foreground)' }}>
                      En espera de atención por Recursos Humanos
                    </p>
                    <p style={{ margin: 0, fontSize: '0.78rem', maxWidth: '420px', lineHeight: 1.4 }}>
                      Tu solicitud se encuentra en trámite. En cuanto el equipo de Recursos Humanos analice y dicte una resolución, se publicará en este apartado y podrás consultarla en cualquier momento.
                    </p>
                  </div>
                )}
              </div>

              {/* Botón opcional para consultar con el Agente Conversacional */}
              {onConsultarChat && (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '0.85rem',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '0.65rem'
                }}>
                  <button
                    onClick={() => onConsultarChat(ticketActual)}
                    className="btn-secondary"
                    style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <MessageSquare size={14} />
                    <span>Preguntar al Asistente sobre este ticket</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              background: 'var(--card)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              padding: '2.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              minHeight: '400px',
              color: 'var(--muted-foreground)'
            }}>
              <Ticket size={40} style={{ color: 'var(--muted-foreground)', marginBottom: '0.85rem', opacity: 0.5 }} />
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.35rem' }}>
                Selecciona un ticket para ver su expediente
              </h4>
              <p style={{ fontSize: '0.82rem', maxWidth: '340px' }}>
                Haz clic en cualquiera de tus folios del listado lateral para visualizar su seguimiento, historial y resolución emitida por Recursos Humanos.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
