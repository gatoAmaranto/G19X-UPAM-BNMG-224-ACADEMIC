import React, { useState, useRef } from 'react'
import {
  X, User, Camera, Trash2, Mail, Briefcase,
  Building, Calendar, DollarSign, Award, CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react'
import axios from 'axios'
import apiClient from '../api/apiClient.js'

const API_BASE = 'http://localhost:8000/api'

export default function PerfilModal({ isOpen, onClose, perfil, onProfileUpdated }) {
  if (!isOpen || !perfil) return null

  const fileInputRef = useRef(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null) // { type: 'success' | 'error', text: string }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Por favor selecciona un archivo de imagen válido (PNG, JPG o WebP).' })
      return
    }

    // Validar tamaño máximo (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'La imagen excede el límite permitido de 5 MB.' })
      return
    }

    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setStatusMessage(null)
  }

  const handleUploadAvatar = async () => {
    if (!selectedFile) return

    const formData = new FormData()
    formData.append('foto_perfil', selectedFile)

    try {
      setUploading(true)
      setStatusMessage(null)

      const response = await axios.post(`${API_BASE}/hr/perfil/avatar/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      setStatusMessage({ type: 'success', text: 'Foto de perfil actualizada correctamente.' })
      setSelectedFile(null)
      setPreviewUrl(null)
      if (onProfileUpdated) {
        onProfileUpdated(response.data)
      }
    } catch (err) {
      console.error('Error al subir foto de perfil:', err)
      setStatusMessage({
        type: 'error',
        text: err.response?.data?.error || 'Error al subir la fotografía de perfil.'
      })
    } finally {
      setUploading(false)
    }
  }

  const handleCancelSelection = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDeleteAvatar = async () => {
    if (!window.confirm('¿Deseas remover tu fotografía de perfil actual?')) return

    try {
      setUploading(true)
      setStatusMessage(null)

      const response = await axios.delete(`${API_BASE}/hr/perfil/avatar/`)
      setStatusMessage({ type: 'success', text: 'Fotografía de perfil eliminada.' })
      setSelectedFile(null)
      setPreviewUrl(null)
      if (onProfileUpdated) {
        onProfileUpdated(response.data)
      }
    } catch (err) {
      console.error('Error al eliminar foto de perfil:', err)
      setStatusMessage({ type: 'error', text: 'No se pudo eliminar la fotografía de perfil.' })
    } finally {
      setUploading(false)
    }
  }

  const formattedSalary = perfil.salario_mensual
    ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(perfil.salario_mensual)
    : 'Confidencial'

  const currentAvatarSrc = previewUrl || perfil.foto_perfil_url

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border)'
        }}
      >
        {/* Cabecera del Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--foreground)' }}>
              Expediente del Colaborador
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginTop: '0.2rem' }}>
              Ficha laboral oficial y administración de fotografía de perfil
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: 'var(--radius)',
              display: 'flex'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Sección de Avatar & Foto de Perfil */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.85rem',
            padding: '1.25rem',
            background: 'var(--muted)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)'
          }}
        >
          <div style={{ position: 'relative', width: '104px', height: '104px' }}>
            {currentAvatarSrc ? (
              <img
                src={currentAvatarSrc}
                alt={`${perfil.user.first_name} ${perfil.user.last_name}`}
                style={{
                  width: '104px',
                  height: '104px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--primary)',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                }}
              />
            ) : (
              <div
                style={{
                  width: '104px',
                  height: '104px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: 'var(--primary-foreground)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2.2rem',
                  fontWeight: 700,
                  border: '3px solid var(--border)',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
                }}
              >
                {perfil.user.first_name?.[0] || 'C'}
              </div>
            )}

            {/* Botón flotante para seleccionar foto */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Cambiar fotografía"
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
              <Camera size={16} />
            </button>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          <div style={{ textAlign: 'center' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {perfil.user.first_name} {perfil.user.last_name}
            </h4>
            <span style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
              {perfil.puesto}
            </span>
          </div>

          {/* Acciones al seleccionar archivo nuevo */}
          {selectedFile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <button
                onClick={handleUploadAvatar}
                disabled={uploading}
                className="btn-primary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                {uploading ? <RefreshCw size={14} className="spin" /> : <CheckCircle size={14} />}
                <span>{uploading ? 'Subiendo...' : 'Guardar nueva foto'}</span>
              </button>
              <button
                onClick={handleCancelSelection}
                disabled={uploading}
                className="btn-secondary"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Opción de eliminar foto actual si no hay archivo en preview */}
          {!selectedFile && perfil.foto_perfil_url && (
            <button
              onClick={handleDeleteAvatar}
              disabled={uploading}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.2rem 0.5rem',
                borderRadius: 'var(--radius)'
              }}
            >
              <Trash2 size={13} />
              <span>Remover fotografía</span>
            </button>
          )}

          {/* Mensajes de feedback */}
          {statusMessage && (
            <div
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius)',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: statusMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
                color: statusMessage.type === 'success' ? '#15803d' : '#b91c1c',
                border: `1px solid ${statusMessage.type === 'success' ? '#86efac' : '#fca5a5'}`
              }}
            >
              {statusMessage.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Ficha de Información Laboral en Cuadrícula */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.85rem' }}>
          {/* Número de Empleado */}
          <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.73rem', color: 'var(--muted-foreground)', display: 'block' }}>
              Número de Empleado
            </span>
            <strong style={{ fontSize: '0.92rem', color: 'var(--foreground)' }}>
              {perfil.numero_empleado}
            </strong>
          </div>

          {/* Correo Electrónico */}
          <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.73rem', color: 'var(--muted-foreground)', display: 'block' }}>
              Correo Institucional
            </span>
            <strong style={{ fontSize: '0.88rem', color: 'var(--foreground)', wordBreak: 'break-all' }}>
              {perfil.user.email}
            </strong>
          </div>

          {/* Departamento */}
          <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.73rem', color: 'var(--muted-foreground)', display: 'block' }}>
              Departamento
            </span>
            <strong style={{ fontSize: '0.92rem', color: 'var(--foreground)' }}>
              {perfil.departamento}
            </strong>
          </div>

          {/* Fecha de Ingreso */}
          <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.73rem', color: 'var(--muted-foreground)', display: 'block' }}>
              Fecha de Contratación
            </span>
            <strong style={{ fontSize: '0.92rem', color: 'var(--foreground)' }}>
              {perfil.fecha_ingreso || 'No registrada'}
            </strong>
          </div>

          {/* Antigüedad */}
          <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.73rem', color: 'var(--muted-foreground)', display: 'block' }}>
              Antigüedad Calculada
            </span>
            <strong style={{ fontSize: '0.92rem', color: 'var(--primary)' }}>
              {perfil.antiguedad_anios ?? 1} {Number(perfil.antiguedad_anios) === 1 ? 'año' : 'años'}
            </strong>
          </div>

          {/* Salario Mensual */}
          <div style={{ background: 'var(--card)', padding: '0.75rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.73rem', color: 'var(--muted-foreground)', display: 'block' }}>
              Salario Mensual Bruto
            </span>
            <strong style={{ fontSize: '0.92rem', color: 'var(--foreground)' }}>
              {formattedSalary}
            </strong>
          </div>
        </div>

        {/* Resumen de Prestación de Vacaciones */}
        <div style={{ background: 'var(--muted)', padding: '0.85rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--foreground)' }}>
              Estatus del Beneficio Vacacional
            </span>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>
              {perfil.dias_vacaciones_disponibles} días disponibles
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
            <div style={{ background: 'var(--card)', padding: '0.45rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block' }}>Asignados</span>
              <strong style={{ fontSize: '0.9rem' }}>{perfil.dias_vacaciones_totales}</strong>
            </div>
            <div style={{ background: 'var(--card)', padding: '0.45rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block' }}>Disfrutados</span>
              <strong style={{ fontSize: '0.9rem' }}>{perfil.dias_vacaciones_tomados}</strong>
            </div>
            <div style={{ background: 'var(--accent)', color: 'var(--accent-foreground)', padding: '0.45rem', borderRadius: 'calc(var(--radius) - 2px)' }}>
              <span style={{ fontSize: '0.7rem', display: 'block' }}>Disponibles</span>
              <strong style={{ fontSize: '0.9rem' }}>{perfil.dias_vacaciones_disponibles}</strong>
            </div>
          </div>
        </div>

        {/* Botón de cierre */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.88rem' }}
          >
            Cerrar Expediente
          </button>
        </div>
      </div>
    </div>
  )
}
