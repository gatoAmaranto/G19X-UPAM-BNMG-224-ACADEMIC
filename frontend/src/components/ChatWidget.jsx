import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Download, Calendar, Ticket, HelpCircle, Loader2, Eye } from 'lucide-react'
import axios from 'axios'
import VacacionesModal from './VacacionesModal.jsx'
import TicketModal from './TicketModal.jsx'
import ConstanciaPreviewModal from './ConstanciaPreviewModal.jsx'

const API_BASE = 'http://localhost:8000/api'

export default function ChatWidget({ onRefreshData }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: '¡Hola! Soy el Agente de Autoservicio de Recursos Humanos de Develop Talent & Technology.\n\n¿En qué te puedo ayudar hoy? Puedes consultar tus días de vacaciones, generar tu constancia laboral o resolver dudas sobre políticas de la empresa.',
      actionType: 'INFO_GENERAL',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [inputText, setInputText] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalVacacionesOpen, setModalVacacionesOpen] = useState(false)
  const [modalTicketOpen, setModalTicketOpen] = useState(false)
  const [modalConstanciaOpen, setModalConstanciaOpen] = useState(false)
  const [saldoVacaciones, setSaldoVacaciones] = useState(10)
  const chatEndRef = useRef(null)

  const scrollToBottom = () => {
    if (messages.length > 1 || loading) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Obtener saldo inicial de vacaciones
  useEffect(() => {
    const fetchSaldo = async () => {
      try {
        const res = await axios.get(`${API_BASE}/hr/vacaciones/`)
        if (res.data && res.data.saldo) {
          setSaldoVacaciones(res.data.saldo.disponibles)
        }
      } catch (err) {
        console.error('Error al obtener saldo inicial:', err)
      }
    }
    fetchSaldo()
  }, [])

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText
    if (!text.trim() || loading) return

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMessage])
    if (!textToSend) setInputText('')
    setLoading(true)

    try {
      const response = await axios.post(`${API_BASE}/agent/chat/`, { mensaje: text })
      const data = response.data

      const botMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        text: data.respuesta,
        actionType: data.tipo_accion,
        datos: data.datos,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setMessages(prev => [...prev, botMessage])

      if (data.tipo_accion === 'ABRIR_FORMULARIO_VACACIONES') {
        if (data.datos && data.datos.disponibles !== undefined) {
          setSaldoVacaciones(data.datos.disponibles)
        }
        setModalVacacionesOpen(true)
      } else if (data.tipo_accion === 'ABRIR_FORMULARIO_TICKET') {
        setModalTicketOpen(true)
      } else if (data.tipo_accion === 'CONSTANCIA_GENERADA') {
        setModalConstanciaOpen(true)
      }

      if (onRefreshData) onRefreshData()
    } catch (error) {
      console.error('Error al enviar mensaje:', error)
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: 'Lo siento, ocurrió un problema de conexión con el servidor. Intenta de nuevo en unos momentos.',
          actionType: 'ERROR',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleVacacionesSuccess = (solicitudCreada) => {
    const confirmMessage = {
      id: Date.now(),
      sender: 'bot',
      text: `**Solicitud de Vacaciones Registrada Exitosamente**\n\n` +
            `• Período: ${solicitudCreada.fecha_inicio} al ${solicitudCreada.fecha_fin}\n` +
            `• Días solicitados: ${solicitudCreada.dias_solicitados} días\n` +
            `• Estado: Pendiente de aprobación por RH\n\n` +
            `Se ha enviado una notificación al equipo de Recursos Humanos para su revisión en el Backoffice.`,
      actionType: 'VACACIONES_CONFIRMADAS',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setMessages(prev => [...prev, confirmMessage])
    if (onRefreshData) onRefreshData()
  }

  const handleTicketSuccess = (ticketCreado) => {
    const confirmMessage = {
      id: Date.now(),
      sender: 'bot',
      text: `**Ticket de Soporte Creado Exitosamente**\n\n` +
            `• Folio: \`${ticketCreado.folio}\`\n` +
            `• Asunto: ${ticketCreado.asunto}\n` +
            `• Prioridad: ${ticketCreado.prioridad}\n` +
            `• Estado: Abierto\n\n` +
            `El equipo de Recursos Humanos ha sido notificado y responderá a tu solicitud a la brevedad.`,
      actionType: 'TICKET_CONFIRMADO',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    setMessages(prev => [...prev, confirmMessage])
    if (onRefreshData) onRefreshData()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '620px', overflow: 'hidden' }}>
      {/* Modales */}
      <VacacionesModal
        isOpen={modalVacacionesOpen}
        onClose={() => setModalVacacionesOpen(false)}
        saldoDisponibles={saldoVacaciones}
        onSuccess={handleVacacionesSuccess}
      />

      <TicketModal
        isOpen={modalTicketOpen}
        onClose={() => setModalTicketOpen(false)}
        onSuccess={handleTicketSuccess}
      />

      <ConstanciaPreviewModal
        isOpen={modalConstanciaOpen}
        onClose={() => setModalConstanciaOpen(false)}
      />

      {/* Chat Header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--card)' }}>
        <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.4rem', borderRadius: 'var(--radius)', display: 'flex' }}>
          <Bot size={20} />
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--foreground)' }}>Agente de Autoservicio RH</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
            En línea 24/7 (LangGraph + Gemini RAG)
          </span>
        </div>
      </div>

      {/* Messages Feed */}
      <div style={{ flex: 1, padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%'
            }}
          >
            {msg.sender === 'bot' && (
              <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                <Bot size={18} />
              </div>
            )}

            <div
              style={{
                background: msg.sender === 'user' ? 'var(--primary)' : 'var(--muted)',
                color: msg.sender === 'user' ? 'var(--primary-foreground)' : 'var(--foreground)',
                padding: '0.85rem 1.1rem',
                borderRadius: '12px',
                borderBottomRightRadius: msg.sender === 'user' ? '2px' : '12px',
                borderBottomLeftRadius: msg.sender === 'bot' ? '2px' : '12px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                fontSize: '0.92rem',
                whiteSpace: 'pre-line'
              }}
            >
              <div>{msg.text}</div>

              {/* Bot Action Cards */}
              {msg.actionType === 'ABRIR_FORMULARIO_VACACIONES' && (
                <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setModalVacacionesOpen(true)}
                    className="btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
                  >
                    <Calendar size={16} />
                    Seleccionar Fechas de Vacaciones
                  </button>
                </div>
              )}

              {msg.actionType === 'ABRIR_FORMULARIO_TICKET' && (
                <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                  <button
                    onClick={() => setModalTicketOpen(true)}
                    className="btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}
                  >
                    <Ticket size={16} />
                    Redactar Ticket de Soporte
                  </button>
                </div>
              )}

              {msg.actionType === 'CONSTANCIA_GENERADA' && (
                <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setModalConstanciaOpen(true)}
                    className="btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
                  >
                    <Eye size={16} />
                    <span>Ver Vista Previa</span>
                  </button>
                  <a
                    href={`http://localhost:8000/api/hr/constancia/?download=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
                  >
                    <Download size={16} />
                    <span>Descargar PDF</span>
                  </a>
                </div>
              )}

              <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '0.4rem', textAlign: 'right' }}>
                {msg.timestamp}
              </div>
            </div>

            {msg.sender === 'user' && (
              <div style={{ background: 'var(--secondary)', color: 'var(--secondary-foreground)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px', border: '1px solid var(--border)' }}>
                <User size={18} />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: '0.75rem', alignSelf: 'flex-start' }}>
            <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={18} />
            </div>
            <div style={{ background: 'var(--muted)', padding: '0.85rem 1.1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted-foreground)', fontSize: '0.85rem' }}>
              <Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Procesando consulta...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Quick Action Chips */}
      <div style={{ padding: '0.5rem 1.25rem', borderTop: '1px solid var(--border)', background: 'var(--card)', display: 'flex', gap: '0.5rem', overflowX: 'auto' }}>
        <button
          onClick={() => setModalVacacionesOpen(true)}
          className="btn-secondary"
          style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
        >
          <Calendar size={14} />
          Solicitar Vacaciones
        </button>

        <button
          onClick={() => handleSendMessage('Generar mi constancia laboral')}
          className="btn-secondary"
          style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
        >
          <Download size={14} />
          Constancia PDF
        </button>

        <button
          onClick={() => handleSendMessage('¿Cuál es el horario laboral oficial?')}
          className="btn-secondary"
          style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
        >
          <HelpCircle size={14} />
          Horario Laboral
        </button>

        <button
          onClick={() => setModalTicketOpen(true)}
          className="btn-secondary"
          style={{ fontSize: '0.78rem', padding: '0.35rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}
        >
          <Ticket size={14} />
          Crear Ticket
        </button>
      </div>

      {/* Input Form */}
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)', background: 'var(--card)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu duda o solicitud aquí..."
          rows={1}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
            background: 'var(--input)',
            color: 'var(--foreground)',
            outline: 'none',
            resize: 'none',
            fontSize: '0.9rem'
          }}
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={loading || !inputText.trim()}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', opacity: loading || !inputText.trim() ? 0.6 : 1 }}
        >
          <span>Enviar</span>
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}
