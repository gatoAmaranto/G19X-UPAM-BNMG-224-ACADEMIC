import React, { useState, useEffect, useMemo } from 'react'
import {
  Calendar, Clock, Briefcase, Plus, CheckCircle2, Circle,
  Trash2, ChevronLeft, ChevronRight, CalendarDays, Check,
  FileText, AlertCircle, Filter, Building, Sun, Tag, User,
  CalendarCheck, Clock3
} from 'lucide-react'
import axios from 'axios'

const API_BASE = '/api'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function CalendarioLaboral({ perfil, vacaciones, onRefreshData, esAdminRH = false }) {
  const hoy = new Date()
  const [fechaActual, setFechaActual] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1))
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  )

  const [tareas, setTareas] = useState([])
  const [cargandoTareas, setCargandoTareas] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('TODAS') // 'TODAS' | 'TAREAS' | 'NOTAS' | 'VACACIONES'

  // Modal / Formulario unificado para agregar tareas, notas o vacaciones
  const [modalNuevo, setModalNuevo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [tipoRegistro, setTipoRegistro] = useState('TAREA') // 'TAREA' | 'NOTA' | 'RECORDATORIO' | 'VACACIONES'

  const [formTarea, setFormTarea] = useState({
    titulo: '',
    descripcion: '',
    hora: '10:00',
    color: 'blue'
  })

  // Formulario de vacaciones
  const [formVacaciones, setFormVacaciones] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    dias_solicitados: 1,
    motivo: '',
    empleado_id: ''
  })

  // Saldo oficial de vacaciones
  const saldoTotales = vacaciones?.saldo?.totales ?? perfil?.dias_vacaciones_totales ?? 0
  const saldoDisfrutados = vacaciones?.saldo?.tomados ?? perfil?.dias_vacaciones_tomados ?? 0
  const saldoRetenidos = vacaciones?.saldo?.retenidos ?? perfil?.dias_vacaciones_retenidos ?? 0
  const saldoDisponibles = vacaciones?.saldo?.disponibles ?? perfil?.dias_vacaciones_disponibles ?? 0

  // Formateador estándar de fechas YYYY-MM-DD
  const formatYMD = (d) => {
    if (!d || !(d instanceof Date) || isNaN(d)) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dia = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dia}`
  }

  const strFechaSeleccionada = formatYMD(fechaSeleccionada)
  const strHoy = formatYMD(hoy)

  // Determinar si una fecha cae en día laboral consultando el horario institucional del colaborador
  const esDiaLaboral = (fecha, diasLaboralesStr = perfil?.dias_laborales) => {
    if (!fecha) return false
    const d = typeof fecha === 'string'
      ? new Date(`${fecha.split('T')[0]}T12:00:00`)
      : new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0)
    if (isNaN(d.getTime())) return false

    const dayOfWeek = d.getDay() // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    const txt = (diasLaboralesStr || perfil?.dias_laborales || 'Lunes a Viernes').toLowerCase()

    if (txt.includes('lunes a sabado') || txt.includes('lunes a sábado') || txt.includes('l-s')) {
      return dayOfWeek >= 1 && dayOfWeek <= 6
    }
    if (txt.includes('lunes a jueves')) {
      return dayOfWeek >= 1 && dayOfWeek <= 4
    }
    if (txt.includes('lunes a domingo')) {
      return true
    }
    // Por defecto estándar: Lunes a Viernes
    return dayOfWeek >= 1 && dayOfWeek <= 5
  }

  // Cálculo de días laborales hábiles solicitados en el rango
  const calcularDiasLaborales = (inicio, fin, diasLaboralesStr = perfil?.dias_laborales) => {
    if (!inicio || !fin) return 0
    const partsI = inicio.split('-').map(Number)
    const partsF = fin.split('-').map(Number)
    if (partsI.length !== 3 || partsF.length !== 3) return 0
    const d1 = new Date(partsI[0], partsI[1] - 1, partsI[2], 12, 0, 0)
    const d2 = new Date(partsF[0], partsF[1] - 1, partsF[2], 12, 0, 0)
    if (d2 < d1) return 0

    let habiles = 0
    for (let cur = new Date(d1); cur <= d2; cur.setDate(cur.getDate() + 1)) {
      if (esDiaLaboral(cur, diasLaboralesStr)) {
        habiles++
      }
    }
    return habiles
  }

  const handleCambioFechaInicioVac = (nuevaFecha) => {
    if (nuevaFecha < strHoy) {
      alert('No es posible seleccionar una fecha anterior al día de hoy para vacaciones.')
      nuevaFecha = strHoy
    }
    const fin = formVacaciones.fecha_fin && formVacaciones.fecha_fin >= nuevaFecha ? formVacaciones.fecha_fin : nuevaFecha
    const dias = calcularDiasLaborales(nuevaFecha, fin)
    setFormVacaciones(prev => ({
      ...prev,
      fecha_inicio: nuevaFecha,
      fecha_fin: fin,
      dias_solicitados: dias
    }))
  }

  const handleCambioFechaFinVac = (nuevaFecha) => {
    if (nuevaFecha < strHoy) {
      alert('No es posible seleccionar una fecha anterior al día de hoy para vacaciones.')
      nuevaFecha = strHoy
    }
    const inicio = formVacaciones.fecha_inicio && formVacaciones.fecha_inicio <= nuevaFecha ? formVacaciones.fecha_inicio : nuevaFecha
    const dias = calcularDiasLaborales(inicio, nuevaFecha)
    setFormVacaciones(prev => ({
      ...prev,
      fecha_inicio: inicio,
      fecha_fin: nuevaFecha,
      dias_solicitados: dias
    }))
  }

  // Al abrir el modal, sincronizar fechas de vacaciones con la fecha seleccionada (restringiendo fechas pasadas)
  useEffect(() => {
    if (modalNuevo && strFechaSeleccionada) {
      const fechaValida = strFechaSeleccionada < strHoy ? strHoy : strFechaSeleccionada
      const dias = calcularDiasLaborales(fechaValida, fechaValida)
      setFormVacaciones(prev => ({
        ...prev,
        fecha_inicio: fechaValida,
        fecha_fin: fechaValida,
        dias_solicitados: dias
      }))
    }
  }, [modalNuevo, strFechaSeleccionada, strHoy])

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

  // Navegación de mes con sincronización inmediata de la fecha seleccionada
  const mesAnterior = () => {
    const nuevoMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() - 1, 1)
    setFechaActual(nuevoMes)
    setFechaSeleccionada(nuevoMes)
  }

  const mesSiguiente = () => {
    const nuevoMes = new Date(fechaActual.getFullYear(), fechaActual.getMonth() + 1, 1)
    setFechaActual(nuevoMes)
    setFechaSeleccionada(nuevoMes)
  }

  const irAHoy = () => {
    const ahora = new Date()
    setFechaActual(new Date(ahora.getFullYear(), ahora.getMonth(), 1))
    setFechaSeleccionada(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()))
  }

  const handleSeleccionarDia = (diaItem) => {
    setFechaSeleccionada(diaItem.fecha)
    if (!diaItem.esMesActual) {
      setFechaActual(new Date(diaItem.fecha.getFullYear(), diaItem.fecha.getMonth(), 1))
    }
  }

  // Generación de días para la cuadrícula del mes (42 celdas iniciando en Lunes)
  const diasCuadricula = useMemo(() => {
    const anio = fechaActual.getFullYear()
    const mes = fechaActual.getMonth()

    const primerDiaMes = new Date(anio, mes, 1)
    const ultimoDiaMes = new Date(anio, mes + 1, 0)

    let diaInicioSemana = primerDiaMes.getDay() - 1
    if (diaInicioSemana === -1) diaInicioSemana = 6

    const totalDiasMes = ultimoDiaMes.getDate()
    const dias = []

    // Relleno de días del mes anterior
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

    // Días del mes siguiente para completar la cuadrícula de 42 celdas
    const resto = 42 - dias.length
    for (let j = 1; j <= resto; j++) {
      dias.push({
        fecha: new Date(anio, mes + 1, j),
        esMesActual: false
      })
    }

    return dias
  }, [fechaActual])

  // Lista de empleados disponibles para selección en modo RH
  const listaEmpleados = useMemo(() => {
    if (!esAdminRH) return []
    const items = Array.isArray(vacaciones) ? vacaciones : (vacaciones?.solicitudes || [])
    const empMap = new Map()
    items.forEach(sol => {
      if (sol.empleado && sol.empleado_nombre && !sol.empleado_nombre.startsWith('auth0|')) {
        if (!empMap.has(sol.empleado)) {
          empMap.set(sol.empleado, { id: sol.empleado, nombre: sol.empleado_nombre })
        }
      }
    })
    return Array.from(empMap.values())
  }, [vacaciones, esAdminRH])

  // Limpieza de nombres para badges
  const getNombreCorto = (nombre) => {
    if (!nombre) return 'Colaborador'
    if (nombre.startsWith('auth0|')) return 'Colaborador'
    return nombre.split(' ')[0]
  }

  // Mapa de vacaciones registradas por fecha (evita desplazamientos por zona horaria)
  const vacacionesMap = useMemo(() => {
    const map = new Map()
    const lista = Array.isArray(vacaciones)
      ? vacaciones
      : (vacaciones?.solicitudes || [])

    if (!lista || lista.length === 0) return map

    lista.forEach((sol) => {
      if (!sol.fecha_inicio || !sol.fecha_fin) return
      if (sol.estado && sol.estado === 'RECHAZADO') return

      const cleanInicio = sol.fecha_inicio.split('T')[0]
      const cleanFin = sol.fecha_fin.split('T')[0]

      const partsI = cleanInicio.split('-').map(Number)
      const partsF = cleanFin.split('-').map(Number)
      if (partsI.length !== 3 || partsF.length !== 3) return

      const start = new Date(partsI[0], partsI[1] - 1, partsI[2], 12, 0, 0)
      const end = new Date(partsF[0], partsF[1] - 1, partsF[2], 12, 0, 0)
      const jornada = sol.empleado_dias_laborales || perfil?.dias_laborales || 'Lunes a Viernes'

      for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
        // Solo marcar en el calendario si es un día laboral para el colaborador
        if (!esDiaLaboral(cur, jornada)) {
          continue
        }

        const key = formatYMD(cur)
        if (!map.has(key)) {
          map.set(key, [])
        }
        map.get(key).push(sol)
      }
    })
    return map
  }, [vacaciones, perfil])

  // Registros de vacaciones y tareas para el día seleccionado
  const vacacionesDelDia = vacacionesMap.get(strFechaSeleccionada) || []

  const tareasDelDia = useMemo(() => {
    return tareas.filter((t) => t.fecha === strFechaSeleccionada)
  }, [tareas, strFechaSeleccionada])

  // Filtrado reactivo en el panel lateral
  const itemsFiltrados = useMemo(() => {
    const res = []

    if (filtroTipo === 'VACACIONES') {
      const lista = vacacionesDelDia.length > 0
        ? vacacionesDelDia
        : (Array.isArray(vacaciones) ? vacaciones : (vacaciones?.solicitudes || []))

      lista.forEach(v => {
        res.push({
          id: `vac-${v.id}-${v.fecha_inicio}`,
          tipoRegistro: 'VACACIONES',
          data: v
        })
      })
      return res
    }

    if (filtroTipo === 'TODAS') {
      vacacionesDelDia.forEach(v => {
        res.push({
          id: `vac-${v.id}-${v.fecha_inicio}`,
          tipoRegistro: 'VACACIONES',
          data: v
        })
      })
      tareasDelDia.forEach(t => {
        res.push({ id: `tarea-${t.id}`, tipoRegistro: 'ACTIVIDAD', data: t })
      })
    } else if (filtroTipo === 'TAREAS') {
      tareasDelDia.filter(t => t.tipo === 'TAREA').forEach(t => {
        res.push({ id: `tarea-${t.id}`, tipoRegistro: 'ACTIVIDAD', data: t })
      })
    } else if (filtroTipo === 'NOTAS') {
      tareasDelDia.filter(t => t.tipo !== 'TAREA').forEach(t => {
        res.push({ id: `tarea-${t.id}`, tipoRegistro: 'ACTIVIDAD', data: t })
      })
    }

    return res
  }, [vacacionesDelDia, tareasDelDia, filtroTipo, vacaciones])

  // Crear Tarea, Nota o Recordatorio
  const handleCrearTarea = async (e) => {
    e.preventDefault()
    if (!formTarea.titulo.trim()) return

    try {
      setGuardando(true)
      const res = await axios.post(`${API_BASE}/hr/calendario/`, {
        titulo: formTarea.titulo.trim(),
        descripcion: formTarea.descripcion.trim(),
        fecha: strFechaSeleccionada,
        hora: formTarea.hora,
        tipo: tipoRegistro,
        color: formTarea.color
      })

      setTareas(prev => [...prev, res.data])
      setFormTarea({
        titulo: '',
        descripcion: '',
        hora: '10:00',
        color: 'blue'
      })
      setModalNuevo(false)
      if (onRefreshData) onRefreshData()
    } catch (err) {
      console.error('Error al registrar actividad en calendario:', err)
      alert('Error al registrar la actividad en el calendario.')
    } finally {
      setGuardando(false)
    }
  }

  // Registrar Vacaciones directamente desde el calendario
  const handleCrearVacaciones = async (e) => {
    e.preventDefault()
    if (!formVacaciones.fecha_inicio || !formVacaciones.fecha_fin) {
      alert('Por favor selecciona las fechas de inicio y fin.')
      return
    }

    if (formVacaciones.fecha_inicio < strHoy) {
      alert('No es posible solicitar vacaciones para fechas anteriores al día de hoy.')
      return
    }

    if (formVacaciones.fecha_fin < formVacaciones.fecha_inicio) {
      alert('La fecha de fin debe ser posterior o igual a la fecha de inicio.')
      return
    }

    const jornada = perfil?.dias_laborales || 'Lunes a Viernes'

    if (!esDiaLaboral(formVacaciones.fecha_inicio, jornada)) {
      alert(`La fecha de inicio (${formVacaciones.fecha_inicio}) no es un día laboral según tu jornada (${jornada}). Las vacaciones solo pueden iniciar en días laborales de trabajo.`)
      return
    }

    if (!esDiaLaboral(formVacaciones.fecha_fin, jornada)) {
      alert(`La fecha de fin (${formVacaciones.fecha_fin}) no es un día laboral según tu jornada (${jornada}). Las vacaciones solo pueden finalizar en días laborales de trabajo.`)
      return
    }

    const diasCalculados = calcularDiasLaborales(formVacaciones.fecha_inicio, formVacaciones.fecha_fin, jornada)
    if (diasCalculados <= 0) {
      alert(`El periodo seleccionado no comprende ningún día laboral según tu jornada (${jornada}).`)
      return
    }

    // Validar que las fechas no se solapen con una solicitud en espera o aprobada
    const listaExistente = Array.isArray(vacaciones) ? vacaciones : (vacaciones?.solicitudes || [])
    const solapada = listaExistente.find(v => {
      if (v.estado === 'RECHAZADO') return false
      if (esAdminRH && formVacaciones.empleado_id && v.empleado && v.empleado !== formVacaciones.empleado_id) return false
      return v.fecha_inicio <= formVacaciones.fecha_fin && v.fecha_fin >= formVacaciones.fecha_inicio
    })
    if (solapada) {
      const estadoTxt = solapada.estado === 'PENDIENTE' ? 'en espera de aprobación' : 'ya aprobada'
      alert(`Ya cuentas con una solicitud ${estadoTxt} que coincide con las fechas seleccionadas (${solapada.fecha_inicio} al ${solapada.fecha_fin}). No es posible solicitar periodos con fechas ya en espera o aprobadas.`)
      return
    }

    if (!esAdminRH && diasCalculados > saldoDisponibles) {
      const txtRetenidos = saldoRetenidos > 0 ? ` (${saldoRetenidos} día(s) retenidos en solicitudes pendientes)` : ''
      alert(`No cuentas con saldo suficiente de vacaciones. Tu saldo disponible para solicitar es de ${saldoDisponibles} día(s)${txtRetenidos} y el periodo seleccionado requiere ${diasCalculados} día(s) laboral(es).`)
      return
    }

    try {
      setGuardando(true)
      const endpoint = esAdminRH
        ? `${API_BASE}/hr/admin/vacaciones/`
        : `${API_BASE}/hr/vacaciones/`

      const payload = {
        fecha_inicio: formVacaciones.fecha_inicio,
        fecha_fin: formVacaciones.fecha_fin,
        dias_solicitados: diasCalculados,
        motivo: formVacaciones.motivo || 'Registro mediante calendario institucional'
      }

      if (esAdminRH) {
        payload.estado = 'APROBADO'
        if (formVacaciones.empleado_id) {
          payload.empleado_id = formVacaciones.empleado_id
        }
      }

      await axios.post(endpoint, payload)
      if (onRefreshData) await onRefreshData()
      setModalNuevo(false)
    } catch (err) {
      console.error('Error al registrar periodo vacacional:', err)
      const msg = err.response?.data?.error || 'Error al registrar el periodo de vacaciones.'
      alert(msg)
    } finally {
      setGuardando(false)
    }
  }

  // Alternar estado de completada
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

  // Eliminar tarea o nota
  const handleEliminarTarea = async (id) => {
    if (!window.confirm('¿Deseas eliminar este registro del calendario?')) return
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Tarjeta Informativa de Horario Oficial de Trabajo */}
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
                {esAdminRH ? 'Calendario Institucional y Horarios RH' : 'Horario Oficial de Trabajo'}
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
              {esAdminRH
                ? 'Monitoreo global de jornadas, ausencias autorizadas y actividades laborales institucionalizadas.'
                : 'Jornada laboral registrada institucionalmente por el área de Recursos Humanos.'}
            </p>
          </div>
        </div>

        {/* Fichas de Horario */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ background: 'var(--muted)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', fontWeight: 600 }}>
              Turno Laboral
            </span>
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {perfil?.horario_entrada || '09:00'} - {perfil?.horario_salida || '18:00'} hrs
            </span>
          </div>

          <div style={{ background: 'var(--muted)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', fontWeight: 600 }}>
              Días de Asistencia
            </span>
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--foreground)' }}>
              {perfil?.dias_laborales || 'Lunes a Viernes'}
            </span>
          </div>

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

      {/* 1.1 Tarjeta Informativa de Saldo de Vacaciones (Colaborador) */}
      {!esAdminRH && (
        <div style={{
          background: 'var(--card)',
          padding: '1.15rem 1.5rem',
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
              background: '#dcfce7',
              color: '#15803d',
              padding: '0.65rem',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #bbf7d0'
            }}>
              <Sun size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                  Saldo de Vacaciones
                </h3>
                <span style={{
                  fontSize: '0.72rem',
                  background: '#dcfce7',
                  color: '#15803d',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '12px',
                  fontWeight: 700,
                  border: '1px solid #bbf7d0'
                }}>
                  {saldoDisponibles} disponibles
                </span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', margin: '0.2rem 0 0 0' }}>
                Días anuales de descanso remunerado conforme a tu antigüedad y registro laboral.
              </p>
            </div>
          </div>

          {/* Fichas de Saldo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--muted)', padding: '0.45rem 0.95rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center', minWidth: '95px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', fontWeight: 600 }}>
                Días Totales
              </span>
              <strong style={{ fontSize: '1.15rem', color: 'var(--foreground)' }}>{saldoTotales}</strong>
            </div>

            <div style={{ background: 'var(--muted)', padding: '0.45rem 0.95rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', textAlign: 'center', minWidth: '95px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', fontWeight: 600 }}>
                Días Disfrutados
              </span>
              <strong style={{ fontSize: '1.15rem', color: 'var(--foreground)' }}>{saldoDisfrutados}</strong>
            </div>

            {saldoRetenidos > 0 && (
              <div style={{ background: '#fef3c7', color: '#b45309', padding: '0.45rem 0.95rem', borderRadius: 'var(--radius)', border: '1px solid #fde68a', textAlign: 'center', minWidth: '95px' }}>
                <span style={{ fontSize: '0.7rem', display: 'block', fontWeight: 700, color: '#92400e' }}>
                  Días Retenidos
                </span>
                <strong style={{ fontSize: '1.15rem', color: '#b45309' }}>{saldoRetenidos}</strong>
              </div>
            )}

            <div style={{ background: '#dcfce7', color: '#15803d', padding: '0.45rem 1.05rem', borderRadius: 'var(--radius)', border: '1px solid #bbf7d0', textAlign: 'center', minWidth: '100px' }}>
              <span style={{ fontSize: '0.7rem', display: 'block', fontWeight: 700, color: '#166534' }}>
                Días Disponibles
              </span>
              <strong style={{ fontSize: '1.2rem', color: '#15803d' }}>{saldoDisponibles}</strong>
            </div>
          </div>
        </div>
      )}

      {/* 2. Área Dividida: Calendario Interactivo a la Izquierda, Panel Detallado a la Derecha */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '1.25rem', alignItems: 'stretch' }}>
        {/* Panel del Calendario */}
        <div style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          padding: '1.5rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {/* Cabecera del Calendario: Mes, Año y Controles */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarDays size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
                {MESES[fechaActual.getMonth()]} {fechaActual.getFullYear()}
              </h3>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={irAHoy}
                className="btn-secondary"
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.45rem', textAlign: 'center' }}>
            {DIAS_SEMANA.map((dia, idx) => (
              <div
                key={dia}
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: idx >= 5 ? 'var(--muted-foreground)' : 'var(--foreground)',
                  padding: '0.45rem 0'
                }}
              >
                {dia}
              </div>
            ))}
          </div>

          {/* Celdas del Calendario */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.45rem' }}>
            {diasCuadricula.map((item, index) => {
              const strDia = formatYMD(item.fecha)
              const esHoy = strDia === strHoy
              const esSeleccionado = strDia === strFechaSeleccionada
              const vacacionesEsteDia = vacacionesMap.get(strDia) || []
              const tareasEsteDia = tareas.filter(t => t.fecha === strDia)
              const laboral = esDiaLaboral(item.fecha)

              const vacMostradas = Math.min(2, vacacionesEsteDia.length)
              const maxTareas = Math.max(1, 3 - vacMostradas)
              const tareasMostradas = tareasEsteDia.slice(0, maxTareas)
              const totalOcultos = (vacacionesEsteDia.length + tareasEsteDia.length) - (vacMostradas + tareasMostradas.length)

              return (
                <div
                  key={index}
                  onClick={() => handleSeleccionarDia(item)}
                  style={{
                    minHeight: '115px',
                    padding: '0.45rem 0.5rem',
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
                    boxShadow: esSeleccionado ? '0 2px 6px rgba(0,0,0,0.1)' : 'none',
                    overflow: 'hidden'
                  }}
                >
                  {/* Encabezado celda: Número de día e indicador laboral */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.84rem',
                      fontWeight: esHoy || esSeleccionado ? 700 : 500,
                      width: '24px',
                      height: '24px',
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
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: esSeleccionado ? 'var(--primary-foreground)' : '#10b981',
                          opacity: 0.85
                        }}
                      />
                    )}
                  </div>

                  {/* Indicadores de Eventos del Día */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.22rem', marginTop: '0.35rem', flex: 1 }}>
                    {/* Badge de Vacaciones legible */}
                    {vacacionesEsteDia.slice(0, 2).map((v, vIdx) => {
                      const esPendiente = v.estado === 'PENDIENTE'
                      const nombre = v.empleado_nombre && !v.empleado_nombre.startsWith('auth0|')
                        ? getNombreCorto(v.empleado_nombre)
                        : 'Vacaciones'

                      return (
                        <div
                          key={`vac-pill-${vIdx}`}
                          title={`Vacaciones: ${v.empleado_nombre || 'Colaborador'} (${v.estado})`}
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            background: esSeleccionado
                              ? 'rgba(255,255,255,0.25)'
                              : esPendiente ? '#fef3c7' : '#dcfce7',
                            color: esSeleccionado
                              ? 'var(--primary-foreground)'
                              : esPendiente ? '#b45309' : '#15803d',
                            border: esSeleccionado
                              ? '1px solid rgba(255,255,255,0.3)'
                              : esPendiente ? '1px solid #fde68a' : '1px solid #bbf7d0',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <Sun size={10} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {nombre} {esPendiente ? '(Pend)' : '(Vac)'}
                          </span>
                        </div>
                      )
                    })}

                    {/* Chips legibles de Tareas y Notas */}
                    {tareasMostradas.map((t) => {
                      const theme = getColorTheme(t.color)
                      return (
                        <div
                          key={t.id}
                          title={`${t.tipo}: ${t.titulo}`}
                          style={{
                            fontSize: '0.66rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            background: esSeleccionado ? 'rgba(255,255,255,0.2)' : theme.bg,
                            color: esSeleccionado ? 'var(--primary-foreground)' : theme.text,
                            border: esSeleccionado ? '1px solid rgba(255,255,255,0.25)' : `1px solid ${theme.border}`,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <span style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            background: esSeleccionado ? 'var(--primary-foreground)' : theme.dot,
                            flexShrink: 0
                          }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: t.completada ? 'line-through' : 'none' }}>
                            {t.hora ? `${t.hora} ` : ''}{t.titulo}
                          </span>
                        </div>
                      )
                    })}

                    {totalOcultos > 0 && (
                      <span style={{
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        color: esSeleccionado ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                        paddingLeft: '0.2rem',
                        marginTop: 'auto'
                      }}>
                        +{totalOcultos} más
                      </span>
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
              <span style={{ width: '8px', height: '8px', borderRadius: '4px', background: '#fef3c7', border: '1px solid #fde68a' }} />
              <span>Vacaciones pendientes</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
              <span>Tareas / Notas programadas</span>
            </div>
          </div>
        </div>

        {/* Panel Derecho: Detalle del Día y Gestión de Actividades y Vacaciones */}
        <div style={{
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          padding: '1.5rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          minHeight: '100%'
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
                onClick={() => setModalNuevo(true)}
                className="btn-primary"
                style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Plus size={14} />
                <span>Agregar</span>
              </button>
            </div>

            {/* Estado del día (Laboral / Vacaciones / Descanso) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.65rem', flexWrap: 'wrap' }}>
              {vacacionesDelDia.length > 0 ? (
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
                  <span>Día con Vacaciones ({vacacionesDelDia.length} registro{vacacionesDelDia.length > 1 ? 's' : ''})</span>
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
                {itemsFiltrados.length} {itemsFiltrados.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
          </div>

          {/* Filtros rápidos */}
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {[
              { id: 'TODAS', label: `Todos (${vacacionesDelDia.length + tareasDelDia.length})` },
              { id: 'TAREAS', label: `Tareas (${tareasDelDia.filter(t => t.tipo === 'TAREA').length})` },
              { id: 'NOTAS', label: `Notas (${tareasDelDia.filter(t => t.tipo !== 'TAREA').length})` },
              { id: 'VACACIONES', label: `Vacaciones (${vacacionesDelDia.length > 0 ? vacacionesDelDia.length : (Array.isArray(vacaciones) ? vacaciones.length : (vacaciones?.solicitudes?.length || 0))})` }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltroTipo(f.id)}
                style={{
                  background: filtroTipo === f.id ? 'var(--primary)' : 'var(--muted)',
                  color: filtroTipo === f.id ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
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

          {/* Formulario / Modal para Crear Tarea, Nota o Vacaciones */}
          {modalNuevo && (
            <div style={{
              background: 'var(--muted)',
              padding: '1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--foreground)' }}>
                  Registrar en Calendario ({strFechaSeleccionada})
                </span>
                <button
                  type="button"
                  onClick={() => setModalNuevo(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Cerrar
                </button>
              </div>

              {/* Selector de Tipo de Registro */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem' }}>
                {[
                  { id: 'TAREA', label: 'Tarea' },
                  { id: 'NOTA', label: 'Nota' },
                  { id: 'RECORDATORIO', label: 'Alerta' },
                  { id: 'VACACIONES', label: 'Vacaciones' }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTipoRegistro(item.id)
                      if (item.id === 'VACACIONES') {
                        const inicio = (!formVacaciones.fecha_inicio || formVacaciones.fecha_inicio < strHoy)
                          ? strHoy
                          : formVacaciones.fecha_inicio
                        const fin = (!formVacaciones.fecha_fin || formVacaciones.fecha_fin < inicio)
                          ? inicio
                          : formVacaciones.fecha_fin
                        const dias = calcularDiasLaborales(inicio, fin)
                        setFormVacaciones(prev => ({
                          ...prev,
                          fecha_inicio: inicio,
                          fecha_fin: fin,
                          dias_solicitados: dias
                        }))
                      }
                    }}
                    style={{
                      padding: '0.3rem 0.2rem',
                      fontSize: '0.72rem',
                      fontWeight: tipoRegistro === item.id ? 700 : 500,
                      borderRadius: '6px',
                      border: tipoRegistro === item.id ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: tipoRegistro === item.id ? 'var(--primary)' : 'var(--background)',
                      color: tipoRegistro === item.id ? 'var(--primary-foreground)' : 'var(--foreground)',
                      cursor: 'pointer'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Formulario específico según el tipo seleccionado */}
              {tipoRegistro === 'VACACIONES' ? (
                <form onSubmit={handleCrearVacaciones} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>

                  {esAdminRH && listaEmpleados.length > 0 && (
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.2rem' }}>
                        Colaborador asignado:
                      </label>
                      <select
                        value={formVacaciones.empleado_id}
                        onChange={(e) => setFormVacaciones({ ...formVacaciones, empleado_id: e.target.value })}
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
                        <option value="">Colaborador actual / General</option>
                        {listaEmpleados.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.2rem' }}>
                        Fecha de inicio:
                      </label>
                      <input
                        type="date"
                        min={strHoy}
                        value={formVacaciones.fecha_inicio}
                        onChange={(e) => handleCambioFechaInicioVac(e.target.value)}
                        required
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
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.2rem' }}>
                        Fecha de fin:
                      </label>
                      <input
                        type="date"
                        min={formVacaciones.fecha_inicio || strHoy}
                        value={formVacaciones.fecha_fin}
                        onChange={(e) => handleCambioFechaFinVac(e.target.value)}
                        required
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
                    <label style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.2rem' }}>
                      Días laborales efectivos a descontar:
                    </label>
                    <div style={{
                      width: '100%',
                      padding: '0.45rem 0.65rem',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--input)',
                      color: 'var(--foreground)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span>{formVacaciones.dias_solicitados} día(s) laboral(es)</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', fontWeight: 400 }}>
                        Jornada: {perfil?.dias_laborales || 'Lunes a Viernes'}
                      </span>
                    </div>
                    {!esDiaLaboral(formVacaciones.fecha_inicio) && formVacaciones.fecha_inicio && (
                      <span style={{ fontSize: '0.68rem', color: '#b91c1c', marginTop: '0.25rem', display: 'block' }}>
                        La fecha de inicio ({formVacaciones.fecha_inicio}) es fin de semana / descanso. Solo se admiten días laborales.
                      </span>
                    )}
                    {!esDiaLaboral(formVacaciones.fecha_fin) && formVacaciones.fecha_fin && (
                      <span style={{ fontSize: '0.68rem', color: '#b91c1c', marginTop: '0.25rem', display: 'block' }}>
                        La fecha de fin ({formVacaciones.fecha_fin}) es fin de semana / descanso. Solo se admiten días laborales.
                      </span>
                    )}
                    {!esAdminRH && Number(formVacaciones.dias_solicitados) > saldoDisponibles && (
                      <span style={{ fontSize: '0.68rem', color: '#b91c1c', marginTop: '0.25rem', display: 'block' }}>
                        Atención: Los días laborales requeridos ({formVacaciones.dias_solicitados}) superan tus días disponibles ({saldoDisponibles}).
                      </span>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Motivo o justificación del periodo..."
                      value={formVacaciones.motivo}
                      onChange={(e) => setFormVacaciones({ ...formVacaciones, motivo: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.45rem 0.65rem',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--border)',
                        background: 'var(--input)',
                        color: 'var(--foreground)',
                        fontSize: '0.8rem'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setModalNuevo(false)}
                      className="btn-secondary"
                      style={{ fontSize: '0.76rem', padding: '0.3rem 0.65rem' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardando}
                      className="btn-primary"
                      style={{ fontSize: '0.76rem', padding: '0.3rem 0.75rem' }}
                    >
                      {guardando ? 'Guardando...' : esAdminRH ? 'Autorizar Vacaciones' : 'Solicitar Vacaciones'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleCrearTarea} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div>
                    <input
                      type="text"
                      placeholder="Título de la actividad..."
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

                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', display: 'block', marginBottom: '0.2rem' }}>
                        Etiqueta de color:
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', height: '32px' }}>
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

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => setModalNuevo(false)}
                      className="btn-secondary"
                      style={{ fontSize: '0.76rem', padding: '0.3rem 0.65rem' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardando}
                      className="btn-primary"
                      style={{ fontSize: '0.76rem', padding: '0.3rem 0.75rem' }}
                    >
                      {guardando ? 'Guardando...' : 'Guardar en Calendario'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Listado Unificado y Reactivo de Eventos del Día */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', flex: 1 }}>
            {cargandoTareas ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                Cargando registros del calendario...
              </div>
            ) : itemsFiltrados.length === 0 ? (
              <div style={{
                padding: '2.5rem 1rem',
                textAlign: 'center',
                color: 'var(--muted-foreground)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <FileText size={32} style={{ opacity: 0.35 }} />
                <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600 }}>
                  Sin notas, tareas ni vacaciones para este día
                </p>
                <p style={{ margin: 0, fontSize: '0.76rem' }}>
                  Haz clic en "Agregar" para programar una actividad o periodo vacacional.
                </p>
              </div>
            ) : (
              <>
                {filtroTipo === 'VACACIONES' && vacacionesDelDia.length === 0 && (
                  <div style={{
                    fontSize: '0.72rem',
                    color: 'var(--muted-foreground)',
                    background: 'var(--muted)',
                    padding: '0.4rem 0.65rem',
                    borderRadius: '6px',
                    marginBottom: '0.2rem'
                  }}>
                    Sin vacaciones en la fecha seleccionada. Mostrando historial de solicitudes:
                  </div>
                )}
                {itemsFiltrados.map((item) => {
                  if (item.tipoRegistro === 'VACACIONES') {
                    const vac = item.data
                    const esAprobado = vac.estado === 'APROBADO'
                    const esRechazado = vac.estado === 'RECHAZADO'
                    const colorBg = esAprobado ? '#f0fdf4' : esRechazado ? '#fef2f2' : '#fffbeb'
                    const colorBorder = esAprobado ? '#bbf7d0' : esRechazado ? '#fecdd3' : '#fde68a'
                    const colorLeft = esAprobado ? '#16a34a' : esRechazado ? '#ef4444' : '#f59e0b'
                    const badgeBg = esAprobado ? '#dcfce7' : esRechazado ? '#fee2e2' : '#fef3c7'
                    const badgeColor = esAprobado ? '#15803d' : esRechazado ? '#b91c1c' : '#b45309'

                    return (
                      <div
                        key={item.id}
                        style={{
                          background: colorBg,
                          padding: '0.85rem',
                          borderRadius: 'var(--radius)',
                          border: `1px solid ${colorBorder}`,
                          borderLeft: `4px solid ${colorLeft}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.4rem',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '0.66rem',
                            fontWeight: 700,
                            padding: '0.12rem 0.4rem',
                            borderRadius: '4px',
                            background: badgeBg,
                            color: badgeColor
                          }}>
                            VACACIONES {vac.estado || 'REGISTRADAS'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                            {vac.dias_solicitados} {vac.dias_solicitados === 1 ? 'día' : 'días'}
                          </span>
                        </div>

                      <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--foreground)' }}>
                        {vac.empleado_nombre && !vac.empleado_nombre.startsWith('auth0|')
                          ? vac.empleado_nombre
                          : 'Colaborador Registrado'}
                      </div>

                      <div style={{ fontSize: '0.76rem', color: 'var(--muted-foreground)' }}>
                        Periodo: {vac.fecha_inicio} al {vac.fecha_fin}
                      </div>

                      {vac.motivo && (
                        <div style={{ fontSize: '0.76rem', color: 'var(--muted-foreground)', fontStyle: 'italic', background: 'rgba(255,255,255,0.6)', padding: '0.35rem 0.5rem', borderRadius: '4px' }}>
                          "{vac.motivo}"
                        </div>
                      )}
                    </div>
                  )
                }

                const tarea = item.data
                const theme = getColorTheme(tarea.color)

                return (
                  <div
                    key={item.id}
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

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
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
                              <span style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <Clock3 size={11} />
                                {tarea.hora} hrs
                              </span>
                            )}
                            {esAdminRH && tarea.empleado_nombre && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--muted-foreground)', fontWeight: 600 }}>
                                • {getNombreCorto(tarea.empleado_nombre)}
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
              })}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
