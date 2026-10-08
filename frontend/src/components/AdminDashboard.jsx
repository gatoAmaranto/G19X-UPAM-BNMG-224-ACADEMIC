import React, { useState, useEffect, useRef } from 'react'
import {
  CheckCircle, XCircle, MessageSquare, Plus, BookOpen, Calendar,
  Ticket, AlertCircle, RefreshCw, Upload, FileText, Briefcase,
  User, Camera, Trash2, Shield, Mail, Award, Check
} from 'lucide-react'
import axios from 'axios'


const API_BASE = 'http://localhost:8000/api/hr/admin'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('vacaciones')
  const [vacaciones, setVacaciones] = useState([])
  const [tickets, setTickets] = useState([])
  const [faqs, setFaqs] = useState([])
  const [perfilRH, setPerfilRH] = useState(null)
  const [loading, setLoading] = useState(true)

  const vacacionesPendientes = vacaciones.filter(v => v.estado === 'PENDIENTE')
  const ticketsAbiertos = tickets.filter(t => t.estado !== 'RESUELTO')


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
        axios.get(`${API_BASE}/vacaciones/`),
        axios.get(`${API_BASE}/tickets/`),
        axios.get(`${API_BASE}/faq/`),
        axios.get(`${API_BASE}/perfil/`).catch(() => null)
      ])
      setVacaciones(resVac.data)
      setTickets(resTick.data)
      setFaqs(resFaq.data)
      if (resPerfil?.data) {
        setPerfilRH(resPerfil.data)
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

  // Carga de Documentos PDF/TXT
  const handleSubirDocumento = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('archivo', file)

    try {
      setSubiendoDoc(true)
      setMsgUpload('Procesando e ingiriendo documento...')
      const res = await axios.post(`${API_BASE}/faq/upload/`, formData, {
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

      const res = await axios.post(`${API_BASE}/perfil/avatar/`, formData, {
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

      const res = await axios.delete(`${API_BASE}/perfil/avatar/`)
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
      await axios.patch(`${API_BASE}/vacaciones/${id}/`, { estado: nuevoEstado })
      fetchAdminData()
    } catch (err) {
      alert('Error al actualizar el estado de las vacaciones.')
    }
  }

  // Responder Ticket
  const handleEnviarRespuestaTicket = async (id) => {
    if (!ticketRespuesta.respuesta_rh.trim()) return
    try {
      await axios.patch(`${API_BASE}/tickets/${id}/`, {
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
      await axios.post(`${API_BASE}/faq/`, nuevaFaq)
      setNuevaFaq({ categoria: 'Políticas Generales', pregunta: '', respuesta: '' })
      fetchAdminData()
    } catch (err) {
      alert('Error al guardar la nueva pregunta en la base de conocimientos.')
    }
  }

  // Activar / Desactivar FAQ
  const handleToggleFaq = async (id) => {
    try {
      await axios.delete(`${API_BASE}/faq/${id}/`)
      fetchAdminData()
    } catch (err) {
      alert('Error al modificar el estado de la FAQ.')
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* Sidenavbar Lateral de Recursos Humanos */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.4rem', borderRadius: 'var(--radius)', display: 'flex' }}>
              <Briefcase size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--foreground)' }}>Backoffice RH</h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>Gestión Institucional</span>
            </div>
          </div>
        </div>

        {/* Enlaces de Navegación del Sidenavbar */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {/* Opción 1: Vacaciones */}
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
              <span>Vacaciones</span>
            </div>
            {vacacionesPendientes.length > 0 && (
              <span style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '10px',
                background: activeTab === 'vacaciones' ? 'var(--primary-foreground)' : '#fef3c7',
                color: activeTab === 'vacaciones' ? 'var(--primary)' : '#b45309',
                fontWeight: 700
              }}>
                {vacacionesPendientes.length}
              </span>
            )}
          </button>

          {/* Opción 2: Tickets de Soporte */}
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
              <span>Mesa de Tickets</span>
            </div>
            {ticketsAbiertos.length > 0 && (
              <span style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '10px',
                background: activeTab === 'tickets' ? 'var(--primary-foreground)' : '#dbeafe',
                color: activeTab === 'tickets' ? 'var(--primary)' : '#1d4ed8',
                fontWeight: 700
              }}>
                {ticketsAbiertos.length}
              </span>
            )}
          </button>

          {/* Opción 3: Base de Conocimiento RAG */}
          <button
            onClick={() => setActiveTab('faq')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.7rem 0.85rem',
              borderRadius: 'var(--radius)',
              border: activeTab === 'faq' ? '1px solid var(--primary)' : '1px solid transparent',
              background: activeTab === 'faq' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'faq' ? 'var(--primary-foreground)' : 'var(--foreground)',
              cursor: 'pointer',
              fontSize: '0.86rem',
              fontWeight: activeTab === 'faq' ? 600 : 500,
              textAlign: 'left',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <BookOpen size={18} />
              <span>Base RAG & FAQs</span>
            </div>
            <span style={{
              fontSize: '0.7rem',
              padding: '0.15rem 0.45rem',
              borderRadius: '10px',
              background: activeTab === 'faq' ? 'var(--primary-foreground)' : 'var(--muted)',
              color: activeTab === 'faq' ? 'var(--primary)' : 'var(--muted-foreground)',
              fontWeight: 600
            }}>
              {faqs.length}
            </span>
          </button>

          {/* Opción 4: Mi Perfil RH */}
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
              <span>Mi Perfil RH</span>
            </div>
            {perfilRH?.foto_perfil_url ? (
              <img
                src={perfilRH.foto_perfil_url}
                alt="Avatar RH"
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
                padding: '0.15rem 0.4rem',
                borderRadius: '8px',
                background: activeTab === 'perfil' ? 'var(--primary-foreground)' : 'var(--muted)',
                color: activeTab === 'perfil' ? 'var(--primary)' : 'var(--muted-foreground)',
                fontWeight: 600
              }}>
                RH
              </span>
            )}
          </button>
        </nav>

        {/* Resumen de Métricas / Estado */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--muted-foreground)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span>Pendientes de Revisión:</span>
              <strong style={{ color: (vacacionesPendientes.length + ticketsAbiertos.length) > 0 ? '#b45309' : 'var(--foreground)' }}>
                {vacacionesPendientes.length + ticketsAbiertos.length}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Documentos RAG:</span>
              <strong>{faqs.filter(f => f.activa).length} activos</strong>
            </div>
          </div>

          <button
            onClick={fetchAdminData}
            className="btn-secondary"
            style={{ width: '100%', padding: '0.45rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginTop: '0.3rem' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>Sincronizar datos</span>
          </button>
        </div>
      </aside>

      {/* Área Principal de Contenido a la derecha */}
      <main className="glass-panel" style={{ padding: '1.5rem', minHeight: '620px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Encabezado dinámico de la sección */}
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {activeTab === 'vacaciones' && 'Aprobación y Gestión de Vacaciones'}
              {activeTab === 'tickets' && 'Mesa de Ayuda y Atención de Tickets'}
              {activeTab === 'faq' && 'Entrenamiento de Base de Conocimiento RAG'}
              {activeTab === 'perfil' && 'Perfil Institucional y Credenciales de Recursos Humanos'}
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
              {activeTab === 'vacaciones' && 'Revisa y dictamina las solicitudes de descanso vacacional enviadas por los colaboradores.'}
              {activeTab === 'tickets' && 'Resuelve consultas y solicitudes especiales canalizadas por el agente conversacional.'}
              {activeTab === 'faq' && 'Carga reglamentos y actualiza preguntas frecuentes para alimentar el modelo de IA.'}
              {activeTab === 'perfil' && 'Expediente del funcionario de RH, fotografía institucional y auditoría de permisos asignados.'}
            </p>
          </div>
        </div>


      {/* Tab 1: Solicitudes de Vacaciones */}
      {activeTab === 'vacaciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {vacaciones.length === 0 ? (
            <p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)' }}>No hay solicitudes de vacaciones registradas.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.75rem' }}>Colaborador</th>
                    <th style={{ padding: '0.75rem' }}>Período Solicitado</th>
                    <th style={{ padding: '0.75rem' }}>Días</th>
                    <th style={{ padding: '0.75rem' }}>Estado</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {vacaciones.map((vac) => (
                    <tr key={vac.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem', fontWeight: 600 }}>{vac.empleado_nombre || 'Colaborador'}</td>
                      <td style={{ padding: '0.75rem' }}>{vac.fecha_inicio} al {vac.fecha_fin}</td>
                      <td style={{ padding: '0.75rem' }}>{vac.dias_solicitados} días</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          background: vac.estado === 'APROBADO' ? '#dcfce7' : vac.estado === 'RECHAZADO' ? '#fee2e2' : 'var(--accent)',
                          color: vac.estado === 'APROBADO' ? '#15803d' : vac.estado === 'RECHAZADO' ? '#b91c1c' : 'var(--accent-foreground)'
                        }}>
                          {vac.estado}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        {vac.estado === 'PENDIENTE' && (
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleAprobarRechazarVacaciones(vac.id, 'APROBADO')}
                              className="btn-primary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', background: '#16a34a' }}
                            >
                              <CheckCircle size={14} /> Aprobar
                            </button>
                            <button
                              onClick={() => handleAprobarRechazarVacaciones(vac.id, 'RECHAZADO')}
                              className="btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.2rem', color: '#dc2626' }}
                            >
                              <XCircle size={14} /> Rechazar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Tickets de Soporte */}
      {activeTab === 'tickets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {tickets.map((t) => (
            <div key={t.id} style={{ background: 'var(--muted)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>`{t.folio}` — {t.empleado_nombre}</span>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '4px',
                  fontWeight: 600,
                  background: t.estado === 'RESUELTO' ? '#dcfce7' : t.estado === 'EN_PROCESO' ? '#fef3c7' : 'var(--accent)',
                  color: t.estado === 'RESUELTO' ? '#15803d' : t.estado === 'EN_PROCESO' ? '#b45309' : 'var(--accent-foreground)'
                }}>
                  {t.estado}
                </span>
              </div>
              <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '0.3rem' }}>{t.asunto}</p>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', marginBottom: '0.75rem', whiteSpace: 'pre-line' }}>{t.descripcion}</p>

              {t.respuesta_rh ? (
                <div style={{ background: 'var(--card)', padding: '0.85rem 1rem', borderRadius: 'var(--radius)', borderLeft: '4px solid #16a34a', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#16a34a', fontWeight: 600, marginBottom: '0.25rem' }}>
                    <CheckCircle size={15} />
                    <span>Respuesta enviada al colaborador:</span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--foreground)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {t.respuesta_rh}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Escribe la respuesta formal de RH..."
                    value={ticketRespuesta.id === t.id ? ticketRespuesta.respuesta_rh : ''}
                    onChange={(e) => setTicketRespuesta({ id: t.id, respuesta_rh: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleEnviarRespuestaTicket(t.id)
                      }
                    }}
                    style={{ flex: 1, padding: '0.4rem 0.75rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--input)', color: 'var(--foreground)', fontSize: '0.85rem' }}
                  />
                  <button
                    onClick={() => handleEnviarRespuestaTicket(t.id)}
                    className="btn-primary"
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
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
              <div key={f.id} style={{ background: 'var(--card)', padding: '0.85rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: '0.72rem', background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                    {f.categoria}
                  </span>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginTop: '0.3rem', color: 'var(--foreground)' }}>{f.pregunta}</h4>
                  <p style={{ fontSize: '0.83rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>{f.respuesta}</p>
                </div>
                <button
                  onClick={() => handleToggleFaq(f.id)}
                  className="btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem', color: f.activa ? '#dc2626' : '#16a34a' }}
                >
                  {f.activa ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Mi Perfil RH */}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                  <div style={{ background: 'var(--card)', padding: '0.45rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block' }}>Asignados</span>
                    <strong style={{ fontSize: '0.9rem' }}>{perfilRH.dias_vacaciones_totales}</strong>
                  </div>
                  <div style={{ background: 'var(--card)', padding: '0.45rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block' }}>Tomados</span>
                    <strong style={{ fontSize: '0.9rem' }}>{perfilRH.dias_vacaciones_tomados}</strong>
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
    </div>
  )
}

