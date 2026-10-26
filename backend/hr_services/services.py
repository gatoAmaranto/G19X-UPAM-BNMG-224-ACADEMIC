from datetime import date
from django.core.exceptions import ValidationError
from django.db import transaction
from .models import Empleado, SolicitudVacaciones
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

    with transaction.atomic():
        empleado_lock = Empleado.objects.select_for_update().get(pk=empleado.pk)

        # Validar que el periodo no se cruce con solicitudes previas en espera o aprobadas
        solapadas = SolicitudVacaciones.objects.filter(
            empleado=empleado_lock,
            estado__in=['PENDIENTE', 'APROBADO'],
            fecha_inicio__lte=f_fin,
            fecha_fin__gte=f_ini
        )
        if solapadas.exists():
            conflicto = solapadas.first()
            if conflicto.estado == 'PENDIENTE':
                raise ValidationError(
                    f"Ya cuentas con una solicitud de vacaciones en proceso de aprobación que coincide con estas fechas "
                    f"({conflicto.fecha_inicio.strftime('%Y-%m-%d')} al {conflicto.fecha_fin.strftime('%Y-%m-%d')}). "
                    f"No es posible solicitar vacaciones en un periodo que ya está esperando aprobación."
                )
            else:
                raise ValidationError(
                    f"Ya cuentas con un periodo de vacaciones previamente aprobado que coincide con estas fechas "
                    f"({conflicto.fecha_inicio.strftime('%Y-%m-%d')} al {conflicto.fecha_fin.strftime('%Y-%m-%d')})."
                )

        dias_disponibles = empleado_lock.dias_vacaciones_disponibles
        if dias_calculados > dias_disponibles:
            dias_retenidos = empleado_lock.dias_vacaciones_retenidos
            if dias_retenidos > 0:
                raise ValidationError(
                    f"No cuentas con suficientes días disponibles. Tienes {dias_disponibles} días disponibles para solicitar "
                    f"({dias_retenidos} días retenidos temporalmente en solicitudes pendientes de aprobación) "
                    f"y el periodo laboral seleccionado requiere {dias_calculados} días."
                )
            else:
                raise ValidationError(
                    f"No cuentas con suficientes días disponibles. Tienes {dias_disponibles} días disponibles "
                    f"y el periodo laboral seleccionado requiere {dias_calculados} días."
                )

        solicitud = SolicitudVacaciones.objects.create(
            empleado=empleado_lock,
            fecha_inicio=f_ini,
            fecha_fin=f_fin,
            dias_solicitados=dias_calculados,
            motivo=motivo or "Solicitud de vacaciones",
            estado='PENDIENTE'
        )

        return solicitud
