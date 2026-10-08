import React, { useState, useEffect, useRef } from 'react'
import {
  User, Calendar, Ticket, Bot, FileText, CheckCircle, Clock,
  Plus, Camera, Trash2, Mail, Briefcase, Building, Award,
  AlertCircle, RefreshCw, Eye, Download, Shield, ExternalLink
} from 'lucide-react'
import axios from 'axios'
import ChatWidget from './ChatWidget.jsx'
import VacacionesModal from './VacacionesModal.jsx'
import TicketModal from './TicketModal.jsx'
import ConstanciaPreviewModal from './ConstanciaPreviewModal.jsx'
import TicketDetalleModal from './TicketDetalleModal.jsx'

const API_BASE = 'http://localhost:8000/api'

export default function ColaboradorDashboard({ refreshTrigger, onRefreshData }) {
  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'perfil' | 'vacaciones' | 'tickets' | 'constancia'
  const [perfil, setPerfil] = useState(null)
  const [vacaciones, setVacaciones] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  // Modales operativos
  const [modalVacacionesOpen, setModalVacacionesOpen] = useState(false)
  const [modalTicketOpen, setModalTicketOpen] = useState(false)
  const [modalConstanciaOpen, setModalConstanciaOpen] = useState(false)
  const [ticketSeleccionado, setTicketSeleccionado] = useState(null)

  // Estados de carga de foto de perfil del colaborador
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [msgFoto, setMsgFoto] = useState(null)
  const [previewFoto, setPreviewFoto] = useState(null)
  const [archivoFoto, setArchivoFoto] = useState(null)
  const fileInputRef = useRef(null)

  // Configuración para generación directa de constancia
  const [dirigidoConstancia, setDirigidoConstancia] = useState('A quien corresponda')
  const [incluirSueldoConstancia, setIncluirSueldoConstancia] = useState(true)
  const [generandoPdf, setGenerandoPdf] = useState(false)

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
      console.error('Error al cargar datos del portal de colaborador:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [refreshTrigger])

  // Manejadores de Fotografía de Perfil
  const handleSelectFoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMsgFoto({ type: 'error', text: 'Por favor selecciona un archivo de imagen válido (PNG, JPG o WebP).' })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setMsgFoto({ type: 'error', text: 'La imagen excede el límite máximo permitido de 5 MB.' })
      return
    }

    setArchivoFoto(file)
    setPreviewFoto(URL.createObjectURL(file))
    setMsgFoto(null)
  }

  const handleUploadFoto = async () => {
    if (!archivoFoto) return

    const formData = new FormData()
    formData.append('foto_perfil', archivoFoto)

    try {
      setSubiendoFoto(true)
      setMsgFoto(null)

      const res = await axios.post(`${API_BASE}/hr/perfil/avatar/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setPerfil(res.data)
      setArchivoFoto(null)
      setPreviewFoto(null)
      setMsgFoto({ type: 'success', text: 'Fotografía de perfil actualizada con éxito.' })
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: res.data }))
    } catch (err) {
      console.error('Error al subir foto de perfil:', err)
      setMsgFoto({
        type: 'error',
        text: err.response?.data?.error || 'Error al guardar la fotografía de perfil.'
      })
    } finally {
      setSubiendoFoto(false)
    }
  }

  const handleCancelFoto = () => {
    setArchivoFoto(null)
    if (previewFoto) {
      URL.revokeObjectURL(previewFoto)
      setPreviewFoto(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDeleteFoto = async () => {
    if (!window.confirm('¿Deseas remover tu fotografía de perfil actual?')) return

    try {
      setSubiendoFoto(true)
      setMsgFoto(null)

      const res = await axios.delete(`${API_BASE}/hr/perfil/avatar/`)
      setPerfil(res.data)
      setArchivoFoto(null)
      setPreviewFoto(null)
      setMsgFoto({ type: 'success', text: 'Fotografía de perfil eliminada.' })
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: res.data }))
    } catch (err) {
      console.error('Error al eliminar foto de perfil:', err)
      setMsgFoto({ type: 'error', text: 'No se pudo remover la fotografía de perfil.' })
    } finally {
      setSubiendoFoto(false)
    }
  }

  // Descarga directa de constancia PDF
  const handleDescargarConstanciaDirecta = async () => {
    try {
      setGenerandoPdf(true)
      const res = await axios.post(`${API_BASE}/hr/constancia/?download=true`, {
        dirigido_a: dirigidoConstancia,
        incluir_sueldo: incluirSueldoConstancia
      }, { responseType: 'blob' })

      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Constancia_Laboral_${perfil?.numero_empleado || 'Colaborador'}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error al descargar constancia PDF:', err)
      alert('Error al generar el documento PDF de constancia laboral.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  const ticketsAbiertosCount = tickets.filter(t => t.estado !== 'RESUELTO').length
  const diasDisponibles = vacaciones?.saldo?.disponibles ?? perfil?.dias_vacaciones_disponibles ?? 0

  const formattedSalary = perfil?.salario_mensual
    ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(perfil.salario_mensual)
    : 'Confidencial'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* Modales operativos */}
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

      {/* Sidenavbar Lateral del Colaborador */}
      <aside
        className="glass-panel"
        style={{
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          position: 'sticky',
          top: '1rem'
        }}
      >
        {/* Encabezado del Menú Lateral */}
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.45rem', borderRadius: 'var(--radius)', display: 'flex' }}>
              <Bot size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--foreground)' }}>Portal Colaborador</h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Autoservicio PluriOne</span>
            </div>
          </div>
        </div>

        {/* Enlaces de Navegación del Sidenavbar */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {/* Opción 1: Asistente Virtual */}
          <button
            onClick={() => setActiveTab('chat')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.7rem 0.85rem',
              borderRadius: 'var(--radius)',
              border: activeTab === 'chat' ? '1px solid var(--primary)' : '1px solid transparent',
              background: activeTab === 'chat' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'chat' ? 'var(--primary-foreground)' : 'var(--foreground)',
              cursor: 'pointer',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'chat' ? 600 : 500,
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Bot size={18} />
              <span>Asistente Virtual</span>
            </div>
            <span style={{
              fontSize: '0.68rem',
              padding: '0.15rem 0.45rem',
              borderRadius: '10px',
              background: activeTab === 'chat' ? 'var(--primary-foreground)' : 'var(--accent)',
              color: activeTab === 'chat' ? 'var(--primary)' : 'var(--accent-foreground)',
              fontWeight: 700
            }}>
              IA
            </span>
          </button>

          {/* Opción 2: Mi Perfil Laboral */}
          <button
            onClick={() => setActiveTab('perfil')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.7rem 0.85rem',
              borderRadius: 'var(--radius)',
              border: activeTab === 'perfil' ? '1px solid var(--primary)' : '1px solid transparent',
              background: activeTab === 'perfil' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'perfil' ? 'var(--primary-foreground)' : 'var(--foreground)',
              cursor: 'pointer',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'perfil' ? 600 : 500,
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <User size={18} />
              <span>Mi Perfil Laboral</span>
            </div>
            {perfil?.foto_perfil_url ? (
              <img
                src={perfil.foto_perfil_url}
                alt="Avatar"
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: activeTab === 'perfil' ? '1px solid var(--primary-foreground)' : '1px solid var(--border)'
                }}
              />
            ) : (
              <span style={{
                fontSize: '0.68rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '8px',
                background: activeTab === 'perfil' ? 'var(--primary-foreground)' : 'var(--muted)',
                color: activeTab === 'perfil' ? 'var(--primary)' : 'var(--muted-foreground)',
                fontWeight: 600
              }}>
                Foto
              </span>
            )}
          </button>

          {/* Opción 3: Mis Vacaciones */}
          <button
            onClick={() => setActiveTab('vacaciones')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.7rem 0.85rem',
              borderRadius: 'var(--radius)',
              border: activeTab === 'vacaciones' ? '1px solid var(--primary)' : '1px solid transparent',
              background: activeTab === 'vacaciones' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'vacaciones' ? 'var(--primary-foreground)' : 'var(--foreground)',
              cursor: 'pointer',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'vacaciones' ? 600 : 500,
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Calendar size={18} />
              <span>Mis Vacaciones</span>
            </div>
            <span style={{
              fontSize: '0.7rem',
              padding: '0.15rem 0.45rem',
              borderRadius: '10px',
              background: activeTab === 'vacaciones' ? 'var(--primary-foreground)' : '#dcfce7',
              color: activeTab === 'vacaciones' ? 'var(--primary)' : '#15803d',
              fontWeight: 700
            }}>
              {diasDisponibles}d
            </span>
          </button>

          {/* Opción 4: Mis Tickets */}
          <button
            onClick={() => setActiveTab('tickets')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.7rem 0.85rem',
              borderRadius: 'var(--radius)',
              border: activeTab === 'tickets' ? '1px solid var(--primary)' : '1px solid transparent',
              background: activeTab === 'tickets' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'tickets' ? 'var(--primary-foreground)' : 'var(--foreground)',
              cursor: 'pointer',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'tickets' ? 600 : 500,
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Ticket size={18} />
              <span>Mis Tickets</span>
            </div>
            {ticketsAbiertosCount > 0 && (
              <span style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '10px',
                background: activeTab === 'tickets' ? 'var(--primary-foreground)' : '#dbeafe',
                color: activeTab === 'tickets' ? 'var(--primary)' : '#1d4ed8',
                fontWeight: 700
              }}>
                {ticketsAbiertosCount}
              </span>
            )}
          </button>

          {/* Opción 5: Constancia Laboral */}
          <button
            onClick={() => setActiveTab('constancia')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.7rem 0.85rem',
              borderRadius: 'var(--radius)',
              border: activeTab === 'constancia' ? '1px solid var(--primary)' : '1px solid transparent',
              background: activeTab === 'constancia' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'constancia' ? 'var(--primary-foreground)' : 'var(--foreground)',
              cursor: 'pointer',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'constancia' ? 600 : 500,
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <FileText size={18} />
              <span>Constancia PDF</span>
            </div>
            <span style={{
              fontSize: '0.68rem',
              padding: '0.15rem 0.45rem',
              borderRadius: '8px',
              background: activeTab === 'constancia' ? 'var(--primary-foreground)' : 'var(--muted)',
              color: activeTab === 'constancia' ? 'var(--primary)' : 'var(--muted-foreground)',
              fontWeight: 600
            }}>
              PDF
            </span>
          </button>
        </nav>

        {/* Resumen de Métricas / Estado */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>Días Disponibles:</span>
              <strong style={{ color: diasDisponibles > 0 ? '#15803d' : 'var(--foreground)' }}>
                {diasDisponibles} días
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tickets Activos:</span>
              <strong style={{ color: ticketsAbiertosCount > 0 ? '#1d4ed8' : 'var(--foreground)' }}>
                {ticketsAbiertosCount} pendientes
              </strong>
            </div>
          </div>

          <button
            onClick={fetchData}
            className="btn-secondary"
            style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '0.3rem' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Sincronizar datos</span>
          </button>
        </div>
      </aside>

      {/* Área Principal de Contenido del Colaborador */}
      <main className="glass-panel" style={{ padding: '1.5rem', minHeight: '640px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Encabezado dinámico de la sección activa */}
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {activeTab === 'chat' && 'Asistente Conversacional & Autoservicio con IA'}
              {activeTab === 'perfil' && 'Mi Expediente Laboral & Fotografía de Perfil'}
              {activeTab === 'vacaciones' && 'Control y Solicitud de Vacaciones'}
              {activeTab === 'tickets' && 'Mesa de Ayuda y Mis Tickets de Soporte'}
              {activeTab === 'constancia' && 'Emisión de Constancia Laboral Membretada'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
              {activeTab === 'chat' && 'Interactúa con el agente conversacional inteligente para resolver dudas o tramitar solicitudes.'}
              {activeTab === 'perfil' && 'Consulta tu información oficial, antigüedad calculada y administra tu fotografía institucional.'}
              {activeTab === 'vacaciones' && 'Monitorea tu saldo vacacional, consulta el historial de solicitudes y envía nuevas peticiones a RH.'}
              {activeTab === 'tickets' && 'Da seguimiento a tus reportes, consulta las respuestas de RH y abre nuevos folios de atención.'}
              {activeTab === 'constancia' && 'Genera y descarga en tiempo real tu constancia laboral en formato PDF oficial.'}
            </p>
          </div>
        </div>

        {/* Tab 1: Asistente Virtual Conversacional */}
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <ChatWidget onRefreshData={fetchData} />
          </div>
        )}

        {/* Tab 2: Mi Perfil Laboral (PANTALLA DEDICADA SIN MODAL) */}
        {activeTab === 'perfil' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {!perfil ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                Cargando expediente del colaborador...
              </div>
            ) : (
              <>
                {/* Tarjeta de Identidad y Fotografía */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem',
                    padding: '1.5rem',
                    background: 'var(--muted)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)'
                  }}
                >
                  {/* Avatar con botón de cámara */}
                  <div style={{ position: 'relative', width: '96px', height: '96px', flexShrink: 0 }}>
                    {previewFoto || perfil.foto_perfil_url ? (
                      <img
                        src={previewFoto || perfil.foto_perfil_url}
                        alt={`${perfil.user.first_name} ${perfil.user.last_name}`}
                        style={{
                          width: '96px',
                          height: '96px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '3px solid var(--primary)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '96px',
                          height: '96px',
                          borderRadius: '50%',
                          background: 'var(--primary)',
                          color: 'var(--primary-foreground)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '2.2rem',
                          fontWeight: 700,
                          border: '3px solid var(--border)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}
                      >
                        {perfil.user.first_name?.[0] || 'C'}
                      </div>
                    )}

                    {/* Botón flotante para seleccionar foto */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={subiendoFoto}
                      title="Cambiar fotografía de perfil"
                      style={{
                        position: 'absolute',
                        bottom: '2px',
                        right: '2px',
                        background: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                        border: '2px solid var(--card)',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                      }}
                    >
                      <Camera size={15} />
                    </button>

                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handleSelectFoto}
                      style={{ display: 'none' }}
                    />
                  </div>

                  {/* Datos del Colaborador */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)' }}>
                        {perfil.user.first_name} {perfil.user.last_name}
                      </h3>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '12px',
                          background: 'var(--accent)',
                          color: 'var(--accent-foreground)',
                          fontWeight: 600
                        }}
                      >
                        Colaborador Activo
                      </span>
                    </div>

                    <p style={{ fontSize: '0.88rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                      {perfil.puesto} — {perfil.departamento}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                      No. Empleado: <strong>{perfil.numero_empleado}</strong> • {perfil.user.email}
                    </p>

                    {/* Acciones al seleccionar archivo nuevo */}
                    {archivoFoto && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.65rem' }}>
                        <button
                          onClick={handleUploadFoto}
                          disabled={subiendoFoto}
                          className="btn-primary"
                          style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          {subiendoFoto ? <RefreshCw size={13} className="spin" /> : <CheckCircle size={13} />}
                          <span>{subiendoFoto ? 'Subiendo...' : 'Guardar nueva fotografía'}</span>
                        </button>
                        <button
                          onClick={handleCancelFoto}
                          disabled={subiendoFoto}
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                        >
                          Cancelar
                        </button>
                      </div>
                    )}

                    {/* Opción de eliminar foto actual */}
                    {!archivoFoto && perfil.foto_perfil_url && (
                      <button
                        onClick={handleDeleteFoto}
                        disabled={subiendoFoto}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.2rem 0',
                          marginTop: '0.4rem'
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Remover fotografía</span>
                      </button>
                    )}

                    {/* Mensajes de feedback */}
                    {msgFoto && (
                      <div
                        style={{
                          padding: '0.35rem 0.65rem',
                          borderRadius: 'var(--radius)',
                          fontSize: '0.78rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          marginTop: '0.5rem',
                          background: msgFoto.type === 'success' ? '#dcfce7' : '#fee2e2',
                          color: msgFoto.type === 'success' ? '#15803d' : '#b91c1c',
                          border: `1px solid ${msgFoto.type === 'success' ? '#86efac' : '#fca5a5'}`
                        }}
                      >
                        {msgFoto.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                        <span>{msgFoto.text}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cuadrícula de Datos Oficiales del Expediente */}
                <div>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.65rem' }}>
                    Ficha Laboral Oficial
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem' }}>
                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Número de Empleado</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                        {perfil.numero_empleado}
                      </strong>
                    </div>

                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Correo Corporativo</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)', wordBreak: 'break-all' }}>
                        {perfil.user.email}
                      </strong>
                    </div>

                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Puesto Actual</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                        {perfil.puesto}
                      </strong>
                    </div>

                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Departamento</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                        {perfil.departamento}
                      </strong>
                    </div>

                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Fecha de Contratación</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                        {perfil.fecha_ingreso || 'No registrada'}
                      </strong>
                    </div>

                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Antigüedad Calculada</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--primary)' }}>
                        {perfil.antiguedad_anios ?? 1} {Number(perfil.antiguedad_anios) === 1 ? 'año' : 'años'}
                      </strong>
                    </div>

                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Salario Mensual Bruto</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                        {formattedSalary}
                      </strong>
                    </div>

                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Saldo Disponible</span>
                      <strong style={{ fontSize: '0.88rem', color: '#15803d' }}>
                        {perfil.dias_vacaciones_disponibles} días de descanso
                      </strong>
                    </div>

                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Estatus Laboral</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--primary)' }}>
                        Contrato Indeterminado
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Resumen de Beneficio Vacacional */}
                <div style={{ background: 'var(--muted)', padding: '0.85rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>
                      Resumen de Días de Vacaciones Anuales
                    </span>
                    <button
                      onClick={() => setModalVacacionesOpen(true)}
                      className="btn-primary"
                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Plus size={13} />
                      <span>Solicitar Vacaciones</span>
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                    <div style={{ background: 'var(--card)', padding: '0.55rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block' }}>Asignados</span>
                      <strong style={{ fontSize: '0.95rem' }}>{perfil.dias_vacaciones_totales}</strong>
                    </div>
                    <div style={{ background: 'var(--card)', padding: '0.55rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block' }}>Tomados</span>
                      <strong style={{ fontSize: '0.95rem' }}>{perfil.dias_vacaciones_tomados}</strong>
                    </div>
                    <div style={{ background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '0.55rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
                      <span style={{ fontSize: '0.7rem', display: 'block' }}>Disponibles</span>
                      <strong style={{ fontSize: '0.95rem' }}>{perfil.dias_vacaciones_disponibles}</strong>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Mis Vacaciones */}
        {activeTab === 'vacaciones' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {vacaciones && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem', textAlign: 'center' }}>
                  <div style={{ background: 'var(--muted)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.2rem' }}>Días Totales</span>
                    <strong style={{ fontSize: '1.35rem', color: 'var(--foreground)' }}>{vacaciones.saldo.totales}</strong>
                  </div>
                  <div style={{ background: 'var(--muted)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.2rem' }}>Días Disfrutados</span>
                    <strong style={{ fontSize: '1.35rem', color: 'var(--foreground)' }}>{vacaciones.saldo.tomados}</strong>
                  </div>
                  <div style={{ background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.78rem', display: 'block', marginBottom: '0.2rem' }}>Días Disponibles</span>
                    <strong style={{ fontSize: '1.35rem' }}>{vacaciones.saldo.disponibles}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--foreground)' }}>
                    Historial de Solicitudes de Vacaciones
                  </h3>
                  <button
                    onClick={() => setModalVacacionesOpen(true)}
                    className="btn-primary"
                    style={{ fontSize: '0.84rem', padding: '0.45rem 0.95rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    <Plus size={15} />
                    <span>Nueva Solicitud de Vacaciones</span>
                  </button>
                </div>

                {vacaciones.solicitudes.length === 0 ? (
                  <p style={{ fontSize: '0.88rem', color: 'var(--muted-foreground)', padding: '1rem 0' }}>
                    No tienes solicitudes de vacaciones registradas.
                  </p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '0.75rem' }}>Período Solicitado</th>
                          <th style={{ padding: '0.75rem' }}>Días</th>
                          <th style={{ padding: '0.75rem' }}>Motivo</th>
                          <th style={{ padding: '0.75rem' }}>Fecha de Registro</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vacaciones.solicitudes.map((sol) => (
                          <tr key={sol.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                              {sol.fecha_inicio} al {sol.fecha_fin}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              {sol.dias_solicitados} días
                            </td>
                            <td style={{ padding: '0.75rem', color: 'var(--muted-foreground)' }}>
                              {sol.motivo || 'Sin especificar'}
                            </td>
                            <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                              {new Date(sol.fecha_creacion).toLocaleDateString('es-MX')}
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                              <span style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background:
                                  sol.estado === 'APROBADO' ? '#dcfce7' :
                                  sol.estado === 'RECHAZADO' ? '#fee2e2' : '#fef3c7',
                                color:
                                  sol.estado === 'APROBADO' ? '#15803d' :
                                  sol.estado === 'RECHAZADO' ? '#b91c1c' : '#b45309'
                              }}>
                                {sol.estado}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Tab 4: Mis Tickets de Soporte */}
        {activeTab === 'tickets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  Mis Folios Registrados
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                  Total: {tickets.length} tickets • {ticketsAbiertosCount} activos
                </span>
              </div>
              <button
                onClick={() => setModalTicketOpen(true)}
                className="btn-primary"
                style={{ fontSize: '0.84rem', padding: '0.45rem 0.95rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
              >
                <Plus size={15} />
                <span>Crear Nuevo Ticket</span>
              </button>
            </div>

            {tickets.length === 0 ? (
              <p style={{ fontSize: '0.88rem', color: 'var(--muted-foreground)', padding: '1rem 0' }}>
                No tienes tickets registrados actualmente.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="glass-panel"
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.65rem',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'var(--muted)', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                            {ticket.folio}
                          </span>
                          <span style={{
                            fontSize: '0.72rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '10px',
                            fontWeight: 600,
                            background:
                              ticket.prioridad === 'ALTA' ? '#fee2e2' :
                              ticket.prioridad === 'MEDIA' ? '#fef3c7' : '#f1f5f9',
                            color:
                              ticket.prioridad === 'ALTA' ? '#b91c1c' :
                              ticket.prioridad === 'MEDIA' ? '#b45309' : '#475569'
                          }}>
                            {ticket.prioridad}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '0.96rem', fontWeight: 700, marginTop: '0.35rem', color: 'var(--foreground)' }}>
                          {ticket.asunto}
                        </h4>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background:
                            ticket.estado === 'RESUELTO' ? '#dcfce7' :
                            ticket.estado === 'EN_PROCESO' ? '#e0e7ff' : '#fef3c7',
                          color:
                            ticket.estado === 'RESUELTO' ? '#15803d' :
                            ticket.estado === 'EN_PROCESO' ? '#4338ca' : '#b45309'
                        }}>
                          {ticket.estado}
                        </span>
                        <button
                          onClick={() => setTicketSeleccionado(ticket)}
                          className="btn-secondary"
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                        >
                          <Eye size={13} />
                          <span>Detalle</span>
                        </button>
                      </div>
                    </div>

                    <p style={{ fontSize: '0.84rem', color: 'var(--muted-foreground)' }}>
                      {ticket.descripcion}
                    </p>

                    {/* Respuesta Resolutiva de RH destacada */}
                    {ticket.respuesta_rh && (
                      <div
                        style={{
                          background: 'var(--muted)',
                          padding: '0.65rem 0.85rem',
                          borderRadius: 'var(--radius)',
                          borderLeft: '3px solid #16a34a',
                          marginTop: '0.2rem'
                        }}
                      >
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', display: 'block', marginBottom: '0.2rem' }}>
                          Resolución oficial de Recursos Humanos:
                        </span>
                        <p style={{ fontSize: '0.82rem', color: 'var(--foreground)', margin: 0 }}>
                          {ticket.respuesta_rh}
                        </p>
                      </div>
                    )}

                    <div style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>
                      Registrado el {new Date(ticket.fecha_creacion).toLocaleDateString('es-MX')} a las {new Date(ticket.fecha_creacion).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Constancia Laboral */}
        {activeTab === 'constancia' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'var(--muted)', padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.5rem' }}>
                Configuración del Documento Membretado
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', marginBottom: '1rem' }}>
                Tu constancia incluye membrete corporativo, datos de contratación, sello institucional y firma electrónica verificable.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxWidth: '520px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: '0.3rem' }}>
                    Dirigido a:
                  </label>
                  <input
                    type="text"
                    value={dirigidoConstancia}
                    onChange={(e) => setDirigidoConstancia(e.target.value)}
                    placeholder="Ej. A quien corresponda / Institución Bancaria"
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--input)',
                      color: 'var(--foreground)',
                      fontSize: '0.86rem'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="chkSueldoColab"
                    checked={incluirSueldoConstancia}
                    onChange={(e) => setIncluirSueldoConstancia(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="chkSueldoColab" style={{ fontSize: '0.82rem', color: 'var(--foreground)', cursor: 'pointer' }}>
                    Incluir percepción salarial mensual en el texto de la constancia
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    onClick={() => setModalConstanciaOpen(true)}
                    className="btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    <Eye size={15} />
                    <span>Previsualizar en Pantalla</span>
                  </button>

                  <button
                    onClick={handleDescargarConstanciaDirecta}
                    disabled={generandoPdf}
                    className="btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                  >
                    {generandoPdf ? <RefreshCw size={15} className="spin" /> : <Download size={15} />}
                    <span>{generandoPdf ? 'Generando PDF...' : 'Descargar PDF Oficial'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Ficha explicativa */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
              <div style={{ background: 'var(--card)', padding: '0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
                  Validez Institucional
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                  Las constancias generadas cuentan con folio único de verificación y firma autorizada de la Dirección de Recursos Humanos.
                </p>
              </div>
              <div style={{ background: 'var(--card)', padding: '0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.25rem' }}>
                  Entrega Inmediata
                </h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                  Puedes descargarlo tantas veces como sea requerido sin necesidad de tiempos de espera o trámites presenciales.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
