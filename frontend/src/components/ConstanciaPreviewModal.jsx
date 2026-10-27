import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FileText, X, Download, Eye } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'
import { API_BASE_URL } from '../api/apiClient.js'

export default function ConstanciaPreviewModal({ isOpen, onClose }) {
  const { getToken } = useAuth()
  const [token, setToken] = useState('')

  useEffect(() => {
    if (isOpen && getToken) {
      getToken().then(t => {
        if (t) setToken(t)
      }).catch(console.warn)
    }
  }, [isOpen, getToken])

  if (!isOpen) return null

  const tokenParam = token ? `&token=${encodeURIComponent(token)}` : ''
  const previewUrl = `${API_BASE_URL}/hr/constancia/?preview=true${tokenParam}`
  const downloadUrl = `${API_BASE_URL}/hr/constancia/?download=true${tokenParam}`

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
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none', fontSize: '0.82rem', padding: '0.4rem 0.85rem' }}
            >
              <Download size={16} />
              <span>Descargar PDF</span>
            </a>

            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* PDF Viewer Object / Iframe */}
        <div style={{ flex: 1, background: 'var(--muted)', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <object
            data={previewUrl}
            type="application/pdf"
            style={{ width: '100%', height: '100%' }}
          >
            <iframe
              src={previewUrl}
              title="Vista Previa de Constancia Laboral PDF"
              style={{ width: '100%', height: '100%', border: 'none' }}
            >
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                <p>Tu navegador no admite la vista previa directa de archivos PDF.</p>
                <a href={downloadUrl} target="_blank" rel="noreferrer" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-flex' }}>
                  Descargar Constancia en PDF
                </a>
              </div>
            </iframe>
          </object>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
