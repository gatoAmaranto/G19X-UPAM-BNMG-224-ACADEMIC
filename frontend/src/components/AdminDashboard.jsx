import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  CheckCircle, XCircle, MessageSquare, Plus, BookOpen, Calendar,
  Ticket, AlertCircle, RefreshCw, Upload, FileText, Briefcase,
  User, Camera, Trash2, Shield, Mail, Award, Check,
  ChevronDown, ChevronUp, Search, Filter, Users, CalendarDays,
  Sun, Moon, Bot
} from 'lucide-react'
import apiClient from '../api/apiClient.js'
import CalendarioLaboral from './CalendarioLaboral.jsx'
import UserAuthHeader from './UserAuthHeader.jsx'

const API_BASE = '/hr/admin'

const resolveAvatarUrl = (url) => {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  return `${url.startsWith('/') ? '' : '/'}${url}`
}

export default function AdminDashboard({ isDarkMode, toggleDarkMode }) {
  const [activeTab, setActiveTab] = useState('vacaciones')
  const [vacaciones, setVacaciones] = useState([])
  const [tickets, setTickets] = useState([])
  const [faqs, setFaqs] = useState([])
  const [perfilRH, setPerfilRH] = useState(null)
  const [loading, setLoading] = useState(true)

  const vacacionesPendientes = vacaciones.filter(v => v.estado === 'PENDIENTE')
  const ticketsAbiertos = tickets.filter(t => t.estado !== 'RESUELTO')

  // Estados de Agrupación, Búsqueda y Filtros de Vacaciones por Colaborador
  const [filtroVacaciones, setFiltroVacaciones] = useState('todos') // 'todos' | 'pendientes'
  const [busquedaVacaciones, setBusquedaVacaciones] = useState('')
  const [expandidosVacaciones, setExpandidosVacaciones] = useState({})

  // Estados de Agrupación, Búsqueda y Filtros de Tickets por Colaborador
  const [filtroTickets, setFiltroTickets] = useState('todos') // 'todos' | 'pendientes'
  const [busquedaTickets, setBusquedaTickets] = useState('')
  const [expandidosTickets, setExpandidosTickets] = useState({})

  // Form para nueva FAQ
  const [nuevaFaq, setNuevaFaq] = useState({ categoria: 'Políticas Generales', pregunta: '', respuesta: '' })
  // Estado de respuesta de ticket
  const [ticketRespuesta, setTicketRespuesta] = useState({ id: null, respuesta_rh: '' })
  // Estado de carga de documento PDF/TXT
  const [subiendoDoc, setSubiendoDoc] = useState(false)
  const [msgUpload, setMsgUpload] = useState('')

  // Estado para gestión de foto de perfil RH
  const [subiendoFotoRH, setSubiendoFotoRH] = useState(false)
  const [msgFotoRH, setMsgFotoRH] = useState(null)
  const [previewFotoRH, setPreviewFotoRH] = useState(null)
  const [archivoFotoRH, setArchivoFotoRH] = useState(null)
  const fileInputRefRH = useRef(null)

  const fetchAdminData = async () => {
    try {
      setLoading(true)
      const [resVac, resTick, resFaq, resPerfil] = await Promise.all([
        apiClient.get(`${API_BASE}/vacaciones/`),
        apiClient.get(`${API_BASE}/tickets/`),
        apiClient.get(`${API_BASE}/faq/`),
        apiClient.get(`${API_BASE}/perfil/`).catch(() => null)
      ])
      setVacaciones(resVac.data)
      setTickets(resTick.data)
      setFaqs(resFaq.data)
      if (resPerfil?.data) {
        setPerfilRH(resPerfil.data)
        window.dispatchEvent(new CustomEvent('profile-updated', { detail: resPerfil.data }))
      }
    } catch (err) {
      console.error('Error al cargar datos administrativos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdminData()
  }, [])

  // Agrupación de Vacaciones por Colaborador
  const colaboradoresVacaciones = useMemo(() => {
    const map = new Map()
    vacaciones.forEach((vac) => {
      const empKey = vac.empleado || vac.empleado_numero || `emp-${vac.id}`
      if (!map.has(empKey)) {
        map.set(empKey, {
          key: String(empKey),
          id: vac.empleado,
          nombre: vac.empleado_nombre || 'Colaborador',
          numero: vac.empleado_numero || 'S/N',
          puesto: vac.empleado_puesto || 'Puesto no asignado',
          departamento: vac.empleado_departamento || 'General',
          avatar: resolveAvatarUrl(vac.empleado_avatar),
          dias_disponibles: vac.empleado_dias_disponibles,
          solicitudes: []
        })
      }
      map.get(empKey).solicitudes.push(vac)
    })

    return Array.from(map.values()).map((colab) => {
      const pendientes = colab.solicitudes.filter(s => s.estado === 'PENDIENTE').length
      const totalDias = colab.solicitudes.reduce((acc, s) => acc + (Number(s.dias_solicitados) || 0), 0)
      return {
        ...colab,
        pendientes_count: pendientes,
        total_dias: totalDias
      }
    }).sort((a, b) => b.pendientes_count - a.pendientes_count || a.nombre.localeCompare(b.nombre))
  }, [vacaciones])

  // Filtrado de Colaboradores en Vacaciones
  const colaboradoresVacacionesFiltrados = useMemo(() => {
    return colaboradoresVacaciones.filter((c) => {
      const cumpleFiltro = filtroVacaciones === 'todos' || c.pendientes_count > 0
      const query = busquedaVacaciones.toLowerCase().trim()
      const cumpleBusqueda = !query ||
        c.nombre.toLowerCase().includes(query) ||
        c.numero.toLowerCase().includes(query) ||
        c.puesto.toLowerCase().includes(query) ||
        c.departamento.toLowerCase().includes(query)
      return cumpleFiltro && cumpleBusqueda
    })
  }, [colaboradoresVacaciones, filtroVacaciones, busquedaVacaciones])

  const isVacacionExpandido = (key, pendientesCount) => {
    if (expandidosVacaciones[key] !== undefined) return expandidosVacaciones[key]
    return pendientesCount > 0
  }

  const toggleExpandirVacaciones = (key, pendientesCount) => {
    const actual = isVacacionExpandido(key, pendientesCount)
    setExpandidosVacaciones(prev => ({ ...prev, [key]: !actual }))
  }

  const toggleExpandirTodosVacaciones = (expandir) => {
    const nuevo = {}
    colaboradoresVacacionesFiltrados.forEach(c => {
      nuevo[c.key] = expandir
    })
    setExpandidosVacaciones(nuevo)
  }

  // Agrupación de Tickets por Colaborador
  const colaboradoresTickets = useMemo(() => {
    const map = new Map()
    tickets.forEach((t) => {
      const empKey = t.empleado || t.empleado_numero || `emp-${t.id}`
      if (!map.has(empKey)) {
        map.set(empKey, {
          key: String(empKey),
          id: t.empleado,
          nombre: t.empleado_nombre || 'Colaborador',
          numero: t.empleado_numero || 'S/N',
          puesto: t.empleado_puesto || 'Puesto no asignado',
          departamento: t.empleado_departamento || 'General',
          avatar: resolveAvatarUrl(t.empleado_avatar),
          tickets: []
        })
      }
      map.get(empKey).tickets.push(t)
    })

    return Array.from(map.values()).map((colab) => {
      const abiertos = colab.tickets.filter(t => t.estado !== 'RESUELTO').length
      return {
        ...colab,
        abiertos_count: abiertos,
        total_tickets: colab.tickets.length
      }
    }).sort((a, b) => b.abiertos_count - a.abiertos_count || a.nombre.localeCompare(b.nombre))
  }, [tickets])

  // Filtrado de Colaboradores en Tickets
  const colaboradoresTicketsFiltrados = useMemo(() => {
    return colaboradoresTickets.filter((c) => {
      const cumpleFiltro = filtroTickets === 'todos' || c.abiertos_count > 0
      const query = busquedaTickets.toLowerCase().trim()
      const cumpleBusqueda = !query ||
        c.nombre.toLowerCase().includes(query) ||
        c.numero.toLowerCase().includes(query) ||
        c.puesto.toLowerCase().includes(query) ||
        c.tickets.some(t => t.folio.toLowerCase().includes(query) || t.asunto.toLowerCase().includes(query))
      return cumpleFiltro && cumpleBusqueda
    })
  }, [colaboradoresTickets, filtroTickets, busquedaTickets])

  const isTicketExpandido = (key, abiertosCount) => {
    if (expandidosTickets[key] !== undefined) return expandidosTickets[key]
    return abiertosCount > 0
  }

  const toggleExpandirTickets = (key, abiertosCount) => {
    const actual = isTicketExpandido(key, abiertosCount)
    setExpandidosTickets(prev => ({ ...prev, [key]: !actual }))
  }

  const toggleExpandirTodosTickets = (expandir) => {
    const nuevo = {}
    colaboradoresTicketsFiltrados.forEach(c => {
      nuevo[c.key] = expandir
    })
    setExpandidosTickets(nuevo)
  }

  // Carga de Documentos PDF/TXT
  const handleSubirDocumento = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('archivo', file)

    try {
      setSubiendoDoc(true)
      setMsgUpload('Procesando e ingiriendo documento...')
      const res = await apiClient.post(`${API_BASE}/faq/upload/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setMsgUpload(`${res.data.mensaje} (${res.data.registros_creados} secciones creadas)`)
      fetchAdminData()
    } catch (err) {
      console.error('Error al subir documento:', err)
      setMsgUpload(`${err.response?.data?.error || 'Error al subir el documento.'}`)
    } finally {
      setSubiendoDoc(false)
    }
  }

  // Manejadores de Fotografía Institucional RH
  const handleSelectFotoRH = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setMsgFotoRH({ type: 'error', text: 'Por favor selecciona un archivo de imagen válido (PNG, JPG o WebP).' })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setMsgFotoRH({ type: 'error', text: 'La imagen excede el límite máximo de 5 MB.' })
      return
    }

    setArchivoFotoRH(file)
    setPreviewFotoRH(URL.createObjectURL(file))
    setMsgFotoRH(null)
  }

  const handleUploadFotoRH = async () => {
    if (!archivoFotoRH) return

    const formData = new FormData()
    formData.append('foto_perfil', archivoFotoRH)

    try {
      setSubiendoFotoRH(true)
      setMsgFotoRH(null)

      const res = await apiClient.post(`${API_BASE}/perfil/avatar/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setPerfilRH(res.data)
      setArchivoFotoRH(null)
      setPreviewFotoRH(null)
      setMsgFotoRH({ type: 'success', text: 'Fotografía de perfil RH actualizada exitosamente.' })
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: res.data }))
    } catch (err) {
      console.error('Error al subir foto RH:', err)
      setMsgFotoRH({
        type: 'error',
        text: err.response?.data?.error || 'Error al guardar la fotografía institucional.'
      })
    } finally {
      setSubiendoFotoRH(false)
    }
  }

  const handleCancelFotoRH = () => {
    setArchivoFotoRH(null)
    if (previewFotoRH) {
      URL.revokeObjectURL(previewFotoRH)
      setPreviewFotoRH(null)
    }
    if (fileInputRefRH.current) {
      fileInputRefRH.current.value = ''
    }
  }

  const handleDeleteFotoRH = async () => {
    if (!window.confirm('¿Deseas remover tu fotografía institucional de perfil?')) return

    try {
      setSubiendoFotoRH(true)
      setMsgFotoRH(null)

      const res = await apiClient.delete(`${API_BASE}/perfil/avatar/`)
      setPerfilRH(res.data)
      setArchivoFotoRH(null)
      setPreviewFotoRH(null)
      setMsgFotoRH({ type: 'success', text: 'Fotografía institucional removida.' })
      window.dispatchEvent(new CustomEvent('profile-updated', { detail: res.data }))
    } catch (err) {
      console.error('Error al remover foto RH:', err)
      setMsgFotoRH({ type: 'error', text: 'No se pudo remover la fotografía de perfil.' })
    } finally {
      setSubiendoFotoRH(false)
    }
  }

  // Aprobar / Rechazar Vacaciones
  const handleAprobarRechazarVacaciones = async (id, nuevoEstado) => {
    try {
      await apiClient.patch(`${API_BASE}/vacaciones/${id}/`, { estado: nuevoEstado })
      fetchAdminData()
    } catch (err) {
      alert('Error al actualizar el estado de las vacaciones.')
    }
  }

  // Responder Ticket
  const handleEnviarRespuestaTicket = async (id) => {
    if (!ticketRespuesta.respuesta_rh.trim()) return
    try {
      await apiClient.patch(`${API_BASE}/tickets/${id}/`, {
        respuesta_rh: ticketRespuesta.respuesta_rh,
        estado: 'RESUELTO'
      })
      setTicketRespuesta({ id: null, respuesta_rh: '' })
      fetchAdminData()
    } catch (err) {
      alert('Error al responder el ticket.')
    }
  }

  // Crear FAQ RAG
  const handleCrearFaq = async (e) => {
    e.preventDefault()
    if (!nuevaFaq.pregunta.trim() || !nuevaFaq.respuesta.trim()) return
    try {
      await apiClient.post(`${API_BASE}/faq/`, nuevaFaq)
      setNuevaFaq({ categoria: 'Políticas Generales', pregunta: '', respuesta: '' })
      fetchAdminData()
    } catch (err) {
      alert('Error al guardar la nueva pregunta en la base de conocimientos.')
    }
  }

  // Activar / Desactivar FAQ (manteniendo estrictamente la posición en la lista)
  const handleToggleFaq = async (id, estadoActual) => {
    try {
      const res = await apiClient.patch(`${API_BASE}/faq/${id}/`, { activa: !estadoActual })
      setFaqs(prev => prev.map(f => f.id === id ? { ...f, activa: res.data.activa } : f))
    } catch (err) {
      alert('Error al modificar el estado de la regla en la base de conocimientos.')
    }
  }

  // Eliminar permanentemente una regla de la base de conocimientos RAG con confirmación
  const handleDeleteFaq = async (id, pregunta) => {
    const confirmar = window.confirm(
      `¿Estás seguro de que deseas eliminar permanentemente esta regla de la base de conocimientos?\n\n"${pregunta}"\n\nEsta acción no se puede deshacer y el asistente virtual ya no podrá consultarla.`
    )
    if (!confirmar) return

    try {
      await apiClient.delete(`${API_BASE}/faq/${id}/`)
      setFaqs(prev => prev.filter(f => f.id !== id))
    } catch (err) {
      alert('Error al eliminar la regla de la base de conocimientos.')
    }
  }

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Sidemenu Completo Lateral de Recursos Humanos */}
      <aside
        style={{
          width: '280px',
          minWidth: '280px',
          height: '100vh',
          position: 'sticky',
          top: 0,
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
          {/* Tarjeta de Marca y Portal RH */}
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
                <Briefcase size={20} />
              </div>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h2 style={{ fontSize: '0.94rem', fontWeight: 800, color: 'var(--foreground)', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Develop Talent
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--muted-foreground)'
                }}>
                  Backoffice RH
                </span>
              </div>
            </div>
          </div>

          {/* Sección de Menú Institucional */}
          <div style={{ padding: '0 0.5rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted-foreground)' }}>
              Gestión RH
            </span>
            <span style={{ fontSize: '0.65rem', background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '0.08rem 0.35rem', borderRadius: '4px', fontWeight: 700 }}>
              5 módulos
            </span>
          </div>

          {/* Enlaces de Navegación del Sidemenu */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {/* Opción 1: Vacaciones */}
            <button
              onClick={() => setActiveTab('vacaciones')}
              className={`sidemenu-nav-item ${activeTab === 'vacaciones' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div className="sidemenu-icon-wrapper">
                  <Calendar size={17} />
                </div>
                <span>Vacaciones</span>
              </div>
              {vacacionesPendientes.length > 0 ? (
                <span style={{
                  fontSize: '0.68rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                  background: activeTab === 'vacaciones' ? 'rgba(255, 255, 255, 0.22)' : '#fef3c7',
                  color: activeTab === 'vacaciones' ? '#ffffff' : '#b45309',
                  fontWeight: 700,
                  border: activeTab === 'vacaciones' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent'
                }}>
                  {vacacionesPendientes.length}
                </span>
              ) : (
                <span style={{
                  fontSize: '0.68rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '8px',
                  background: activeTab === 'vacaciones' ? 'rgba(255, 255, 255, 0.22)' : 'var(--muted)',
                  color: activeTab === 'vacaciones' ? '#ffffff' : 'var(--muted-foreground)',
                  fontWeight: 600
                }}>
                  0
                </span>
              )}
            </button>

            {/* Opción 2: Mesa de Tickets */}
            <button
              onClick={() => setActiveTab('tickets')}
              className={`sidemenu-nav-item ${activeTab === 'tickets' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div className="sidemenu-icon-wrapper">
                  <Ticket size={17} />
                </div>
                <span>Mesa de Tickets</span>
              </div>
              {ticketsAbiertos.length > 0 ? (
                <span style={{
                  fontSize: '0.68rem',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '10px',
                  background: activeTab === 'tickets' ? 'rgba(255, 255, 255, 0.22)' : '#dbeafe',
                  color: activeTab === 'tickets' ? '#ffffff' : '#1d4ed8',
                  fontWeight: 700,
                  border: activeTab === 'tickets' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent'
                }}>
                  {ticketsAbiertos.length}
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

            {/* Opción 3: Base de Conocimiento RAG */}
            <button
              onClick={() => setActiveTab('faq')}
              className={`sidemenu-nav-item ${activeTab === 'faq' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div className="sidemenu-icon-wrapper">
                  <BookOpen size={17} />
                </div>
                <span>Base RAG & FAQs</span>
              </div>
              <span style={{
                fontSize: '0.68rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '10px',
                background: activeTab === 'faq' ? 'rgba(255, 255, 255, 0.22)' : 'var(--accent)',
                color: activeTab === 'faq' ? '#ffffff' : 'var(--accent-foreground)',
                fontWeight: 700,
                border: activeTab === 'faq' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent'
              }}>
                {faqs.length}
              </span>
            </button>

            {/* Opción 4: Horario & Calendario RH */}
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
                padding: '0.15rem 0.45rem',
                borderRadius: '8px',
                background: activeTab === 'calendario' ? 'rgba(255, 255, 255, 0.22)' : 'var(--muted)',
                color: activeTab === 'calendario' ? '#ffffff' : 'var(--muted-foreground)',
                fontWeight: 600,
                border: activeTab === 'calendario' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent'
              }}>
                {perfilRH?.horario_entrada || '09:00'}
              </span>
            </button>

            {/* Opción 5: Mi Perfil RH */}
            <button
              onClick={() => setActiveTab('perfil')}
              className={`sidemenu-nav-item ${activeTab === 'perfil' ? 'active' : ''}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                <div className="sidemenu-icon-wrapper">
                  <User size={17} />
                </div>
                <span>Mi Perfil RH</span>
              </div>
              {perfilRH?.foto_perfil_url ? (
                <img
                  src={perfilRH.foto_perfil_url}
                  alt="Avatar RH"
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
                  padding: '0.15rem 0.4rem',
                  borderRadius: '8px',
                  background: activeTab === 'perfil' ? 'rgba(255, 255, 255, 0.22)' : 'var(--muted)',
                  color: activeTab === 'perfil' ? '#ffffff' : 'var(--muted-foreground)',
                  fontWeight: 600,
                  border: activeTab === 'perfil' ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid transparent'
                }}>
                  RH
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
                Operación RH
              </span>
              <span style={{ fontSize: '0.68rem', color: '#b45309', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }}></span>
                En línea
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div style={{ background: 'var(--background)', padding: '0.5rem 0.4rem', borderRadius: 'calc(var(--radius) - 4px)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.15rem' }}>Pendientes</span>
                <strong style={{ fontSize: '0.92rem', color: (vacacionesPendientes.length + ticketsAbiertos.length) > 0 ? '#b45309' : 'var(--foreground)' }}>
                  {vacacionesPendientes.length + ticketsAbiertos.length}
                </strong>
              </div>
              <div style={{ background: 'var(--background)', padding: '0.5rem 0.4rem', borderRadius: 'calc(var(--radius) - 4px)', border: '1px solid var(--border)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.67rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.15rem' }}>FAQs RAG</span>
                <strong style={{ fontSize: '0.92rem', color: 'var(--foreground)' }}>
                  {faqs.filter(f => f.activa).length}
                </strong>
              </div>
            </div>
          </div>

          <button
            onClick={fetchAdminData}
            className="btn-secondary"
            style={{ width: '100%', padding: '0.55rem', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Sincronizar datos</span>
          </button>
        </div>
      </aside>

      {/* Contenedor Principal a la derecha con Sticky Topbar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: '100vh', background: 'var(--background)' }}>
        <header
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
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
              <span>Backoffice RH</span>
              <span>/</span>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                {activeTab === 'vacaciones' && 'Vacaciones'}
                {activeTab === 'tickets' && 'Mesa de Tickets'}
                {activeTab === 'faq' && 'Base RAG & FAQs'}
                {activeTab === 'calendario' && 'Horario & Calendario'}
                {activeTab === 'perfil' && 'Mi Perfil RH'}
              </span>
            </div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0, lineHeight: 1.2 }}>
              {activeTab === 'vacaciones' && 'Aprobación y Gestión de Vacaciones'}
              {activeTab === 'tickets' && 'Mesa de Ayuda y Atención de Tickets'}
              {activeTab === 'faq' && 'Entrenamiento de Base de Conocimiento RAG'}
              {activeTab === 'calendario' && 'Horario Institucional y Calendario de Recursos Humanos'}
              {activeTab === 'perfil' && 'Perfil Institucional y Credenciales de Recursos Humanos'}
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <UserAuthHeader />
            {toggleDarkMode && (
              <button
                className="btn-secondary"
                onClick={toggleDarkMode}
                title={isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              >
                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                <span>{isDarkMode ? 'Claro' : 'Oscuro'}</span>
              </button>
            )}
          </div>
        </header>

        {/* Área Principal de Contenido a la derecha */}
        <main style={{ flex: 1, padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '1600px', width: '100%', margin: '0 auto' }}>
          {/* Subtítulo contextual de la pestaña */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.65rem' }}>
            <p style={{ fontSize: '0.86rem', color: 'var(--muted-foreground)', margin: 0 }}>
              {activeTab === 'vacaciones' && 'Revisa y dictamina las solicitudes de descanso vacacional enviadas por los colaboradores.'}
              {activeTab === 'tickets' && 'Resuelve consultas y solicitudes especiales canalizadas por el agente conversacional.'}
              {activeTab === 'faq' && 'Carga reglamentos y actualiza preguntas frecuentes para alimentar el modelo de IA.'}
              {activeTab === 'calendario' && 'Supervisa los descansos vacacionales de la organización y administra tus notas y tareas de Recursos Humanos.'}
              {activeTab === 'perfil' && 'Expediente del funcionario de RH, fotografía institucional y auditoría de permisos asignados.'}
            </p>
          </div>
      {/* Tab 1: Solicitudes de Vacaciones Agrupadas por Colaborador */}
      {activeTab === 'vacaciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Barra de Búsqueda y Filtros */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--muted)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                  <input
                    type="text"
                    placeholder="Buscar colaborador por nombre, puesto o número de empleado..."
                    value={busquedaVacaciones}
                    onChange={(e) => setBusquedaVacaciones(e.target.value)}
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
              </div>

              {/* Botones de expandir/contraer todos */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => toggleExpandirTodosVacaciones(true)}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  Expandir todos
                </button>
                <button
                  onClick={() => toggleExpandirTodosVacaciones(false)}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  Contraer todos
                </button>
              </div>
            </div>

            {/* Chips de Filtro */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Filter size={12} /> Filtro:
              </span>
              <button
                onClick={() => setFiltroVacaciones('todos')}
                style={{
                  background: filtroVacaciones === 'todos' ? 'var(--primary)' : 'var(--card)',
                  color: filtroVacaciones === 'todos' ? 'var(--primary-foreground)' : 'var(--foreground)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '12px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  transition: 'all 0.15s ease'
                }}
              >
                Todos los colaboradores ({colaboradoresVacaciones.length})
              </button>
              <button
                onClick={() => setFiltroVacaciones('pendientes')}
                style={{
                  background: filtroVacaciones === 'pendientes' ? 'var(--primary)' : 'var(--card)',
                  color: filtroVacaciones === 'pendientes' ? 'var(--primary-foreground)' : 'var(--foreground)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '12px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>Con solicitudes pendientes</span>
                <span style={{
                  background: filtroVacaciones === 'pendientes' ? 'var(--primary-foreground)' : '#fef3c7',
                  color: filtroVacaciones === 'pendientes' ? 'var(--primary)' : '#b45309',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '8px',
                  fontSize: '0.7rem'
                }}>
                  {colaboradoresVacaciones.filter(c => c.pendientes_count > 0).length}
                </span>
              </button>
            </div>
          </div>

          {/* Listado Agrupado de Colaboradores */}
          {colaboradoresVacacionesFiltrados.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)', background: 'var(--muted)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              No se encontraron colaboradores que coincidan con el criterio de búsqueda o filtro seleccionado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {colaboradoresVacacionesFiltrados.map((colab) => {
                const abierto = isVacacionExpandido(colab.key, colab.pendientes_count)
                return (
                  <div
                    key={colab.key}
                    style={{
                      background: 'var(--card)',
                      borderRadius: 'var(--radius)',
                      border: colab.pendientes_count > 0 ? '1px solid var(--primary)' : '1px solid var(--border)',
                      overflow: 'hidden',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                    }}
                  >
                    {/* Fila Encabezado del Colaborador (Click para expandir/colapsar) */}
                    <div
                      onClick={() => toggleExpandirVacaciones(colab.key, colab.pendientes_count)}
                      style={{
                        padding: '0.85rem 1.15rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: abierto ? 'var(--muted)' : 'transparent',
                        transition: 'background 0.15s ease',
                        borderBottom: abierto ? '1px solid var(--border)' : 'none'
                      }}
                    >
                      {/* Información de Identidad */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        {colab.avatar ? (
                          <img
                            src={colab.avatar}
                            alt={colab.nombre}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              if (e.currentTarget.nextElementSibling) {
                                e.currentTarget.nextElementSibling.style.display = 'flex'
                              }
                            }}
                            style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
                          />
                        ) : null}
                        <div
                          style={{
                            display: colab.avatar ? 'none' : 'flex',
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            color: 'var(--primary-foreground)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.88rem'
                          }}
                        >
                          {colab.nombre?.[0] || 'C'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h4 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--foreground)' }}>
                              {colab.nombre}
                            </h4>
                            <span style={{ fontSize: '0.72rem', background: 'var(--muted)', color: 'var(--muted-foreground)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                              {colab.numero}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                            {colab.puesto} • {colab.departamento}
                          </span>
                        </div>
                      </div>

                      {/* Métricas y Estado de Atención */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        {colab.dias_disponibles !== null && colab.dias_disponibles !== undefined && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'none', mdDisplay: 'inline' }}>
                            Saldo: <strong style={{ color: 'var(--foreground)' }}>{colab.dias_disponibles} días</strong>
                          </span>
                        )}

                        <span style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '12px',
                          fontWeight: 700,
                          background: colab.pendientes_count > 0 ? '#fef3c7' : '#dcfce7',
                          color: colab.pendientes_count > 0 ? '#b45309' : '#15803d'
                        }}>
                          {colab.pendientes_count > 0 ? `${colab.pendientes_count} pendiente(s)` : 'Al corriente'}
                        </span>

                        <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>
                          {colab.solicitudes.length} {colab.solicitudes.length === 1 ? 'solicitud' : 'solicitudes'} ({colab.total_dias}d)
                        </span>

                        <div style={{ color: 'var(--muted-foreground)' }}>
                          {abierto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </div>

                    {/* Contenido Expandido: Solicitudes del Colaborador */}
                    {abierto && (
                      <div style={{ padding: '0.85rem 1.15rem' }}>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>
                                <th style={{ padding: '0.65rem' }}>Período Solicitado</th>
                                <th style={{ padding: '0.65rem' }}>Días</th>
                                <th style={{ padding: '0.65rem' }}>Motivo</th>
                                <th style={{ padding: '0.65rem' }}>Fecha Registro</th>
                                <th style={{ padding: '0.65rem' }}>Estado</th>
                                <th style={{ padding: '0.65rem', textAlign: 'right' }}>Dictamen</th>
                              </tr>
                            </thead>
                            <tbody>
                              {colab.solicitudes.map((sol) => (
                                <tr key={sol.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                  <td style={{ padding: '0.65rem', fontWeight: 600 }}>
                                    {sol.fecha_inicio} al {sol.fecha_fin}
                                  </td>
                                  <td style={{ padding: '0.65rem' }}>
                                    {sol.dias_solicitados} días
                                  </td>
                                  <td style={{ padding: '0.65rem', color: 'var(--muted-foreground)' }}>
                                    {sol.motivo || 'Sin especificar'}
                                  </td>
                                  <td style={{ padding: '0.65rem', fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                                    {new Date(sol.fecha_creacion).toLocaleDateString('es-MX')}
                                  </td>
                                  <td style={{ padding: '0.65rem' }}>
                                    <span style={{
                                      padding: '0.2rem 0.55rem',
                                      borderRadius: '10px',
                                      fontSize: '0.72rem',
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
                                  <td style={{ padding: '0.65rem', textAlign: 'right' }}>
                                    {sol.estado === 'PENDIENTE' ? (
                                      <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                                        <button
                                          onClick={() => handleAprobarRechazarVacaciones(sol.id, 'APROBADO')}
                                          className="btn-primary"
                                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#16a34a' }}
                                        >
                                          <CheckCircle size={13} />
                                          <span>Aprobar</span>
                                        </button>
                                        <button
                                          onClick={() => handleAprobarRechazarVacaciones(sol.id, 'RECHAZADO')}
                                          className="btn-secondary"
                                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#dc2626' }}
                                        >
                                          <XCircle size={13} />
                                          <span>Rechazar</span>
                                        </button>
                                      </div>
                                    ) : (
                                      <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                                        Dictaminada
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Tickets de Soporte Agrupados por Colaborador */}
      {activeTab === 'tickets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Barra de Búsqueda y Filtros */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--muted)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '260px' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)' }} />
                  <input
                    type="text"
                    placeholder="Buscar por colaborador, número, folio (TK-) o asunto..."
                    value={busquedaTickets}
                    onChange={(e) => setBusquedaTickets(e.target.value)}
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
              </div>

              {/* Botones de expandir/contraer todos */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  onClick={() => toggleExpandirTodosTickets(true)}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  Expandir todos
                </button>
                <button
                  onClick={() => toggleExpandirTodosTickets(false)}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  Contraer todos
                </button>
              </div>
            </div>

            {/* Chips de Filtro */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Filter size={12} /> Filtro:
              </span>
              <button
                onClick={() => setFiltroTickets('todos')}
                style={{
                  background: filtroTickets === 'todos' ? 'var(--primary)' : 'var(--card)',
                  color: filtroTickets === 'todos' ? 'var(--primary-foreground)' : 'var(--foreground)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '12px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  transition: 'all 0.15s ease'
                }}
              >
                Todos los colaboradores ({colaboradoresTickets.length})
              </button>
              <button
                onClick={() => setFiltroTickets('pendientes')}
                style={{
                  background: filtroTickets === 'pendientes' ? 'var(--primary)' : 'var(--card)',
                  color: filtroTickets === 'pendientes' ? 'var(--primary-foreground)' : 'var(--foreground)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '12px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>Con tickets abiertos</span>
                <span style={{
                  background: filtroTickets === 'pendientes' ? 'var(--primary-foreground)' : '#dbeafe',
                  color: filtroTickets === 'pendientes' ? 'var(--primary)' : '#1d4ed8',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '8px',
                  fontSize: '0.7rem'
                }}>
                  {colaboradoresTickets.filter(c => c.abiertos_count > 0).length}
                </span>
              </button>
            </div>
          </div>

          {/* Listado Agrupado de Colaboradores con Tickets */}
          {colaboradoresTicketsFiltrados.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)', background: 'var(--muted)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              No se encontraron colaboradores que coincidan con el criterio de búsqueda o filtro seleccionado.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {colaboradoresTicketsFiltrados.map((colab) => {
                const abierto = isTicketExpandido(colab.key, colab.abiertos_count)
                return (
                  <div
                    key={colab.key}
                    style={{
                      background: 'var(--card)',
                      borderRadius: 'var(--radius)',
                      border: colab.abiertos_count > 0 ? '1px solid var(--primary)' : '1px solid var(--border)',
                      overflow: 'hidden',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
                    }}
                  >
                    {/* Fila Encabezado del Colaborador (Click para expandir/colapsar) */}
                    <div
                      onClick={() => toggleExpandirTickets(colab.key, colab.abiertos_count)}
                      style={{
                        padding: '0.85rem 1.15rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        background: abierto ? 'var(--muted)' : 'transparent',
                        transition: 'background 0.15s ease',
                        borderBottom: abierto ? '1px solid var(--border)' : 'none'
                      }}
                    >
                      {/* Información de Identidad */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        {colab.avatar ? (
                          <img
                            src={colab.avatar}
                            alt={colab.nombre}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              if (e.currentTarget.nextElementSibling) {
                                e.currentTarget.nextElementSibling.style.display = 'flex'
                              }
                            }}
                            style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
                          />
                        ) : null}
                        <div
                          style={{
                            display: colab.avatar ? 'none' : 'flex',
                            width: '38px',
                            height: '38px',
                            borderRadius: '50%',
                            background: 'var(--primary)',
                            color: 'var(--primary-foreground)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.88rem'
                          }}
                        >
                          {colab.nombre?.[0] || 'C'}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <h4 style={{ fontSize: '0.94rem', fontWeight: 700, color: 'var(--foreground)' }}>
                              {colab.nombre}
                            </h4>
                            <span style={{ fontSize: '0.72rem', background: 'var(--muted)', color: 'var(--muted-foreground)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                              {colab.numero}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                            {colab.puesto} • {colab.departamento}
                          </span>
                        </div>
                      </div>

                      {/* Métricas y Estado de Atención */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '12px',
                          fontWeight: 700,
                          background: colab.abiertos_count > 0 ? '#dbeafe' : '#dcfce7',
                          color: colab.abiertos_count > 0 ? '#1d4ed8' : '#15803d'
                        }}>
                          {colab.abiertos_count > 0 ? `${colab.abiertos_count} abierto(s)` : 'Todos resueltos'}
                        </span>

                        <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', fontWeight: 500 }}>
                          {colab.tickets.length} {colab.tickets.length === 1 ? 'ticket' : 'tickets'}
                        </span>

                        <div style={{ color: 'var(--muted-foreground)' }}>
                          {abierto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </div>

                    {/* Contenido Expandido: Tickets del Colaborador */}
                    {abierto && (
                      <div style={{ padding: '1rem 1.15rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                        {colab.tickets.map((t) => (
                          <div
                            key={t.id}
                            style={{
                              background: 'var(--background)',
                              padding: '1rem',
                              borderRadius: 'var(--radius)',
                              border: '1px solid var(--border)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--primary)', fontFamily: 'monospace' }}>
                                  {t.folio}
                                </span>
                                <span style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                                  • {new Date(t.fecha_creacion).toLocaleDateString('es-MX')} {new Date(t.fecha_creacion).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <span style={{
                                fontSize: '0.74rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '10px',
                                fontWeight: 600,
                                background: t.estado === 'RESUELTO' ? '#dcfce7' : t.estado === 'EN_PROCESO' ? '#fef3c7' : '#fee2e2',
                                color: t.estado === 'RESUELTO' ? '#15803d' : t.estado === 'EN_PROCESO' ? '#b45309' : '#b91c1c'
                              }}>
                                {t.estado}
                              </span>
                            </div>

                            <h5 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.35rem' }}>
                              {t.asunto}
                            </h5>
                            <p style={{ fontSize: '0.83rem', color: 'var(--muted-foreground)', marginBottom: '0.85rem', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                              {t.descripcion}
                            </p>

                            {t.respuesta_rh ? (
                              <div style={{ background: 'var(--card)', padding: '0.85rem 1rem', borderRadius: 'var(--radius)', borderLeft: '4px solid #16a34a', fontSize: '0.85rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#16a34a', fontWeight: 600, marginBottom: '0.25rem' }}>
                                  <CheckCircle size={15} />
                                  <span>Respuesta formal de Recursos Humanos:</span>
                                </div>
                                <p style={{ margin: 0, color: 'var(--foreground)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                                  {t.respuesta_rh}
                                </p>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                                <input
                                  type="text"
                                  placeholder="Escribe la respuesta formal de RH para resolver este ticket..."
                                  value={ticketRespuesta.id === t.id ? ticketRespuesta.respuesta_rh : ''}
                                  onChange={(e) => setTicketRespuesta({ id: t.id, respuesta_rh: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      handleEnviarRespuestaTicket(t.id)
                                    }
                                  }}
                                  style={{
                                    flex: 1,
                                    minWidth: '220px',
                                    padding: '0.45rem 0.75rem',
                                    borderRadius: 'var(--radius)',
                                    border: '1px solid var(--border)',
                                    background: 'var(--input)',
                                    color: 'var(--foreground)',
                                    fontSize: '0.84rem'
                                  }}
                                />
                                <button
                                  onClick={() => handleEnviarRespuestaTicket(t.id)}
                                  className="btn-primary"
                                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                                >
                                  <CheckCircle size={14} />
                                  <span>Responder & Resolver</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Base de Conocimiento RAG (FAQ) */}
      {activeTab === 'faq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Carga de Documentos PDF/TXT */}
          <div style={{ background: 'var(--card)', padding: '1.25rem', borderRadius: 'var(--radius)', border: '1px dashed var(--primary)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Upload size={20} style={{ color: 'var(--primary)' }} />
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Carga Masiva de Documentos RAG (.pdf, .txt, .md)</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>Sube reglamentos de trabajo o políticas de RH para entrenar automáticamente al chatbot.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
              <input
                type="file"
                accept=".pdf,.txt,.md"
                onChange={handleSubirDocumento}
                disabled={subiendoDoc}
                style={{ fontSize: '0.85rem', color: 'var(--foreground)' }}
              />
            </div>

            {msgUpload && (
              <div style={{ fontSize: '0.82rem', marginTop: '0.4rem', fontWeight: 500 }}>
                {msgUpload}
              </div>
            )}
          </div>

          {/* Formulario Agregar FAQ Manual */}
          <form onSubmit={handleCrearFaq} style={{ background: 'var(--muted)', padding: '1rem', borderRadius: 'var(--radius)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={16} /> Añadir Nueva Pregunta Frecuente al Motor RAG
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Categoría (ej: Beneficios, Horarios)"
                value={nuevaFaq.categoria}
                onChange={(e) => setNuevaFaq({ ...nuevaFaq, categoria: e.target.value })}
                style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)', fontSize: '0.85rem' }}
              />
              <input
                type="text"
                placeholder="Pregunta frecuente del colaborador"
                value={nuevaFaq.pregunta}
                onChange={(e) => setNuevaFaq({ ...nuevaFaq, pregunta: e.target.value })}
                style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)', fontSize: '0.85rem' }}
              />
            </div>

            <textarea
              placeholder="Respuesta oficial institucional..."
              value={nuevaFaq.respuesta}
              onChange={(e) => setNuevaFaq({ ...nuevaFaq, respuesta: e.target.value })}
              rows={2}
              style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)', fontSize: '0.85rem', resize: 'none' }}
            />

            <button type="submit" className="btn-primary" style={{ alignSelf: 'flex-end', fontSize: '0.85rem' }}>
              Guardar en Base RAG
            </button>
          </form>

          {/* Lista de FAQs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {faqs.map((f) => (
              <div key={f.id} style={{ background: 'var(--card)', padding: '0.85rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.72rem', background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                      {f.categoria}
                    </span>
                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      padding: '0.1rem 0.45rem',
                      borderRadius: '4px',
                      background: f.activa ? '#dcfce7' : '#fee2e2',
                      color: f.activa ? '#15803d' : '#b91c1c',
                      border: `1px solid ${f.activa ? '#bbf7d0' : '#fecaca'}`
                    }}>
                      {f.activa ? 'Activo en Agente' : 'Inactivo'}
                    </span>
                  </div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '0.35rem', color: 'var(--foreground)' }}>{f.pregunta}</h4>
                  <p style={{ fontSize: '0.83rem', color: 'var(--muted-foreground)', marginTop: '0.2rem', whiteSpace: 'pre-line' }}>{f.respuesta}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                  <button
                    onClick={() => handleToggleFaq(f.id, f.activa)}
                    className="btn-secondary"
                    title={f.activa ? 'Desactivar para que el agente conversacional no la consulte' : 'Activar para que el agente conversacional la consulte'}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.35rem 0.7rem',
                      color: f.activa ? '#dc2626' : '#16a34a',
                      border: `1px solid ${f.activa ? '#fca5a5' : '#86efac'}`
                    }}
                  >
                    {f.activa ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => handleDeleteFaq(f.id, f.pregunta)}
                    className="btn-secondary"
                    title="Eliminar permanentemente este reglamento de la base de conocimientos"
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.35rem 0.6rem',
                      color: '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      border: '1px solid #fecaca'
                    }}
                  >
                    <Trash2 size={13} />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Horario y Calendario Institucional RH */}
      {activeTab === 'calendario' && (
        <CalendarioLaboral
          perfil={perfilRH}
          vacaciones={vacaciones}
          onRefreshData={fetchAdminData}
          esAdminRH={true}
        />
      )}

      {/* Tab 5: Mi Perfil RH */}
      {activeTab === 'perfil' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!perfilRH ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
              Cargando perfil institucional de Recursos Humanos...
            </div>
          ) : (
            <>
              {/* Tarjeta de Identidad y Fotografía Institucional */}
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
                {/* Avatar y Selector */}
                <div style={{ position: 'relative', width: '96px', height: '96px', flexShrink: 0 }}>
                  {previewFotoRH || perfilRH.foto_perfil_url ? (
                    <img
                      src={previewFotoRH || perfilRH.foto_perfil_url}
                      alt={`${perfilRH.user.first_name} ${perfilRH.user.last_name}`}
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
                        fontSize: '2rem',
                        fontWeight: 700,
                        border: '3px solid var(--border)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                    >
                      {perfilRH.user.first_name?.[0] || 'R'}
                    </div>
                  )}

                  {/* Botón flotante para seleccionar foto */}
                  <button
                    onClick={() => fileInputRefRH.current?.click()}
                    disabled={subiendoFotoRH}
                    title="Actualizar fotografía institucional"
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
                    ref={fileInputRefRH}
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleSelectFotoRH}
                    style={{ display: 'none' }}
                  />
                </div>

                {/* Datos del Funcionario */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      {perfilRH.user.first_name} {perfilRH.user.last_name}
                    </h3>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                        fontSize: '0.72rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: '12px',
                        background: 'var(--primary)',
                        color: 'var(--primary-foreground)',
                        fontWeight: 600
                      }}
                    >
                      <Shield size={12} />
                      Funcionario RH
                    </span>
                  </div>

                  <p style={{ fontSize: '0.86rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '0.25rem' }}>
                    {perfilRH.puesto} — {perfilRH.departamento}
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                    Credencial oficial: <strong>{perfilRH.numero_empleado}</strong> • {perfilRH.user.email}
                  </p>

                  {/* Acciones al seleccionar archivo nuevo */}
                  {archivoFotoRH && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.65rem' }}>
                      <button
                        onClick={handleUploadFotoRH}
                        disabled={subiendoFotoRH}
                        className="btn-primary"
                        style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        {subiendoFotoRH ? <RefreshCw size={13} className="spin" /> : <CheckCircle size={13} />}
                        <span>{subiendoFotoRH ? 'Subiendo...' : 'Confirmar nueva fotografía'}</span>
                      </button>
                      <button
                        onClick={handleCancelFotoRH}
                        disabled={subiendoFotoRH}
                        className="btn-secondary"
                        style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* Opción de eliminar foto actual */}
                  {!archivoFotoRH && perfilRH.foto_perfil_url && (
                    <button
                      onClick={handleDeleteFotoRH}
                      disabled={subiendoFotoRH}
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
                  {msgFotoRH && (
                    <div
                      style={{
                        padding: '0.35rem 0.65rem',
                        borderRadius: 'var(--radius)',
                        fontSize: '0.78rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        marginTop: '0.5rem',
                        background: msgFotoRH.type === 'success' ? '#dcfce7' : '#fee2e2',
                        color: msgFotoRH.type === 'success' ? '#15803d' : '#b91c1c',
                        border: `1px solid ${msgFotoRH.type === 'success' ? '#86efac' : '#fca5a5'}`
                      }}
                    >
                      {msgFotoRH.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                      <span>{msgFotoRH.text}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expediente Institucional de RH */}
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.65rem' }}>
                  Ficha de Identificación Institucional
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.85rem' }}>
                  <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Nombre Completo</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                      {perfilRH.user.first_name} {perfilRH.user.last_name}
                    </strong>
                  </div>

                  <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Correo Electrónico RH</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                      {perfilRH.user.email}
                    </strong>
                  </div>

                  <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Número de Empleado / Clave</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--primary)' }}>
                      {perfilRH.numero_empleado}
                    </strong>
                  </div>

                  <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Puesto Asignado</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                      {perfilRH.puesto}
                    </strong>
                  </div>

                  <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Departamento Operativo</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                      {perfilRH.departamento}
                    </strong>
                  </div>

                  <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'block' }}>Antigüedad Registrada</span>
                    <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)' }}>
                      {perfilRH.antiguedad_anios ?? 1} {Number(perfilRH.antiguedad_anios) === 1 ? 'año' : 'años'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Matriz de Permisos y Autorizaciones Oficiales */}
              <div>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--foreground)', marginBottom: '0.65rem' }}>
                  Matriz de Autorizaciones y Permisos en el Backoffice
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  <div style={{ background: 'var(--card)', padding: '0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', gap: '0.75rem' }}>
                    <div style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }}>
                      <CheckCircle size={18} />
                    </div>
                    <div>
                      <h5 style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        Aprobación y Dictaminación de Vacaciones
                      </h5>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
                        Facultad para aprobar, rechazar y auditar solicitudes de descanso de todos los colaboradores.
                      </p>
                    </div>
                  </div>

                  <div style={{ background: 'var(--card)', padding: '0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', gap: '0.75rem' }}>
                    <div style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }}>
                      <CheckCircle size={18} />
                    </div>
                    <div>
                      <h5 style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        Mesa de Ayuda y Respuesta a Tickets
                      </h5>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
                        Atención directa a folios, registro de respuestas oficiales y cambio de estatus de incidencias.
                      </p>
                    </div>
                  </div>

                  <div style={{ background: 'var(--card)', padding: '0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', gap: '0.75rem' }}>
                    <div style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }}>
                      <CheckCircle size={18} />
                    </div>
                    <div>
                      <h5 style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        Ingesta y Entrenamiento RAG
                      </h5>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
                        Carga y vectorización de reglamentos en PDF/TXT y administración de FAQs del modelo conversacional.
                      </p>
                    </div>
                  </div>

                  <div style={{ background: 'var(--card)', padding: '0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', gap: '0.75rem' }}>
                    <div style={{ color: '#16a34a', flexShrink: 0, marginTop: '2px' }}>
                      <CheckCircle size={18} />
                    </div>
                    <div>
                      <h5 style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        Emisión y Validación de Constancias
                      </h5>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginTop: '0.15rem' }}>
                        Autorización de plantillas oficiales en PDF generadas para el personal institucional.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Beneficio Vacacional Personal del Usuario RH */}
              <div style={{ background: 'var(--muted)', padding: '0.85rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>
                    Beneficio Vacacional Personal (Como Colaborador)
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>
                    {perfilRH.dias_vacaciones_disponibles} días disponibles
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  <div style={{ background: 'var(--card)', padding: '0.45rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block' }}>Asignados</span>
                    <strong style={{ fontSize: '0.9rem' }}>{perfilRH.dias_vacaciones_totales}</strong>
                  </div>
                  <div style={{ background: 'var(--card)', padding: '0.45rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block' }}>Tomados</span>
                    <strong style={{ fontSize: '0.9rem' }}>{perfilRH.dias_vacaciones_tomados}</strong>
                  </div>
                  <div style={{ background: 'var(--card)', padding: '0.45rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block' }}>Retenidos</span>
                    <strong style={{ fontSize: '0.9rem', color: '#b45309' }}>{perfilRH.dias_vacaciones_retenidos ?? 0}</strong>
                  </div>
                  <div style={{ background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '0.45rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
                    <span style={{ fontSize: '0.7rem', display: 'block' }}>Disponibles</span>
                    <strong style={{ fontSize: '0.9rem' }}>{perfilRH.dias_vacaciones_disponibles}</strong>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '0.9rem 2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted-foreground)', background: 'var(--card)' }}>
        © 2026 PluriOne S.A. de C.V. (Develop Talent & Technology) — Autenticación Segura con Auth0 SSO & RBAC.
      </footer>
    </div>
  </div>
)
}

