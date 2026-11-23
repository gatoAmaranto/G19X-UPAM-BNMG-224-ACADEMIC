import React, { useState } from 'react'
import { Upload, Plus, Trash2 } from 'lucide-react'
import apiClient from '../api/apiClient.js'

export default function AdminFaqManager({ faqs, setFaqs, fetchAdminData, apiBase = '/hr/admin' }) {
  const [nuevaFaq, setNuevaFaq] = useState({ categoria: 'Políticas Generales', pregunta: '', respuesta: '' })
  const [subiendoDoc, setSubiendoDoc] = useState(false)
  const [msgUpload, setMsgUpload] = useState('')

  const handleSubirDocumento = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('archivo', file)

    try {
      setSubiendoDoc(true)
      setMsgUpload('Procesando e ingiriendo documento...')
      const res = await apiClient.post(`${apiBase}/faq/upload/`, formData, {
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

  const handleCrearFaq = async (e) => {
    e.preventDefault()
    if (!nuevaFaq.pregunta.trim() || !nuevaFaq.respuesta.trim()) return
    try {
      await apiClient.post(`${apiBase}/faq/`, nuevaFaq)
      setNuevaFaq({ categoria: 'Políticas Generales', pregunta: '', respuesta: '' })
      fetchAdminData()
    } catch (err) {
      alert('Error al guardar la nueva pregunta en la base de conocimientos.')
    }
  }

  const handleToggleFaq = async (id, estadoActual) => {
    try {
      const res = await apiClient.patch(`${apiBase}/faq/${id}/`, { activa: !estadoActual })
      setFaqs(prev => prev.map(f => f.id === id ? { ...f, activa: res.data.activa } : f))
    } catch (err) {
      alert('Error al modificar el estado de la regla en la base de conocimientos.')
    }
  }

  const handleDeleteFaq = async (id, pregunta) => {
    const confirmar = window.confirm(
      `¿Estás seguro de que deseas eliminar permanentemente esta regla de la base de conocimientos?\n\n"${pregunta}"\n\nEsta acción no se puede deshacer y el asistente virtual ya no podrá consultarla.`
    )
    if (!confirmar) return

    try {
      await apiClient.delete(`${apiBase}/faq/${id}/`)
      setFaqs(prev => prev.filter(f => f.id !== id))
    } catch (err) {
      alert('Error al eliminar la regla de la base de conocimientos.')
    }
  }

  return (
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
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
          <div key={f.id} style={{ background: 'var(--card)', padding: '0.85rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
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
  )
}
