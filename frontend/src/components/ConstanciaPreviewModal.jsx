import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Eye, X, Download, Loader2, AlertCircle } from 'lucide-react'
import apiClient from '../api/apiClient.js'

export default function ConstanciaPreviewModal({ isOpen, onClose }) {
  const [blobUrl, setBlobUrl] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let activeUrl = null

    if (isOpen) {
      setCargando(true)
      setError(null)
      apiClient.get('/hr/constancia/?preview=true', { responseType: 'blob' })
        .then((res) => {
          const blob = new Blob([res.data], { type: 'application/pdf' })
          activeUrl = window.URL.createObjectURL(blob)
          setBlobUrl(activeUrl)
        })
        .catch((err) => {
          console.error('Error al cargar vista previa de constancia:', err)
          setError('No fue posible cargar la vista previa del documento PDF.')
        })
        .finally(() => {
          setCargando(false)
        })
    } else {
      if (blobUrl) {
        window.URL.revokeObjectURL(blobUrl)
        setBlobUrl('')
      }
    }

    return () => {
      if (activeUrl) {
        window.URL.revokeObjectURL(activeUrl)
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleDescargar = () => {
    if (!blobUrl) return
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = 'Constancia_Laboral.pdf'
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  const modalContent = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '1rem'
      }}
    >
      <div
        className="glass-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '850px',
          background: 'var(--card)',
          padding: '1.25rem',
          borderRadius: 'var(--radius)',
          boxShadow: '0 15px 30px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          height: 'min(720px, 88vh)',
          maxHeight: '88vh'
        }}
      >
        {/* Header Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', padding: '0.4rem', borderRadius: 'var(--radius)' }}>
              <Eye size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--foreground)' }}>Vista Previa de Constancia Laboral</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>Documento Oficial expedido por PluriOne S.A. de C.V.</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {blobUrl && (
              <button
                onClick={handleDescargar}
                className="btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', padding: '0.4rem 0.85rem', cursor: 'pointer' }}
              >
                <Download size={16} />
                <span>Descargar PDF</span>
              </button>
            )}

            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PDF Viewer Object / Iframe / Estados */}
        <div style={{ flex: 1, background: 'var(--muted)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {cargando ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'var(--muted-foreground)' }}>
              <Loader2 size={32} className="spin" />
              <p style={{ fontSize: '0.9rem' }}>Cargando vista previa del documento PDF...</p>
            </div>
          ) : error ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'var(--destructive)', padding: '2rem', textAlign: 'center' }}>
              <AlertCircle size={32} />
              <p style={{ fontSize: '0.9rem' }}>{error}</p>
            </div>
          ) : blobUrl ? (
            <object
              data={blobUrl}
              type="application/pdf"
              style={{ width: '100%', height: '100%' }}
            >
              <iframe
                src={blobUrl}
                title="Vista Previa de Constancia Laboral PDF"
                style={{ width: '100%', height: '100%', border: 'none' }}
              >
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                  <p>Tu navegador no admite la vista previa directa de archivos PDF.</p>
                  <button onClick={handleDescargar} className="btn-primary" style={{ marginTop: '1rem', display: 'inline-flex', cursor: 'pointer' }}>
                    Descargar Constancia en PDF
                  </button>
                </div>
              </iframe>
            </object>
          ) : null}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
