import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar, Clock, Briefcase, Plus, CheckCircle2, Circle,
  Trash2, ChevronLeft, ChevronRight, CalendarDays, Check,
  FileText, AlertCircle, Filter, Building, Sun, Tag
} from 'lucide-react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000/api'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function CalendarioLaboral({ perfil, vacaciones, onRefreshData }) {
  const hoy = new Date()
  const [fechaActual, setFechaActual] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  )

  const [tareas, setTareas] = useState([])
  const [cargandoTareas, setCargandoTareas] = useState(false)
  const [filtroEstadoTareas, setFiltroEstadoTareas] = useState('TODAS') // 'TODAS' | 'PENDIENTES' | 'COMPLETADAS'

  // Modal / Formulario para agregar tarea o nota
  const [modalNuevaTarea, setModalNuevaTarea] = useState(false)
  const [guardandoTarea, setGuardandoTarea] = useState(false)
  const [formTarea, setFormTarea] = useState({
    titulo: '',
    descripcion: '',
    hora: '10:00',
    tipo: 'TAREA', // 'TAREA' | 'NOTA' | 'RECORDATORIO'
    color: 'blue'
  })

  // Cargar notas y tareas del mes actual
  const cargarTareas = async () => {
    try {
      setCargandoTareas(true)
      const anio = fechaActual.getFullYear()
      const mes = fechaActual.getMonth() + 1
      const res = await axios.get(`${API_BASE}/hr/calendario/?anio=${anio}&mes=${mes}`)
      setTareas(res.data)
    } catch (err) {
      console.error('Error al cargar notas y tareas del calendario:', err)
    } finally {
      setCargandoTareas(false)
    }
  }

  useEffect(() => {
    cargarTareas()
  }, [fechaActual])

  // Navegación de mes
  const mesAnterior = () => {
    setFechaActual(new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1, 1))
  }

  const mesSiguiente = () => {
    setFechaActual(new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 1))
  }

  const irAHoy = () => {
    const ahora = new Date()
    setFechaActual(new Date(ahora.getFullYear(), ahora.getMonth(), 1))
    setFechaSeleccionada(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()))
  }

  // Generación de días para la cuadrícula del mes
  const diasCuadricula = useMemo(() => {
    const anio = fechaActual.getFullYear()
    const mes = fechaActual.getMonth()

    const primerDiaMes = new Date(anio, mes, 1)
    const ultimoDiaMes = new Date(anio, mes + 1, 0)

    // Ajustar para que la semana empiece en Lunes (0 = Lunes, 6 = Domingo)
    let diaInicioSemana = primerDiaMes.getDay() - 1
    if (diaInicioSemana === -1) diaInicioSemana = 6

    const totalDiasMes = ultimoDiaMes.getDate()

    const dias = []

    // Días del mes anterior para rellenar
    const ultimoDiaMesAnterior = new Date(anio, mes, 0).getDate()
    for (let i = diaInicioSemana - 1; i >= 0; i--) {
      dias.push({
        fecha: new Date(anio, mes - 1, ultimoDiaMesAnterior - i),
        esMesActual: false
      })
    }

    // Días del mes actual
    for (let d = 1; d <= totalDiasMes; d++) {
      dias.push({
        fecha: new Date(anio, mes, d),
        esMesActual: true
      })
    }

    // Días del mes siguiente para completar cuadrícula (hasta 42 celdas o múltiplo de 7)
    const resto = 42 - dias.length
    for (let j = 1; j <= resto; j++) {
      dias.push({
        fecha: new Date(anio, mes + 1, j),
        esMesActual: false
      })
    }

    return dias
  }, [fechaActual])

  // Formateador de fechas YYYY-MM-DD
  const formatYMD = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dia = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dia}`
  }

  const strFechaSeleccionada = formatYMD(fechaSeleccionada)
  const strHoy = formatYMD(hoy)

  // Mapa de vacaciones aprobadas/registradas
  const vacacionesMap = useMemo(() => {
    const map = new Map()
    if (!vacaciones?.solicitudes) return map

    vacaciones.solicitudes.forEach((sol) => {
      const inicio = new Date(sol.fecha_inicio + 'T00:00:00')
      const fin = new Date(sol.fecha_fin + 'T00:00:00')

      for (let cur = new Date(inicio); cur <= fin; cur.setDate(cur.getDate() + 1)) {
        const key = formatYMD(cur)
        map.set(key, sol)
      }
    })
    return map
  }, [vacaciones])

  // Tareas filtradas por día seleccionado
  const tareasDelDia = useMemo(() => {
    return tareas.filter((t) => t.fecha === strFechaSeleccionada)
  }, [tareas, strFechaSeleccionada])

  const tareasDelDiaFiltradas = useMemo(() => {
    if (filtroEstadoTareas === 'PENDIENTES') return tareasDelDia.filter(t => !t.completada)
    if (filtroEstadoTareas === 'COMPLETADAS') return tareasDelDia.filter(t => t.completada)
    return tareasDelDia
  }, [tareasDelDia, filtroEstadoTareas])

  // Manejo de crear nueva tarea
  const handleCrearTarea = async (e) => {
    e.preventDefault()
    if (!formTarea.titulo.trim()) return

    try {
      setGuardandoTarea(true)
      const res = await axios.post(`${API_BASE}/hr/calendario/`, {
        titulo: formTarea.titulo.trim(),
        descripcion: formTarea.descripcion.trim(),
        fecha: strFechaSeleccionada,
        hora: formTarea.hora,
        tipo: formTarea.tipo,
        color: formTarea.color
      })

      setTareas(prev => [...prev, res.data])
      setFormTarea({
        titulo: '',
        descripcion: '',
        hora: '10:00',
        tipo: 'TAREA',
        color: 'blue'
      })
      setModalNuevaTarea(false)
    } catch (err) {
      console.error('Error al crear tarea en calendario:', err)
      alert('Error al registrar la nota/tarea.')
    } finally {
      setGuardandoTarea(false)
    }
  }

  // Alternar estado completada
  const handleToggleCompletada = async (tarea) => {
    try {
      const res = await axios.patch(`${API_BASE}/hr/calendario/${tarea.id}/`, {
        completada: !tarea.completada
      })
      setTareas(prev => prev.map(t => t.id === tarea.id ? res.data : t))
    } catch (err) {
      console.error('Error al actualizar tarea:', err)
    }
  }

  // Eliminar tarea
  const handleEliminarTarea = async (id) => {
    if (!window.confirm('¿Deseas eliminar esta tarea o nota del calendario?')) return
    try {
      await axios.delete(`${API_BASE}/hr/calendario/${id}/`)
      setTareas(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.error('Error al eliminar tarea:', err)
    }
  }

  const getColorTheme = (color) => {
    switch (color) {
      case 'green':
        return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0', dot: '#22c55e' }
      case 'amber':
        return { bg: '#fef3c7', text: '#b45309', border: '#fde68a', dot: '#f59e0b' }
      case 'purple':
        return { bg: '#f3e8ff', text: '#7e22ce', border: '#e9d5ff', dot: '#a855f7' }
      case 'rose':
        return { bg: '#ffe4e6', text: '#be123c', border: '#fecdd3', dot: '#f43f5e' }
      case 'blue':
      default:
        return { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' }
    }
  }

  // Comprobar si un día es laboral para el colaborador
  const esDiaLaboral = (fecha) => {
    const diaNum = fecha.getDay()
    // Lunes a Viernes: 1 a 5
    return diaNum >= 1 && diaNum <= 5
  }

  const vacacionDiaSeleccionado = vacacionesMap.get(strFechaSeleccionada)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Tarjeta Informativa de Horario Oficial del Colaborador */}
      <div style={{
        background: 'var(--card)',
        padding: '1.25rem 1.5rem',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'var(--primary)',
            color: 'var(--primary-foreground)',
            padding: '0.65rem',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                Horario Oficial de Trabajo
              </h3>
              <span style={{
                fontSize: '0.72rem',
                background: 'var(--muted)',
                color: 'var(--primary)',
                padding: '0.15rem 0.5rem',
                borderRadius: '12px',
                fontWeight: 700
              }}>
                {perfil?.modalidad_trabajo || 'Híbrido'}
              </span>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', margin: '0.2rem 0 0 0' }}>
              Jornada laboral registrada institucionalmente por el área de Recursos Humanos.
            </p>
          </div>
        </div>

        {/* Fichas de Horario */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Turno */}
          <div style={{ background: 'var(--muted)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', fontWeight: 600 }}>
              Turno Laboral
            </span>
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {perfil?.horario_entrada || '09:00'} - {perfil?.horario_salida || '18:00'} hrs
            </span>
          </div>

          {/* Días */}
          <div style={{ background: 'var(--muted)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', fontWeight: 600 }}>
              Días de Asistencia
            </span>
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {perfil?.dias_laborales || 'Lunes a Viernes'}
            </span>
          </div>

          {/* Comida / Descanso */}
          <div style={{ background: 'var(--muted)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', fontWeight: 600 }}>
              Alimentos
            </span>
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--foreground)' }}>
              60 min (14:00 - 15:00)
            </span>
          </div>
        </div>
      </div>

      {/* 2. Área Dividida: Calendario Interactivo a la Izquierda, Panel de Tareas y Notas a la Derecha */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) 380px', gap: '1.25rem', alignItems: 'start' }}>
        {/* Panel del Calendario */}
        <div style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          padding: '1.25rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {/* Cabecera del Calendario: Mes, Año y Controles */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarDays size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                {MESES[fechaActual.getMonth()]} {fechaActual.getFullYear()}
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={irAHoy}
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.3rem 0.65rem' }}
              >
                Hoy
              </button>
              <button
                onClick={mesAnterior}
                className="btn-secondary"
                title="Mes anterior"
                style={{ padding: '0.35rem', display: 'flex', alignItems: 'center' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={mesSiguiente}
                className="btn-secondary"
                title="Mes siguiente"
                style={{ padding: '0.35rem', display: 'flex', alignItems: 'center' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Días de la semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem', textAlign: 'center' }}>
            {DIAS_SEMANA.map((dia, idx) => (
              <div
                key={dia}
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: idx >= 5 ? 'var(--muted-foreground)' : 'var(--foreground)',
                  padding: '0.4rem 0'
                }}
              >
                {dia}
              </div>
            ))}
          </div>

          {/* Celdas del Calendario */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.35rem' }}>
            {diasCuadricula.map((item, index) => {
              const strDia = formatYMD(item.fecha)
              const esHoy = strDia === strHoy
              const esSeleccionado = strDia === strFechaSeleccionada
              const tieneVacacion = vacacionesMap.get(strDia)
              const tareasEsteDia = tareas.filter(t => t.fecha === strDia)
              const laboral = esDiaLaboral(item.fecha)

              return (
                <div
                  key={index}
                  onClick={() => setFechaSeleccionada(item.fecha)}
                  style={{
                    minHeight: '74px',
                    padding: '0.35rem 0.45rem',
                    borderRadius: 'var(--radius)',
                    background: esSeleccionado
                      ? 'var(--primary)'
                      : esHoy
                      ? 'var(--muted)'
                      : item.esMesActual
                      ? 'var(--background)'
                      : 'transparent',
                    color: esSeleccionado
                      ? 'var(--primary-foreground)'
                      : item.esMesActual
                      ? 'var(--foreground)'
                      : 'var(--muted-foreground)',
                    border: esSeleccionado
                      ? '2px solid var(--primary)'
                      : esHoy
                      ? '2px solid var(--primary)'
                      : '1px solid var(--border)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    opacity: item.esMesActual ? 1 : 0.45,
                    transition: 'all 0.15s ease',
                    boxShadow: esSeleccionado ? '0 2px 6px rgba(0,0,0,0.1)' : 'none'
                  }}
                >
                  {/* Encabezado celda: Número de día e indicador laboral */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.82rem',
                      fontWeight: esHoy || esSeleccionado ? 700 : 500,
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      background: esHoy && !esSeleccionado ? 'var(--primary)' : 'transparent',
                      color: esHoy && !esSeleccionado ? 'var(--primary-foreground)' : 'inherit'
                    }}>
                      {item.fecha.getDate()}
                    </span>

                    {item.esMesActual && laboral && (
                      <span
                        title="Día Laboral"
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: esSeleccionado ? 'var(--primary-foreground)' : '#10b981',
                          opacity: 0.8
                        }}
                      />
                    )}
                  </div>

                  {/* Indicadores de Eventos del Día */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.2rem' }}>
                    {/* Badge de Vacaciones */}
                    {tieneVacacion && (
                      <div style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.3rem',
                        borderRadius: '4px',
                        background: esSeleccionado ? 'rgba(255,255,255,0.25)' : '#dcfce7',
                        color: esSeleccionado ? 'var(--primary-foreground)' : '#15803d',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        Vacaciones
                      </div>
                    )}

                    {/* Chips / Puntos de Tareas */}
                    {tareasEsteDia.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', flexWrap: 'wrap' }}>
                        {tareasEsteDia.slice(0, 3).map((t) => {
                          const theme = getColorTheme(t.color)
                          return (
                            <span
                              key={t.id}
                              title={`${t.titulo} (${t.tipo})`}
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: esSeleccionado ? 'var(--primary-foreground)' : theme.dot
                              }}
                            />
                          )
                        })}
                        {tareasEsteDia.length > 3 && (
                          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: esSeleccionado ? 'var(--primary-foreground)' : 'var(--muted-foreground)' }}>
                            +{tareasEsteDia.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Leyenda del Calendario */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--border)',
            fontSize: '0.74rem',
            color: 'var(--muted-foreground)',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              <span>Jornada regular ({perfil?.horario_entrada || '09:00'} - {perfil?.horario_salida || '18:00'})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '4px', background: '#dcfce7', border: '1px solid #bbf7d0' }} />
              <span>Vacaciones autorizadas</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
              <span>Notas o tareas programadas</span>
            </div>
          </div>
        </div>

        {/* Panel Derecho: Detalle del Día y Gestión de Tareas/Notas */}
        <div style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          padding: '1.25rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          minHeight: '520px'
        }}>
          {/* Encabezado del Día Seleccionado */}
          <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)', fontWeight: 700 }}>
                  Expediente de la Fecha
                </span>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)', margin: '0.15rem 0 0 0' }}>
                  {fechaSeleccionada.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </h4>
              </div>

              <button
                onClick={() => setModalNuevaTarea(true)}
                className="btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} />
                <span>Agregar</span>
              </button>
            </div>

            {/* Estado del día (Laboral / Vacaciones / Descanso) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
              {vacacionDiaSeleccionado ? (
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '10px',
                  fontWeight: 700,
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <Sun size={12} />
                  <span>Día de Vacaciones</span>
                </span>
              ) : esDiaLaboral(fechaSeleccionada) ? (
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  background: 'var(--muted)',
                  color: 'var(--foreground)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <Briefcase size={12} style={{ color: 'var(--primary)' }} />
                  <span>Jornada regular: {perfil?.horario_entrada || '09:00'} - {perfil?.horario_salida || '18:00'}</span>
                </span>
              ) : (
                <span style={{
                  fontSize: '0.72rem',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '10px',
                  fontWeight: 600,
                  background: 'var(--muted)',
                  color: 'var(--muted-foreground)'
                }}>
                  Fin de Semana / Descanso
                </span>
              )}

              <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
                {tareasDelDia.length} {tareasDelDia.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
          </div>

          {/* Filtros rápidos de tareas */}
          {tareasDelDia.length > 0 && (
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {[
                { id: 'TODAS', label: `Todas (${tareasDelDia.length})` },
                { id: 'PENDIENTES', label: `Pendientes (${tareasDelDia.filter(t => !t.completada).length})` },
                { id: 'COMPLETADAS', label: `Listas (${tareasDelDia.filter(t => t.completada).length})` }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFiltroEstadoTareas(f.id)}
                  style={{
                    background: filtroEstadoTareas === f.id ? 'var(--primary)' : 'var(--muted)',
                    color: filtroEstadoTareas === f.id ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                    border: 'none',
                    padding: '0.2rem 0.55rem',
                    borderRadius: '8px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Formulario Inline / Modal de Nueva Tarea o Nota */}
          {modalNuevaTarea && (
            <form
              onSubmit={handleCrearTarea}
              style={{
                background: 'var(--muted)',
                padding: '1rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  Nueva Nota o Tarea
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>
                  {strFechaSeleccionada}
                </span>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Título de la nota o tarea..."
                  value={formTarea.titulo}
                  onChange={(e) => setFormTarea({ ...formTarea, titulo: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--input)',
                    color: 'var(--foreground)',
                    fontSize: '0.82rem'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.2rem' }}>
                    Tipo:
                  </label>
                  <select
                    value={formTarea.tipo}
                    onChange={(e) => setFormTarea({ ...formTarea, tipo: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.35rem 0.5rem',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--input)',
                      color: 'var(--foreground)',
                      fontSize: '0.78rem'
                    }}
                  >
                    <option value="TAREA">Tarea</option>
                    <option value="NOTA">Nota</option>
                    <option value="RECORDATORIO">Recordatorio</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.2rem' }}>
                    Hora programada:
                  </label>
                  <input
                    type="time"
                    value={formTarea.hora}
                    onChange={(e) => setFormTarea({ ...formTarea, hora: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.35rem 0.5rem',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--input)',
                      color: 'var(--foreground)',
                      fontSize: '0.78rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <textarea
                  placeholder="Descripción o apuntes adicionales (opcional)..."
                  value={formTarea.descripcion}
                  onChange={(e) => setFormTarea({ ...formTarea, descripcion: e.target.value })}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.45rem 0.65rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--input)',
                    color: 'var(--foreground)',
                    fontSize: '0.8rem',
                    resize: 'none'
                  }}
                />
              </div>

              {/* Selector de Color */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)' }}>Etiqueta:</span>
                {['blue', 'green', 'amber', 'purple', 'rose'].map((c) => {
                  const theme = getColorTheme(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormTarea({ ...formTarea, color: c })}
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: theme.dot,
                        border: formTarea.color === c ? '2px solid var(--foreground)' : 'none',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    />
                  )
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  onClick={() => setModalNuevaTarea(false)}
                  className="btn-secondary"
                  style={{ fontSize: '0.76rem', padding: '0.3rem 0.65rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoTarea}
                  className="btn-primary"
                  style={{ fontSize: '0.76rem', padding: '0.3rem 0.75rem' }}
                >
                  {guardandoTarea ? 'Guardando...' : 'Guardar en Calendario'}
                </button>
              </div>
            </form>
          )}

          {/* Listado de Notas y Tareas del Día */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', flex: 1 }}>
            {cargandoTareas ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                Cargando registros del calendario...
              </div>
            ) : tareasDelDiaFiltradas.length === 0 ? (
              <div style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                color: 'var(--muted-foreground)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <FileText size={28} style={{ opacity: 0.4 }} />
                <p style={{ margin: 0, fontSize: '0.84rem', fontWeight: 600 }}>
                  Sin notas ni tareas para este día
                </p>
                <p style={{ margin: 0, fontSize: '0.76rem' }}>
                  Haz clic en "Agregar" para programar un recordatorio o apunte personal.
                </p>
              </div>
            ) : (
              tareasDelDiaFiltradas.map((tarea) => {
                const theme = getColorTheme(tarea.color)
                return (
                  <div
                    key={tarea.id}
                    style={{
                      background: 'var(--background)',
                      padding: '0.75rem 0.85rem',
                      borderRadius: 'var(--radius)',
                      border: `1px solid ${tarea.completada ? 'var(--border)' : theme.border}`,
                      borderLeft: `4px solid ${theme.dot}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      opacity: tarea.completada ? 0.65 : 1,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', flex: 1 }}>
                        {tarea.tipo === 'TAREA' && (
                          <button
                            onClick={() => handleToggleCompletada(tarea)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: '0.1rem',
                              cursor: 'pointer',
                              color: tarea.completada ? '#16a34a' : 'var(--muted-foreground)',
                              marginTop: '0.1rem'
                            }}
                            title={tarea.completada ? 'Marcar como pendiente' : 'Marcar como completada'}
                          >
                            {tarea.completada ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                          </button>
                        )}

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{
                              fontSize: '0.66rem',
                              fontWeight: 700,
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              background: theme.bg,
                              color: theme.text
                            }}>
                              {tarea.tipo}
                            </span>
                            {tarea.hora && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)' }}>
                                {tarea.hora} hrs
                              </span>
                            )}
                          </div>

                          <h5 style={{
                            fontSize: '0.86rem',
                            fontWeight: 600,
                            color: 'var(--foreground)',
                            margin: '0.2rem 0 0 0',
                            textDecoration: tarea.completada ? 'line-through' : 'none'
                          }}>
                            {tarea.titulo}
                          </h5>
                        </div>
                      </div>

                      <button
                        onClick={() => handleEliminarTarea(tarea.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--muted-foreground)',
                          cursor: 'pointer',
                          padding: '0.2rem',
                          borderRadius: '4px'
                        }}
                        title="Eliminar tarea o nota"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {tarea.descripcion && (
                      <p style={{
                        fontSize: '0.78rem',
                        color: 'var(--muted-foreground)',
                        margin: '0.15rem 0 0 1.7rem',
                        lineHeight: 1.4,
                        whiteSpace: 'pre-line'
                      }}>
                        {tarea.descripcion}
                      </p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
