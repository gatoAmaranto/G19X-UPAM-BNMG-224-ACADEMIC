import os
import re
import json
from datetime import datetime, date, timedelta
from django.conf import settings
from hr_services.models import BaseConocimientoRH, SolicitudVacaciones, ConstanciaLaboral, TicketRH
from hr_services.utils_pdf import generar_pdf_constancia_laboral
from hr_services.utils_laborales import es_dia_laboral, calcular_dias_laborales
from django.core.files.base import ContentFile

MODELOS_GEMINI = [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
]

MESES_ES = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
    'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
}

def parsear_fecha_flexible(valor):
    """
    Interpreta fechas en formatos YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
    o lenguaje natural en espanol (ej. '20 de noviembre de 2026').
    """
    if not valor:
        return None
    if isinstance(valor, date):
        return valor
    if isinstance(valor, datetime):
        return valor.date()

    txt = str(valor).strip().lower()

    # Formato ISO: YYYY-MM-DD
    m_iso = re.search(r'(\d{4})-(\d{1,2})-(\d{1,2})', txt)
    if m_iso:
        try:
            return date(int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3)))
        except ValueError:
            pass

    # Formato latino: DD/MM/YYYY o DD-MM-YYYY
    m_lat = re.search(r'(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})', txt)
    if m_lat:
        try:
            return date(int(m_lat.group(3)), int(m_lat.group(2)), int(m_lat.group(1)))
        except ValueError:
            pass

    # Texto natural en espanol: '20 de noviembre de 2026' o '20 de noviembre'
    m_nat = re.search(r'(\d{1,2})\s+de\s+([a-z]+)(?:\s+de\s+(\d{4}))?', txt)
    if m_nat:
        dia = int(m_nat.group(1))
        mes_str = m_nat.group(2)
        mes = MESES_ES.get(mes_str)
        anio = int(m_nat.group(3)) if m_nat.group(3) else date.today().year
        if mes:
            try:
                return date(anio, mes, dia)
            except ValueError:
                pass

    return None


def procesar_mensaje_agente(mensaje_usuario, empleado, historial=None):
    """
    Procesa la consulta del colaborador utilizando el Agente Conversacional con herramientas
    automaticas (solicitar vacaciones, crear tickets, generar constancias) y memoria contextual
    de hasta 10 mensajes anteriores.
    """
    api_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
    mensaje_lc = mensaje_usuario.lower().strip()
    nombre_completo = empleado.user.get_full_name() or empleado.user.username
    hoy = date.today()

    # Contexto acumulado y acciones ejecutadas durante el procesamiento
    accion_detectada = {
        'tipo_accion': 'INFO_GENERAL',
        'datos': {}
    }

    # Definir herramientas operativas ejecutables por el agente
    def solicitar_vacaciones(fecha_inicio: str, fecha_fin: str, motivo: str = "") -> str:
        """
        Registra formalmente una solicitud de vacaciones para el colaborador en el sistema.
        Valida que las fechas no sean anteriores a hoy, que correspondan a dias laborales segun
        su jornada y que tenga saldo suficiente. Descuenta automaticamente los dias habiles.
        Parametros:
        - fecha_inicio: Fecha de inicio en formato AAAA-MM-DD (ejemplo: '2026-11-20').
        - fecha_fin: Fecha de fin en formato AAAA-MM-DD (ejemplo: '2026-11-25').
        - motivo: Motivo opcional de la solicitud.
        """
        f_ini = parsear_fecha_flexible(fecha_inicio)
        f_fin = parsear_fecha_flexible(fecha_fin)

        if not f_ini or not f_fin:
            return "Error: No fue posible interpretar las fechas. Por favor especifica fechas validas (ejemplo: '2026-11-20' o '20 de noviembre')."

        if f_ini < hoy:
            return f"Error: La fecha de inicio ({f_ini.strftime('%Y-%m-%d')}) no puede ser anterior a la fecha actual ({hoy.strftime('%Y-%m-%d')}). No se permiten solicitudes retroactivas."

        if f_fin < f_ini:
            return f"Error: La fecha de fin ({f_fin.strftime('%Y-%m-%d')}) no puede ser anterior a la fecha de inicio ({f_ini.strftime('%Y-%m-%d')})."

        # Validar si las fechas de inicio y fin caen en dias laborales
        if not es_dia_laboral(f_ini, empleado.dias_laborales):
            return f"Error: La fecha de inicio ({f_ini.strftime('%Y-%m-%d')}) no es un dia laboral segun tu horario ({empleado.dias_laborales}). Las vacaciones solo pueden comenzar en dias habiles de trabajo."

        if not es_dia_laboral(f_fin, empleado.dias_laborales):
            return f"Error: La fecha de fin ({f_fin.strftime('%Y-%m-%d')}) no es un dia laboral segun tu horario ({empleado.dias_laborales}). Las vacaciones solo pueden concluir en dias habiles de trabajo."

        dias_habiles = calcular_dias_laborales(f_ini, f_fin, empleado.dias_laborales)
        cantidad_dias = len(dias_habiles)

        if cantidad_dias <= 0:
            return "Error: El periodo indicado no contiene dias laborales habiles segun tu jornada laboral."

        if empleado.dias_vacaciones_disponibles < cantidad_dias:
            return (f"Error: Saldo insuficiente. Cuentas con {empleado.dias_vacaciones_disponibles} dias disponibles, "
                    f"pero el periodo del {f_ini} al {f_fin} requiere {cantidad_dias} dias habiles laborales.")

        # Descontar saldo registrando dias tomados
        empleado.dias_vacaciones_tomados += cantidad_dias
        empleado.save()

        solicitud = SolicitudVacaciones.objects.create(
            empleado=empleado,
            fecha_inicio=f_ini,
            fecha_fin=f_fin,
            dias_solicitados=cantidad_dias,
            motivo=motivo or "Solicitud creada mediante Agente Conversacional",
            estado='PENDIENTE'
        )

        accion_detectada['tipo_accion'] = 'VACACIONES_CREADAS'
        accion_detectada['datos'] = {
            'id': solicitud.id,
            'fecha_inicio': f_ini.strftime('%Y-%m-%d'),
            'fecha_fin': f_fin.strftime('%Y-%m-%d'),
            'dias_solicitados': cantidad_dias,
            'saldo_restante': empleado.dias_vacaciones_disponibles,
            'estado': solicitud.estado,
            'motivo': solicitud.motivo
        }

        return (f"Exito: Solicitud de vacaciones #{solicitud.id} registrada correctamente para las fechas "
                f"{f_ini.strftime('%Y-%m-%d')} al {f_fin.strftime('%Y-%m-%d')} ({cantidad_dias} dias habiles laborales). "
                f"Tu saldo restante es de {empleado.dias_vacaciones_disponibles} dias. La solicitud esta pendiente de aprobacion por RH.")

    def crear_ticket_soporte(asunto: str, descripcion: str, prioridad: str = "MEDIA") -> str:
        """
        Crea formalmente un ticket de atencion o soporte ante Recursos Humanos para el colaborador.
        Parametros:
        - asunto: Resumen conciso de la solicitud o incidencia (maximo 200 caracteres).
        - descripcion: Explicacion detallada del problema o reporte.
        - prioridad: Nivel de prioridad ('BAJA', 'MEDIA', 'ALTA'). Por defecto 'MEDIA'.
        """
        prio = prioridad.upper().strip() if prioridad else 'MEDIA'
        if prio not in ['BAJA', 'MEDIA', 'ALTA']:
            prio = 'MEDIA'

        ticket = TicketRH.objects.create(
            empleado=empleado,
            asunto=asunto[:200],
            descripcion=descripcion,
            prioridad=prio,
            estado='ABIERTO'
        )

        accion_detectada['tipo_accion'] = 'TICKET_CREADO'
        accion_detectada['datos'] = {
            'id': ticket.id,
            'folio': ticket.folio,
            'asunto': ticket.asunto,
            'descripcion': ticket.descripcion,
            'prioridad': ticket.prioridad,
            'estado': ticket.estado
        }

        return (f"Exito: Ticket de soporte creado con folio {ticket.folio}. "
                f"Asunto: '{ticket.asunto}'. Prioridad: {ticket.prioridad}. Estado: {ticket.estado}. "
                f"El equipo de Recursos Humanos ha sido notificado.")

    def generar_constancia_laboral(incluir_sueldo: bool = False, dirigido_a: str = "A quien corresponda") -> str:
        """
        Genera formalmente la constancia laboral oficial del colaborador en formato PDF.
        Parametros:
        - incluir_sueldo: Booleano para indicar si debe reflejarse el sueldo mensual.
        - dirigido_a: Destinatario institucional de la constancia (por defecto 'A quien corresponda').
        """
        try:
            constancia = ConstanciaLaboral.objects.create(
                empleado=empleado,
                dirigido_a=dirigido_a or "A quien corresponda",
                incluir_sueldo=incluir_sueldo
            )
            pdf_buffer = generar_pdf_constancia_laboral(constancia)
            filename = f"Constancia_{empleado.numero_empleado}_{constancia.id}.pdf"
            constancia.archivo_pdf.save(filename, ContentFile(pdf_buffer.getvalue()), save=True)

            accion_detectada['tipo_accion'] = 'CONSTANCIA_GENERADA'
            accion_detectada['datos'] = {
                'constancia_id': constancia.id,
                'download_url': '/api/hr/constancia/?download=true',
                'incluir_sueldo': incluir_sueldo,
                'dirigido_a': constancia.dirigido_a
            }
            return f"Exito: Constancia laboral en formato PDF generada (Folio #{constancia.id}, {'con sueldo' if incluir_sueldo else 'sin sueldo'})."
        except Exception as e:
            return f"Error al generar la constancia laboral: {str(e)}"

    def consultar_saldo_vacaciones() -> str:
        """
        Consulta el saldo oficial y actualizado de vacaciones del colaborador.
        """
        return (f"Colaborador {nombre_completo}: Dias totales asignados: {empleado.dias_vacaciones_totales}, "
                f"Dias disfrutados: {empleado.dias_vacaciones_tomados}, "
                f"Dias disponibles actuales: {empleado.dias_vacaciones_disponibles}. "
                f"Horario laboral registrado: {empleado.dias_laborales}.")

    # Preparar memoria contextual de hasta 10 mensajes anteriores
    mensajes_recientes = list(historial)[-10:] if historial else []

    historial_str_list = []
    for m in mensajes_recientes:
        rol = "Colaborador" if m.remitente == 'user' else "Asistente RH"
        historial_str_list.append(f"[{rol}]: {m.texto}")
    historial_context = "\n".join(historial_str_list) if historial_str_list else "Sin mensajes previos en esta sesion."

    # Si el usuario solicita explícitamente abrir formularios manuales
    if any(w in mensaje_lc for w in ['abrir formulario', 'ver formulario', 'formulario de vacaciones', 'seleccionar en calendario']):
        return {
            'respuesta': f"Con gusto, {nombre_completo}. Cuentas con {empleado.dias_vacaciones_disponibles} dias disponibles. He abierto el formulario interactivo para que selecciones tus fechas.",
            'tipo_accion': 'ABRIR_FORMULARIO_VACACIONES',
            'datos': {
                'disponibles': empleado.dias_vacaciones_disponibles,
                'totales': empleado.dias_vacaciones_totales
            }
        }

    # Base de conocimientos RAG y tickets previos
    faqs = BaseConocimientoRH.objects.filter(activa=True)
    faqs_str_list = [f"- P: {f.pregunta}\n  R: {f.respuesta} (Categoria: {f.categoria})" for f in faqs]
    faqs_context = "\n".join(faqs_str_list) if faqs_str_list else "No hay FAQs adicionales registradas."

    tickets_recientes = TicketRH.objects.filter(empleado=empleado).order_by('-fecha_creacion')[:5]
    tickets_context = "\n".join([
        f"- Folio: {t.folio} | Asunto: {t.asunto} | Estado: {t.estado} | Prioridad: {t.prioridad}"
        + (f" | RESPUESTA OFICIAL DE RH: \"{t.respuesta_rh}\"" if t.respuesta_rh else " | (En proceso de atencion)")
        for t in tickets_recientes
    ]) if tickets_recientes.exists() else "No tienes tickets registrados actualmente."

    # Intentar procesamiento mediante Gemini con llamada de herramientas y contexto
    if api_key:
        system_prompt = (
            f"Eres el Agente Conversacional Inteligente de Recursos Humanos de PluriOne S.A. de C.V. (Develop Talent & Technology).\n"
            f"Tu objetivo es atender al colaborador de forma amable, empatica, profesional y resolutiva.\n\n"
            f"FECHA ACTUAL DEL SISTEMA: {hoy.strftime('%Y-%m-%d')} ({hoy.strftime('%A')})\n\n"
            f"DATOS Y SALDO DEL COLABORADOR ACTUAL:\n"
            f"- Nombre: {nombre_completo}\n"
            f"- Puesto: {empleado.puesto}\n"
            f"- Departamento: {empleado.departamento}\n"
            f"- Numero de Empleado: {empleado.numero_empleado}\n"
            f"- Horario Laboral Oficial: {empleado.dias_laborales}\n"
            f"- Dias Totales de Vacaciones: {empleado.dias_vacaciones_totales}\n"
            f"- Dias Disfrutados: {empleado.dias_vacaciones_tomados}\n"
            f"- Dias Disponibles Actuales: {empleado.dias_vacaciones_disponibles}\n\n"
            f"HISTORIAL RECIENTE DE LA CONVERSACION (Ultimos mensajes):\n"
            f"{historial_context}\n\n"
            f"TICKETS DE ATENCION Y SOPORTE REGISTRADOS:\n"
            f"{tickets_context}\n\n"
            f"BASE DE CONOCIMIENTOS DE POLITICAS Y DUDAS FRECUENTES (RAG):\n"
            f"{faqs_context}\n\n"
            f"REGLAS OBLIGATORIAS DE HERRAMIENTAS:\n"
            f"1. HERRAMIENTA `solicitar_vacaciones`: ES OBLIGATORIO llamarla cuando el usuario indique fechas de inicio y fin para vacaciones (ej: 'quiero vacaciones del 2026-11-20 al 2026-11-25', 'del 10 al 14 de diciembre', o si en mensajes previos preguntaste las fechas y el usuario ahora las proporciona). Las fechas deben ser formato AAAA-MM-DD. Si no especifico fechas de inicio y fin, preguntale con calidez que dias desea tomar, recordandole que deben ser a partir de hoy y en sus dias laborales ({empleado.dias_laborales}).\n"
            f"2. HERRAMIENTA `crear_ticket_soporte`: ES OBLIGATORIO llamarla cuando el usuario reporte un problema, queja, duda sobre pagos o solicitud de soporte (ej: 'tengo un problema con el recibo de nomina', 'no funciona mi correo', etc.) y proporcione informacion del caso. Si el reporte es demasiado breve (ej: 'tengo una queja'), preguntale amablemente los detalles para levantar el ticket de inmediato.\n"
            f"3. HERRAMIENTA `generar_constancia_laboral`: ES OBLIGATORIO llamarla cuando solicite una constancia laboral o carta patronal, detectando si requiere reflejar su salario mensual o no.\n"
            f"4. HERRAMIENTA `consultar_saldo_vacaciones`: Utilizala cuando pregunte por sus dias de vacaciones disponibles o su balance.\n"
            f"5. MEMORIA Y CONTEXTO: Recuerda los mensajes anteriores para responder coherentemente y dar continuidad a la conversacion sin perder el hilo.\n"
            f"6. TONO: Formal, profesional, servicial y empatico, representando con orgullo a Develop Talent & Technology.\n"
        )

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)

            # Preparar historial de hasta 10 mensajes en formato types.Content
            gemini_history = []
            for m in mensajes_recientes:
                role = 'user' if m.remitente == 'user' else 'model'
                gemini_history.append(
                    types.Content(
                        role=role,
                        parts=[types.Part.from_text(text=m.texto)]
                    )
                )

            herramientas = [
                solicitar_vacaciones,
                crear_ticket_soporte,
                generar_constancia_laboral,
                consultar_saldo_vacaciones,
            ]

            config = types.GenerateContentConfig(
                system_instruction=system_prompt,
                tools=herramientas,
                temperature=0.2
            )

            response_text = None

            for modelo in MODELOS_GEMINI:
                try:
                    chat = client.chats.create(
                        model=modelo,
                        history=gemini_history,
                        config=config
                    )
                    res = chat.send_message(mensaje_usuario)
                    if res and res.text:
                        response_text = res.text
                        break
                except Exception as model_err:
                    print(f"Intento con {modelo} fallo: {model_err}, intentando siguiente modelo...")
                    continue

            if response_text:
                tipo_final = accion_detectada['tipo_accion']
                datos_final = accion_detectada['datos']

                # Garantizar ejecucion de herramientas si el modelo respondio solo texto
                if tipo_final == 'INFO_GENERAL':
                    if any(w in mensaje_lc for w in ['constancia', 'carta laboral', 'constancia de trabajo', 'carta patronal']):
                        incluir_sueldo = 'sueldo' in mensaje_lc or 'salario' in mensaje_lc
                        generar_constancia_laboral(incluir_sueldo=incluir_sueldo)
                        tipo_final = accion_detectada['tipo_accion']
                        datos_final = accion_detectada['datos']
                    elif any(w in mensaje_lc for w in ['vacacion', 'vacaciones', 'dias', 'descanso', 'pedir', 'solicitar']):
                        fechas_encontradas = re.findall(r'(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{1,2}\s+de\s+[a-z]+(?:\s+de\s+\d{4})?)', mensaje_lc)
                        if len(fechas_encontradas) >= 2:
                            f_ini = parsear_fecha_flexible(fechas_encontradas[0])
                            f_fin = parsear_fecha_flexible(fechas_encontradas[1])
                            if f_ini and f_fin:
                                res_vac = solicitar_vacaciones(f_ini.strftime('%Y-%m-%d'), f_fin.strftime('%Y-%m-%d'), motivo=mensaje_usuario)
                                if accion_detectada['tipo_accion'] == 'VACACIONES_CREADAS':
                                    tipo_final = 'VACACIONES_CREADAS'
                                    datos_final = accion_detectada['datos']
                    elif any(w in mensaje_lc for w in ['ticket', 'soporte', 'reportar', 'incidencia', 'problema', 'falla', 'queja', 'error', 'no me llego', 'no coincide']) and len(mensaje_usuario) > 20:
                        if not any(w in mensaje_lc for w in ['estado de mi ticket', 'que paso con mi ticket', 'consultar ticket']):
                            crear_ticket_soporte(asunto=mensaje_usuario[:60], descripcion=mensaje_usuario, prioridad='MEDIA')
                            tipo_final = accion_detectada['tipo_accion']
                            datos_final = accion_detectada['datos']
                    elif any(w in mensaje_lc for w in ['abrir formulario', 'ver formulario', 'formulario de vacaciones']):
                        tipo_final = 'ABRIR_FORMULARIO_VACACIONES'
                        datos_final = {'disponibles': empleado.dias_vacaciones_disponibles}
                    elif any(w in mensaje_lc for w in ['abrir ticket modal', 'formulario de ticket']):
                        tipo_final = 'ABRIR_FORMULARIO_TICKET'

                return {
                    'respuesta': response_text,
                    'tipo_accion': tipo_final,
                    'datos': datos_final
                }
        except Exception as e:
            print("Error invocando Gemini API:", e)

    # Fallback inteligente con ejecucion de herramientas y memoria contextual
    # 1. Deteccion de constancia laboral
    if any(w in mensaje_lc for w in ['constancia', 'carta laboral', 'constancia de trabajo', 'carta patronal']):
        incluir_sueldo = 'sueldo' in mensaje_lc or 'salario' in mensaje_lc
        res_constancia = generar_constancia_laboral(incluir_sueldo=incluir_sueldo)
        return {
            'respuesta': f"Hola {nombre_completo}, con gusto he generado tu constancia laboral oficial en formato PDF ({'con sueldo' if incluir_sueldo else 'sin sueldo'}). Puedes verla o descargarla a continuacion.",
            'tipo_accion': accion_detectada['tipo_accion'],
            'datos': accion_detectada['datos']
        }

    # 2. Deteccion de fechas de vacaciones en el mensaje o con contexto anterior
    fechas_encontradas = re.findall(r'(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{1,2}\s+de\s+[a-z]+(?:\s+de\s+\d{4})?)', mensaje_lc)
    es_tema_vacaciones = any(w in mensaje_lc for w in ['vacacion', 'vacaciones', 'dias', 'descanso', 'pedir', 'solicitar'])
    # Verificar si el mensaje anterior del bot preguntaba por fechas de vacaciones
    ultimo_mensaje_bot = next((m.texto.lower() for m in reversed(mensajes_recientes) if m.remitente == 'bot'), '')
    estaba_esperando_fechas = 'fecha' in ultimo_mensaje_bot and 'vacacion' in ultimo_mensaje_bot

    if (es_tema_vacaciones or estaba_esperando_fechas) and len(fechas_encontradas) >= 2:
        f_ini = parsear_fecha_flexible(fechas_encontradas[0])
        f_fin = parsear_fecha_flexible(fechas_encontradas[1])
        if f_ini and f_fin:
            res_tool = solicitar_vacaciones(f_ini.strftime('%Y-%m-%d'), f_fin.strftime('%Y-%m-%d'), motivo=mensaje_usuario)
            return {
                'respuesta': res_tool,
                'tipo_accion': accion_detectada['tipo_accion'],
                'datos': accion_detectada['datos']
            }

    if es_tema_vacaciones and any(w in mensaje_lc for w in ['pedir', 'solicitar', 'quiero', 'necesito', 'tomar']):
        return {
            'respuesta': f"Hola {nombre_completo}, dispones de {empleado.dias_vacaciones_disponibles} dias disponibles. ¿Para que fechas deseas solicitarlas? Por favor indica la fecha de inicio y fin (ejemplo: 'del 2026-11-20 al 2026-11-25'). Recuerda que deben ser a partir de hoy y en tus dias laborales ({empleado.dias_laborales}).",
            'tipo_accion': 'ABRIR_FORMULARIO_VACACIONES',
            'datos': {'disponibles': empleado.dias_vacaciones_disponibles}
        }

    # 3. Deteccion de tickets o reportes de incidencias
    es_tema_ticket = any(w in mensaje_lc for w in ['ticket', 'soporte', 'reportar', 'incidencia', 'problema', 'falla', 'queja', 'error', 'no me llego', 'no coincide'])
    if es_tema_ticket:
        # Si el usuario describe un problema especifico con suficiente longitud
        if len(mensaje_usuario) > 20 and not any(w in mensaje_lc for w in ['estado de mi ticket', 'que paso con mi ticket', 'consultar ticket']):
            asunto_candidato = mensaje_usuario[:60]
            res_ticket = crear_ticket_soporte(asunto=asunto_candidato, descripcion=mensaje_usuario, prioridad='MEDIA')
            return {
                'respuesta': f"Hola {nombre_completo}, he levantado tu ticket de soporte de manera automatica.\n\n{res_ticket}",
                'tipo_accion': accion_detectada['tipo_accion'],
                'datos': accion_detectada['datos']
            }
        else:
            # Consultar tickets existentes si pregunta por estado
            tickets_rec = TicketRH.objects.filter(empleado=empleado).order_by('-fecha_creacion')[:3]
            if tickets_rec.exists():
                detalles = []
                for tk in tickets_rec:
                    info = f"- Folio {tk.folio} ({tk.asunto}) — Estado: {tk.estado}"
                    if tk.respuesta_rh:
                        info += f"\n  Respuesta de RH: {tk.respuesta_rh}"
                    detalles.append(info)
                resumen_tickets = "\n\n".join(detalles)
                return {
                    'respuesta': f"Hola {nombre_completo}, aqui tienes el estado de tus tickets recientes:\n\n{resumen_tickets}",
                    'tipo_accion': 'INFO_TICKETS',
                    'datos': {}
                }

    if any(w in mensaje_lc for w in ['saldo', 'cuantos dias', 'dias me quedan', 'mis vacaciones']):
        return {
            'respuesta': f"Hola {nombre_completo}, dispones de {empleado.dias_vacaciones_disponibles} dias disponibles de un total de {empleado.dias_vacaciones_totales} dias asignados. Tu horario laboral es {empleado.dias_laborales}.",
            'tipo_accion': 'INFO_GENERAL',
            'datos': {'disponibles': empleado.dias_vacaciones_disponibles}
        }

    return {
        'respuesta': f"Hola {nombre_completo}, soy tu asistente de RH en PluriOne. Puedo ayudarte a solicitar vacaciones, levantar tickets de soporte o consultar tus solicitudes y constancias. ¿En que puedo apoyarte hoy?",
        'tipo_accion': 'INFO_GENERAL',
        'datos': {}
    }
