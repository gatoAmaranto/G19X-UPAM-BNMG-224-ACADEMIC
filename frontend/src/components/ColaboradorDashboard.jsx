import React, { useState, useEffect, useRef } from 'react'
import {
  User, Calendar, Ticket, Bot, FileText, CheckCircle, Clock,
  Plus, Camera, Trash2, Mail, Briefcase, Building, Award,
  AlertCircle, RefreshCw, Eye, Download, Shield, ExternalLink, CalendarDays,
  Sun, Moon
} from 'lucide-react'
import apiClient, { resolveAvatarUrl } from '../api/apiClient.js'
import ChatWidget from './ChatWidget.jsx'
import TicketModal from './TicketModal.jsx'
import ConstanciaPreviewModal from './ConstanciaPreviewModal.jsx'
import TicketDetalleModal from './TicketDetalleModal.jsx'
import CentroTicketsColaborador from './CentroTicketsColaborador.jsx'
import CalendarioLaboral from './CalendarioLaboral.jsx'
import UserAuthHeader from './UserAuthHeader.jsx'
import { useAuth } from '../auth/AuthContext.jsx'

export default function ColaboradorDashboard({ refreshTrigger, onRefreshData, isDarkMode, toggleDarkMode }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('chat') // 'chat' | 'calendario' | 'tickets' | 'constancia' | 'perfil'
  const [perfil, setPerfil] = useState(null)
  const [vacaciones, setVacaciones] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)

  // Respaldo de perfil a partir del usuario autenticado en caso de demora o falla en la red
  const perfilEfectivo = perfil || (user ? {
    id: 1,
    user: {
      id: 1,
      first_name: user.first_name || user.name?.split(' ')[0] || 'Juan',
      last_name: user.last_name || user.name?.split(' ').slice(1).join(' ') || 'Pérez',
      email: user.email || 'juan.perez@develop.com.mx'
    },
    numero_empleado: user.numero_empleado || 'EMP-0101',
    puesto: user.puesto || 'Desarrollador Full Stack Senior',
    departamento: user.departamento || 'Tecnología de la Información',
    fecha_ingreso: user.fecha_ingreso || '2023-03-01',
    salario_mensual: user.salario_mensual || 38500,
    dias_vacaciones_totales: user.dias_vacaciones_totales || 14,
    dias_vacaciones_tomados: user.dias_vacaciones_tomados || 2,
    dias_vacaciones_retenidos: user.dias_vacaciones_retenidos || 0,
    dias_vacaciones_disponibles: user.dias_vacaciones_disponibles || 12,
    antiguedad_anios: user.antiguedad_anios || 3,
    foto_perfil_url: user.picture || null,
    horario_entrada: user.horario_entrada || '09:00',
    horario_salida: user.horario_salida || '18:00',
    dias_laborales: user.dias_laborales || 'Lunes a Viernes',
    modalidad_trabajo: user.modalidad_trabajo || 'Híbrido'
  } : null)

  // Modales operativos
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
        apiClient.get('/hr/perfil/').catch(err => {
          console.warn('Error al cargar perfil:', err)
          return null
        }),
        apiClient.get('/hr/vacaciones/').catch(err => {
          console.warn('Error al cargar vacaciones:', err)
          return null
        }),
        apiClient.get('/hr/tickets/').catch(err => {
          console.warn('Error al cargar tickets:', err)
          return null
        })
      ])
      if (resPerfil?.data) {
        setPerfil(resPerfil.data)
        window.dispatchEvent(new CustomEvent('profile-updated', { detail: resPerfil.data }))
      }
      if (resVacaciones?.data) {
        setVacaciones(resVacaciones.data)
      }
      if (resTickets?.data) {
        setTickets(resTickets.data)
      }
    } catch (err) {
      console.error('Error al cargar datos del portal de colaborador:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [refreshTrigger])

  useEffect(() => {
    if (activeTab === 'perfil' && !perfil) {
      fetchData()
    }
  }, [activeTab, perfil])

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

      const res = await apiClient.post('/hr/perfil/avatar/', formData, {
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

      const res = await apiClient.delete('/hr/perfil/avatar/')
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
      const res = await apiClient.post('/hr/constancia/?download=true', {
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

  // Previsualizar constancia PDF guardando primero los valores del formulario
  const handlePrevisualizarConstancia = async () => {
    try {
      setGenerandoPdf(true)
      await apiClient.post('/hr/constancia/', {
        dirigido_a: dirigidoConstancia,
        incluir_sueldo: incluirSueldoConstancia
      })
      setModalConstanciaOpen(true)
    } catch (err) {
      console.error('Error al guardar constancia para vista previa:', err)
      alert('Error al generar la constancia para vista previa.')
    } finally {
      setGenerandoPdf(false)
    }
  }

  const ticketsAbiertosCount = tickets.filter(t => t.estado !== 'RESUELTO').length
  const diasDisponibles = vacaciones?.saldo?.disponibles ?? perfilEfectivo?.dias_vacaciones_disponibles ?? 0

  const formattedSalary = perfilEfectivo?.salario_mensual
    ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(perfilEfectivo.salario_mensual)
    : 'Confidencial'

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Modales operativos */}
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

      {/* Sidemenu Completo Lateral del Colaborador */}
      <aside
        className="dashboard-sidebar"
        style={{
          width: '280px',
          minWidth: '280px',
          height: '100vh',
          position: 'sticky',
          top: 0,
          alignSelf: 'flex-start',
          flexShrink: 0,
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--sidebar-border)',
          boxShadow: '4px 0 20px rgba(0, 0, 0, 0.03)',
          color: 'var(--sidebar-foreground)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '1.25rem 1rem',
          zIndex: 40,
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Tarjeta de Marca y Portal */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 0.85rem',
              background: 'var(--card)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
              marginBottom: '1.25rem'
            }}
          >
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'calc(var(--radius) - 4px)',
              background: 'var(--background)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              border: '1px solid var(--border)',
              flexShrink: 0
            }}>
              <img
                src="/icon-512.png"
                alt="Logo Develop Talent & Technology"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  if (e.currentTarget.nextSibling) {
                    e.currentTarget.nextSibling.style.display = 'flex';
                  }
                }}
                style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
              />
              <div style={{ display: 'none', color: 'var(--primary)', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={20} />
              </div>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Develop Talent
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--muted-foreground)'
                }}>
                  Portal Colaborador
                </span>
              </div>
            </div>
          </div>

          {/* Sección de Menú Principal */}
          <div style={{ padding: '0 0.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted-foreground)' }}>
              Menú Principal
            </span>
            <span style={{ fontSize: '0.65rem', background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '0.08rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
              5 módulos
            </span>
          </div>

          {/* Enlaces de Navegación del Sidemenu */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {/* Opción 1: Asistente Virtual */}
            <button
              onClick={() => setActiveTab('chat')}
              className={`sidemenu-nav-item ${activeTab === 'chat' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div className="sidemenu-icon-wrapper">
                  <Bot size={17} />
                </div>
                <span>Asistente Virtual</span>
              </div>
              <span style={{
                fontSize: '0.68rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '10px',
                background: activeTab === 'chat' ? 'rgba(255, 255, 255, 0.22)' : 'var(--accent)',
                color: activeTab === 'chat' ? '#ffffff' : 'var(--accent-foreground)',
                fontWeight: 700,
                border: activeTab === 'chat' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent'
              }}>
                IA
              </span>
            </button>

            {/* Opción 2: Mi Horario & Calendario */}
            <button
              onClick={() => setActiveTab('calendario')}
              className={`sidemenu-nav-item ${activeTab === 'calendario' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div className="sidemenu-icon-wrapper">
                  <CalendarDays size={17} />
                </div>
                <span>Horario & Calendario</span>
              </div>
              <span style={{
                fontSize: '0.68rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '8px',
                background: activeTab === 'calendario' ? 'rgba(255, 255, 255, 0.22)' : '#dcfce7',
                color: activeTab === 'calendario' ? '#ffffff' : '#15803d',
                fontWeight: 700,
                border: activeTab === 'calendario' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent'
              }}>
                {diasDisponibles}d
              </span>
            </button>

            {/* Opción 3: Mis Tickets */}
            <button
              onClick={() => setActiveTab('tickets')}
              className={`sidemenu-nav-item ${activeTab === 'tickets' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div className="sidemenu-icon-wrapper">
                  <Ticket size={17} />
                </div>
                <span>Mis Tickets</span>
              </div>
              {ticketsAbiertosCount > 0 ? (
                <span style={{
                  fontSize: '0.68rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                  background: activeTab === 'tickets' ? 'rgba(255, 255, 255, 0.22)' : '#dbeafe',
                  color: activeTab === 'tickets' ? '#ffffff' : '#1d4ed8',
                  fontWeight: 700,
                  border: activeTab === 'tickets' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent'
                }}>
                  {ticketsAbiertosCount}
                </span>
              ) : (
                <span style={{
                  fontSize: '0.68rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '8px',
                  background: activeTab === 'tickets' ? 'rgba(255, 255, 255, 0.22)' : 'var(--muted)',
                  color: activeTab === 'tickets' ? '#ffffff' : 'var(--muted-foreground)',
                  fontWeight: 600
                }}>
                  0
                </span>
              )}
            </button>

            {/* Opción 4: Constancia PDF */}
            <button
              onClick={() => setActiveTab('constancia')}
              className={`sidemenu-nav-item ${activeTab === 'constancia' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div className="sidemenu-icon-wrapper">
                  <FileText size={17} />
                </div>
                <span>Constancia PDF</span>
              </div>
              <span style={{
                fontSize: '0.68rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '8px',
                background: activeTab === 'constancia' ? 'rgba(255, 255, 255, 0.22)' : 'var(--muted)',
                color: activeTab === 'constancia' ? '#ffffff' : 'var(--muted-foreground)',
                fontWeight: 600,
                border: activeTab === 'constancia' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent'
              }}>
                PDF
              </span>
            </button>

            {/* Opción 5: Mi Perfil Laboral */}
            <button
              onClick={() => setActiveTab('perfil')}
              className={`sidemenu-nav-item ${activeTab === 'perfil' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div className="sidemenu-icon-wrapper">
                  <User size={17} />
                </div>
                <span>Mi Perfil Laboral</span>
              </div>
              {perfilEfectivo?.foto_perfil_url ? (
                <img
                  src={resolveAvatarUrl(perfilEfectivo.foto_perfil_url)}
                  alt="Avatar"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: activeTab === 'perfil' ? '2px solid rgba(255, 255, 255, 0.8)' : '1px solid var(--border)'
                  }}
                />
              ) : (
                <span style={{
                  fontSize: '0.68rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '8px',
                  background: activeTab === 'perfil' ? 'rgba(255, 255, 255, 0.22)' : 'var(--muted)',
                  color: activeTab === 'perfil' ? '#ffffff' : 'var(--muted-foreground)',
                  fontWeight: 600,
                  border: activeTab === 'perfil' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent'
                }}>
                  Foto
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Resumen de Métricas / Estado al fondo del Sidemenu */}
        <div style={{ borderTop: '1px solid var(--sidebar-border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto' }}>
          <div style={{
            background: 'var(--card)',
            padding: '0.85rem',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.55rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--muted-foreground)' }}>
                Mi Estado
              </span>
              <span style={{ fontSize: '0.68rem', color: '#15803d', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}></span>
                Activo
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ background: 'var(--background)', padding: '0.5rem 0.4rem', borderRadius: 'calc(var(--radius) - 4px)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.15rem' }}>Vacaciones</span>
                <strong style={{ fontSize: '0.92rem', color: diasDisponibles > 0 ? '#15803d' : 'var(--foreground)' }}>
                  {diasDisponibles}d
                </strong>
              </div>
              <div style={{ background: 'var(--background)', padding: '0.5rem 0.4rem', borderRadius: 'calc(var(--radius) - 4px)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.15rem' }}>Tickets</span>
                <strong style={{ fontSize: '0.92rem', color: ticketsAbiertosCount > 0 ? '#1d4ed8' : 'var(--foreground)' }}>
                  {ticketsAbiertosCount}
                </strong>
              </div>
            </div>
          </div>

          <button
            onClick={fetchData}
            className="btn-secondary"
            style={{ width: '100%', padding: '0.55rem', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Sincronizar datos</span>
          </button>
        </div>
      </aside>

      {/* Contenedor Principal a la derecha con Sticky Topbar */}
      <div
        className={`dashboard-main-wrapper ${activeTab === 'chat' ? 'chat-mode' : ''}`}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          background: 'var(--background)'
        }}
      >
        <header
          className="dashboard-header"
          style={{
            height: '68px',
            position: 'sticky',
            top: 0,
            zIndex: 30,
            background: 'var(--card)',
            borderBottom: '1px solid var(--border)',
            padding: '0 2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div className="header-breadcrumbs" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                <span>Portal Colaborador</span>
                <span>/</span>
                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                  {activeTab === 'chat' && 'Asistente Virtual'}
                  {activeTab === 'calendario' && 'Horario & Calendario'}
                  {activeTab === 'tickets' && 'Mis Tickets'}
                  {activeTab === 'constancia' && 'Constancia Laboral'}
                  {activeTab === 'perfil' && 'Mi Perfil Laboral'}
                </span>
              </div>
              <h1 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span className="desktop-only">
                  {activeTab === 'chat' && 'Asistente Conversacional & Autoservicio con IA'}
                  {activeTab === 'perfil' && 'Mi Expediente Laboral & Fotografía de Perfil'}
                  {activeTab === 'calendario' && 'Horario Oficial de Trabajo y Calendario de Actividades'}
                  {activeTab === 'tickets' && 'Centro Individual de Gestión y Seguimiento de Tickets'}
                  {activeTab === 'constancia' && 'Emisión de Constancia Laboral Membretada'}
                </span>
                <span className="mobile-only">
                  {activeTab === 'chat' && 'Asistente Virtual'}
                  {activeTab === 'perfil' && 'Mi Perfil'}
                  {activeTab === 'calendario' && 'Horario y Calendario'}
                  {activeTab === 'tickets' && 'Mis Tickets'}
                  {activeTab === 'constancia' && 'Constancia'}
                </span>
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
            <UserAuthHeader />
            {toggleDarkMode && (
              <button
                className="btn-secondary"
                onClick={toggleDarkMode}
                title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}
              >
                {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
                <span className="desktop-only">{isDarkMode ? 'Claro' : 'Oscuro'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Área Principal de Contenido del Colaborador */}
        <main
          className={`dashboard-main-area ${activeTab === 'chat' ? 'chat-mode' : ''}`}
          style={{
            flex: 1,
            padding: activeTab === 'chat' ? '1rem 2rem 1.25rem' : '1.5rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: activeTab === 'chat' ? '0.75rem' : '1rem',
            maxWidth: '1600px',
            width: '100%',
            margin: '0 auto',
            ...(activeTab === 'chat' ? {
              minHeight: 0,
              overflow: 'hidden'
            } : {
              overflow: 'visible'
            })
          }}
        >
          {/* Subtítulo contextual de la pestaña (oculto en chat para dar espacio completo) */}
          {activeTab !== 'chat' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', flexShrink: 0 }}>
              <p style={{ fontSize: '0.86rem', color: 'var(--muted-foreground)', margin: 0 }}>
                {activeTab === 'perfil' && 'Consulta tu información oficial, antigüedad calculada y administra tu fotografía institucional.'}
                {activeTab === 'calendario' && 'Visualiza tu jornada laboral registrada, revisa tus días de descanso o vacaciones y administra tus tareas y notas personales.'}
                {activeTab === 'tickets' && 'Consulta el expediente individual de cada folio, monitorea el avance de atención y revisa las resoluciones oficiales emitidas por Recursos Humanos.'}
                {activeTab === 'constancia' && 'Genera y descarga en tiempo real tu constancia laboral en formato PDF oficial.'}
              </p>
            </div>
          )}

        {/* Tab 1: Asistente Virtual Conversacional */}
        <div style={{
          flex: 1,
          display: activeTab === 'chat' ? 'flex' : 'none',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden'
        }}>
          <ChatWidget onRefreshData={fetchData} perfil={perfilEfectivo} />
        </div>

        {/* Tab 2: Mi Perfil Laboral (PANTALLA DEDICADA SIN MODAL) */}
        {activeTab === 'perfil' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {!perfilEfectivo ? (
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
                    border: '1px solid var(--border)',
                    flexWrap: 'wrap',
                    minWidth: 0
                  }}
                >
                  {/* Avatar con botón de cámara */}
                  <div style={{ position: 'relative', width: '96px', height: '96px', flexShrink: 0 }}>
                    {previewFoto || perfilEfectivo.foto_perfil_url ? (
                      <img
                        src={previewFoto || resolveAvatarUrl(perfilEfectivo.foto_perfil_url)}
                        alt={`${perfilEfectivo.user.first_name} ${perfilEfectivo.user.last_name}`}
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
                        {perfilEfectivo.user.first_name?.[0] || 'C'}
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
                  <div style={{ flex: 1, minWidth: 0, wordBreak: 'break-word' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)' }}>
                        {perfilEfectivo.user.first_name} {perfilEfectivo.user.last_name}
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
                      {perfilEfectivo.puesto} — {perfilEfectivo.departamento}
                    </p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                      No. Empleado: <strong>{perfilEfectivo.numero_empleado}</strong> • <span style={{ wordBreak: 'break-all' }}>{perfilEfectivo.user.email}</span>
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
                    {!archivoFoto && perfilEfectivo.foto_perfil_url && (
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Número de Empleado</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                        {perfilEfectivo.numero_empleado}
                      </strong>
                    </div>

                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Correo Corporativo</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)', wordBreak: 'break-all' }}>
                        {perfilEfectivo.user.email}
                      </strong>
                    </div>

                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Puesto Actual</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                        {perfilEfectivo.puesto}
                      </strong>
                    </div>

                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Departamento</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                        {perfilEfectivo.departamento}
                      </strong>
                    </div>

                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Fecha de Contratación</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                        {perfilEfectivo.fecha_ingreso || 'No registrada'}
                      </strong>
                    </div>

                    <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Antigüedad Calculada</span>
                      <strong style={{ fontSize: '0.88rem', color: 'var(--primary)' }}>
                        {perfilEfectivo.antiguedad_anios ?? 1} {Number(perfilEfectivo.antiguedad_anios) === 1 ? 'año' : 'años'}
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
                        {perfilEfectivo.dias_vacaciones_disponibles} días de descanso
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>
                      Resumen de Días de Vacaciones Anuales
                    </span>
                    <button
                      onClick={() => setActiveTab('calendario')}
                      className="btn-primary"
                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      <Plus size={13} />
                      <span>Solicitar Vacaciones</span>
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem', textAlign: 'center' }}>
                    <div style={{ background: 'var(--card)', padding: '0.55rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block' }}>Asignados</span>
                      <strong style={{ fontSize: '0.95rem' }}>{perfilEfectivo.dias_vacaciones_totales}</strong>
                    </div>
                    <div style={{ background: 'var(--card)', padding: '0.55rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block' }}>Tomados</span>
                      <strong style={{ fontSize: '0.95rem' }}>{perfilEfectivo.dias_vacaciones_tomados}</strong>
                    </div>
                    <div style={{ background: 'var(--card)', padding: '0.55rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block' }}>Retenidos</span>
                      <strong style={{ fontSize: '0.95rem', color: '#b45309' }}>{vacaciones?.saldo?.retenidos ?? perfilEfectivo?.dias_vacaciones_retenidos ?? 0}</strong>
                    </div>
                    <div style={{ background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '0.55rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
                      <span style={{ fontSize: '0.7rem', display: 'block' }}>Disponibles</span>
                      <strong style={{ fontSize: '0.95rem' }}>{perfilEfectivo.dias_vacaciones_disponibles}</strong>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab: Mi Horario y Calendario Laboral */}
        {activeTab === 'calendario' && (
          <CalendarioLaboral
            perfil={perfilEfectivo}
            vacaciones={vacaciones}
            onRefreshData={fetchData}
            esAdminRH={false}
          />
        )}

        {/* Tab 3: Mis Tickets de Soporte (Centro Individual de Gestión) */}
        {activeTab === 'tickets' && (
          <CentroTicketsColaborador
            tickets={tickets}
            onCrearTicket={() => setModalTicketOpen(true)}
            onRefresh={fetchData}
            onConsultarChat={(ticket) => {
              setActiveTab('chat')
            }}
          />
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
                    onClick={handlePrevisualizarConstancia}
                    disabled={generandoPdf}
                    className="btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}
                  >
                    {generandoPdf ? <RefreshCw size={15} className="spin" /> : <Eye size={15} />}
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.85rem' }}>
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

        {/* Footer (solo visible en pestañas con navegación regular, no en la vista de chat de altura completa) */}
        {activeTab !== 'chat' && (
          <footer style={{
            borderTop: '1px solid var(--border)',
            padding: '0.9rem 2rem',
            textAlign: 'center',
            fontSize: '0.8rem',
            color: 'var(--muted-foreground)',
            background: 'var(--card)',
            flexShrink: 0
          }}>
            © 2026 PluriOne S.A. de C.V. (Develop Talent & Technology) — Autenticación Segura con Auth0 SSO & RBAC.
          </footer>
        )}

        {/* Barra de Navegación Inferior Móvil (Mobile Bottom Navigation Bar) */}
        <nav className="mobile-bottom-nav" aria-label="Navegación móvil inferior">
          <button
            onClick={() => setActiveTab('chat')}
            className={`mobile-nav-btn ${activeTab === 'chat' ? 'active' : ''}`}
            title="Asistente Virtual"
            aria-label="Asistente Virtual"
          >
            <div className="mobile-nav-icon-wrap">
              <Bot size={20} />
            </div>
          </button>

          <button
            onClick={() => setActiveTab('calendario')}
            className={`mobile-nav-btn ${activeTab === 'calendario' ? 'active' : ''}`}
            title="Horario & Calendario"
            aria-label="Horario & Calendario"
          >
            <div className="mobile-nav-icon-wrap">
              <CalendarDays size={20} />
              {diasDisponibles > 0 && (
                <span className="mobile-nav-badge" style={{ background: '#16a34a' }}>
                  {diasDisponibles}
                </span>
              )}
            </div>
          </button>

          <button
            onClick={() => setActiveTab('tickets')}
            className={`mobile-nav-btn ${activeTab === 'tickets' ? 'active' : ''}`}
            title="Mis Tickets"
            aria-label="Mis Tickets"
          >
            <div className="mobile-nav-icon-wrap">
              <Ticket size={20} />
              {ticketsAbiertosCount > 0 && (
                <span className="mobile-nav-badge">
                  {ticketsAbiertosCount}
                </span>
              )}
            </div>
          </button>

          <button
            onClick={() => setActiveTab('constancia')}
            className={`mobile-nav-btn ${activeTab === 'constancia' ? 'active' : ''}`}
            title="Constancia Laboral"
            aria-label="Constancia Laboral"
          >
            <div className="mobile-nav-icon-wrap">
              <FileText size={20} />
            </div>
          </button>

          <button
            onClick={() => setActiveTab('perfil')}
            className={`mobile-nav-btn ${activeTab === 'perfil' ? 'active' : ''}`}
            title="Mi Perfil"
            aria-label="Mi Perfil"
          >
            <div className="mobile-nav-icon-wrap">
              {perfilEfectivo?.foto_perfil_url ? (
                <img
                  src={resolveAvatarUrl(perfilEfectivo.foto_perfil_url)}
                  alt="Avatar"
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <User size={20} />
              )}
            </div>
          </button>
        </nav>
      </div>
    </div>
  )
}
