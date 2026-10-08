import React, { useState, useEffect } from 'react'
import { CheckCircle, XCircle, MessageSquare, Plus, BookOpen, Calendar, Ticket, AlertCircle, RefreshCw, Upload, FileText, Briefcase } from 'lucide-react'
import axios from 'axios'


const API_BASE = 'http://localhost:8000/api/hr/admin'

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('vacaciones')
  const [vacaciones, setVacaciones] = useState([])
  const [tickets, setTickets] = useState([])
  const [faqs, setFaqs] = useState([])
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

  const fetchAdminData = async () => {
    try {
      setLoading(true)
      const [resVac, resTick, resFaq] = await Promise.all([
        axios.get(`${API_BASE}/vacaciones/`),
        axios.get(`${API_BASE}/tickets/`),
        axios.get(`${API_BASE}/faq/`)
      ])
      setVacaciones(resVac.data)
      setTickets(resTick.data)
      setFaqs(resFaq.data)
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
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
              {activeTab === 'vacaciones' && 'Revisa y dictamina las solicitudes de descanso vacacional enviadas por los colaboradores.'}
              {activeTab === 'tickets' && 'Resuelve consultas y solicitudes especiales canalizadas por el agente conversacional.'}
              {activeTab === 'faq' && 'Carga reglamentos y actualiza preguntas frecuentes para alimentar el modelo de IA.'}
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
      </main>
    </div>
  )
}

