from datetime import date
from django.core.exceptions import ValidationError
from .models import SolicitudVacaciones
from .utils_laborales import es_dia_laboral, calcular_dias_laborales, parsear_fecha_flexible

def crear_solicitud_vacaciones(empleado, fecha_inicio, fecha_fin, motivo=""):
    """
    Servicio centralizado de validación y registro de solicitudes de vacaciones.
    Crea una solicitud en estado PENDIENTE con los días laborales hábiles calculados.

    Regla única de saldo:
    El saldo de vacaciones no se descuenta al crear la solicitud en estado PENDIENTE;
    el descuento en 'dias_vacaciones_tomados' se realiza exclusivamente al ser APROBADA
    por Recursos Humanos (AdminVacacionesView.patch).
    """
    f_ini = parsear_fecha_flexible(fecha_inicio)
    f_fin = parsear_fecha_flexible(fecha_fin)

    if not f_ini or not f_fin:
        raise ValidationError("No fue posible interpretar las fechas. Especifica fechas válidas (ejemplo: '2026-11-20').")

    hoy = date.today()
    if f_ini < hoy:
        raise ValidationError("No es posible solicitar vacaciones para fechas anteriores al día de hoy. No se permiten solicitudes retroactivas.")

    if f_fin < f_ini:
        raise ValidationError("La fecha de fin debe ser posterior o igual a la fecha de inicio.")

    jornada = empleado.dias_laborales or 'Lunes a Viernes'

    if not es_dia_laboral(f_ini, jornada):
        raise ValidationError(
            f"La fecha de inicio ({f_ini.strftime('%Y-%m-%d')}) no es un día laboral según tu jornada ({jornada}). Las vacaciones solo pueden iniciar en días laborales."
        )

    if not es_dia_laboral(f_fin, jornada):
        raise ValidationError(
            f"La fecha de fin ({f_fin.strftime('%Y-%m-%d')}) no es un día laboral según tu jornada ({jornada}). Las vacaciones solo pueden finalizar en días laborales."
        )

    dias_habiles = calcular_dias_laborales(f_ini, f_fin, jornada)
    dias_calculados = len(dias_habiles)

    if dias_calculados <= 0:
        raise ValidationError(
            f"El periodo seleccionado no comprende ningún día laboral según tu jornada ({jornada})."
        )

    if dias_calculados > empleado.dias_vacaciones_disponibles:
        raise ValidationError(
            f"No tienes suficientes días disponibles. Tienes {empleado.dias_vacaciones_disponibles} días y el periodo laboral seleccionado requiere {dias_calculados} días."
        )

    solicitud = SolicitudVacaciones.objects.create(
        empleado=empleado,
        fecha_inicio=f_ini,
        fecha_fin=f_fin,
        dias_solicitados=dias_calculados,
        motivo=motivo or "Solicitud de vacaciones",
        estado='PENDIENTE'
    )

    return solicitud
