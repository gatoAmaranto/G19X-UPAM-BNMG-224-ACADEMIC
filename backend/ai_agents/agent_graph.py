import os
import re
import json
from datetime import datetime, date, timedelta
from django.conf import settings
from hr_services.models import BaseConocimientoRH, SolicitudVacaciones, ConstanciaLaboral, TicketRH
from hr_services.utils_pdf import generar_pdf_constancia_laboral
from hr_services.utils_laborales import es_dia_laboral, calcular_dias_laborales, parsear_fecha_flexible
from hr_services.services import crear_solicitud_vacaciones
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile

MODELOS_GEMINI = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
]


def es_solicitud_constancia_real(texto_lc):
    """
    Determina si el usuario solicita formalmente generar/descargar una constancia laboral,
    y no solo hace una pregunta informativa sobre ella.
    """
    mencion = any(w in texto_lc for w in ['constancia', 'carta laboral', 'constancia de trabajo', 'carta patronal'])
    if not mencion:
        return False

    # Si es una pregunta informativa, no generar automáticamente
    es_pregunta = any(p in texto_lc for p in [
        '?', '¿', 'que es', 'qué es', 'para que', 'para qué', 'como se', 'cómo se',
        'donde se', 'dónde se', 'como tramit', 'cómo tramit', 'cuanto tarda', 'cuánto tarda',
        'tengo una duda', 'una pregunta'
    ])
    if es_pregunta:
        return False

    # Debe contener verbos o intención de emisión/solicitud
    verbos = [
        'generar', 'genera', 'genérame', 'generame', 'emitir', 'emite', 'emíteme', 'emiteme',
        'descargar', 'descarga', 'descárgame', 'descargame', 'tramitar', 'tramita', 'tramítame',
        'tramitame', 'solicito', 'solicitar', 'puedes generar', 'necesito mi constancia',
        'quiero mi constancia', 'mi constancia con sueldo', 'mi constancia sin sueldo',
        'dame mi constancia', 'crear constancia', 'expedir'
    ]
    return any(v in texto_lc for v in verbos)


def es_api_key_gemini_valida(api_key: str) -> bool:
    """
    Verifica si una clave de API de Gemini es sintácticamente válida y no un placeholder de ejemplo.
    """
    if not api_key or not isinstance(api_key, str):
        return False
    k = api_key.strip()
    if not k:
        return False
    placeholders = [
        'tu_api_key', 'tu_clave', 'your_api', 'dummy', 'none', 'null',
        'test', 'fake', 'changeme', 'xxx', 'tu_api_key_de_google_ai_studio',
        'tu_clave_de_gemini'
    ]
    if any(p in k.lower() for p in placeholders):
        return False
    return len(k) >= 20


MESES_ES = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
    'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
}


def extraer_rango_fechas_vacaciones(texto: str, hoy: date):
    """
    Extrae fecha de inicio y fin de un texto en español para solicitudes de vacaciones.
    Soporta formatos comunes:
    - 'del 20 al 25 de noviembre'
    - 'del 20 de noviembre al 25 de noviembre'
    - '2026-11-20 al 2026-11-25'
    - '20/11/2026 al 25/11/2026'
    - '20-11-2026 al 25-11-2026'
    """
    txt = texto.lower()
    # Patrón natural en español: 'del 20 al 25 de noviembre'
    m = re.search(r'(?:del\s+)?(\d{1,2})(?:\s+de\s+([a-záéíóú]+))?\s+(?:al|a|-)\s+(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+de\s+(\d{4}))?', txt)
    if m:
        d1, m1, d2, m2, a = m.groups()
        m2_clean = m2.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')
        m1_clean = m1.replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u') if m1 else m2_clean
        mes2 = MESES_ES.get(m2_clean)
        mes1 = MESES_ES.get(m1_clean) if m1_clean else mes2
        anio = int(a) if a else hoy.year
        if mes1 and mes2:
            try:
                f1 = date(anio, mes1, int(d1))
                f2 = date(anio, mes2, int(d2))
                if f1 < hoy and not a:
                    f1 = date(anio + 1, mes1, int(d1))
                    f2 = date(anio + 1, mes2, int(d2))
                return f1, f2
            except ValueError:
                pass

    # Patrón estándar con fechas completas
    fechas = re.findall(r'(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4}|\d{1,2}\s+de\s+[a-z]+(?:\s+de\s+\d{4})?)', txt)
    if len(fechas) >= 2:
        f1 = parsear_fecha_flexible(fechas[0])
        f2 = parsear_fecha_flexible(fechas[1])
        if f1 and f2:
            return f1, f2
    return None, None


def normalizar_texto_busqueda(texto: str) -> str:
    import unicodedata
    if not texto:
        return ''
    texto = texto.lower()
    return ''.join(c for c in unicodedata.normalize('NFD', texto) if unicodedata.category(c) != 'Mn')


STOPWORDS_ES = {
    'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'a', 'al',
    'en', 'con', 'por', 'para', 'que', 'como', 'cual', 'cuales', 'mi', 'mis', 'tu',
    'tus', 'su', 'sus', 'me', 'se', 'te', 'es', 'son', 'si', 'no', 'o', 'y', 'e',
    'u', 'puedo', 'puede', 'pueden', 'tengo', 'tiene', 'tienen', 'hacer', 'hago',
    'hay', 'cuando', 'cuanto', 'cuanta', 'cuantos', 'cuantas', 'donde', 'quien',
    'sobre', 'este', 'esta', 'estos', 'estas', 'ser', 'estar', 'dime', 'decir',
    'saber', 'favor', 'hola', 'buenas', 'buenos', 'dias', 'tardes', 'noches',
    'quisiera', 'gustaria', 'oye', 'amigo', 'asistente'
}


SINONIMOS_RH = {
    'comer': ['comida', 'alimento', 'alimentos', 'comedor', 'despensa'],
    'comida': ['comer', 'alimento', 'alimentos', 'comedor'],
    'alimentos': ['comida', 'comer', 'alimento'],
    'vestimenta': ['ropa', 'codigo de vestimenta', 'vestir'],
    'ropa': ['vestimenta', 'codigo de vestimenta', 'vestir'],
    'sueldo': ['salario', 'nomina', 'pago'],
    'salario': ['sueldo', 'nomina', 'pago'],
    'aguinaldo': ['gratificacion', 'diciembre', 'aguinaldo'],
    'retardo': ['tolerancia', 'retardos', 'tarde', 'puntualidad'],
    'tolerancia': ['retardo', 'retardos', 'tarde', 'puntualidad'],
    'festivo': ['festivos', 'feriado', 'feriados', 'descanso obligatorio'],
    'festivos': ['festivo', 'feriado', 'feriados', 'descanso obligatorio'],
    'prestaciones': ['beneficios', 'sgmm', 'seguro', 'aguinaldo', 'prima vacacional'],
}


def buscar_en_base_conocimiento(query: str):
    """
    Busca la respuesta oficial más relevante en la tabla BaseConocimientoRH
    para consultas sobre reglamentos, políticas y FAQs de Recursos Humanos.
    """
    q_norm = normalizar_texto_busqueda(query)
    palabras_base = [w for w in re.findall(r'\b[a-z0-9]+\b', q_norm) if len(w) > 2 and w not in STOPWORDS_ES]
    if not palabras_base:
        return None

    palabras = set(palabras_base)
    for p in palabras_base:
        if p in SINONIMOS_RH:
            palabras.update(SINONIMOS_RH[p])

    candidatos = []
    for faq in BaseConocimientoRH.objects.filter(activa=True):
        preg_norm = normalizar_texto_busqueda(faq.pregunta)
        resp_norm = normalizar_texto_busqueda(faq.respuesta)
        cat_norm = normalizar_texto_busqueda(faq.categoria)
        kw_norm = normalizar_texto_busqueda(getattr(faq, 'palabras_clave', '') or '')

        score = 0
        palabras_encontradas = 0
        for w in palabras:
            match_found = False
            if w in preg_norm:
                score += 10
                match_found = True
            if w in kw_norm:
                score += 8
                match_found = True
            if w in cat_norm:
                score += 4
                match_found = True
            if w in resp_norm:
                score += 3
                match_found = True
            if match_found:
                palabras_encontradas += 1

        if score > 0:
            ratio = palabras_encontradas / len(palabras)
            score_final = score * (1 + ratio)
            candidatos.append((score_final, faq))

    candidatos.sort(key=lambda x: x[0], reverse=True)
    if candidatos and candidatos[0][0] >= 5:
        return candidatos[0][1]
    return None


def procesar_mensaje_agente(mensaje_usuario, empleado, historial=None):
    """
    Procesa la consulta del colaborador utilizando el Agente Conversacional con herramientas
    automaticas (solicitar vacaciones, crear tickets, generar constancias) y memoria contextual
    de hasta 10 mensajes anteriores.
    """
    api_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
    mensaje_lc = normalizar_texto_busqueda(mensaje_usuario).strip()
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
        su jornada y que tenga saldo suficiente. La solicitud queda PENDIENTE de aprobacion por RH.
        Parametros:
        - fecha_inicio: Fecha de inicio en formato AAAA-MM-DD (ejemplo: '2026-11-20').
        - fecha_fin: Fecha de fin en formato AAAA-MM-DD (ejemplo: '2026-11-25').
        - motivo: Motivo opcional de la solicitud.
        """
        try:
            solicitud = crear_solicitud_vacaciones(
                empleado=empleado,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                motivo=motivo or "Solicitud creada mediante Agente Conversacional"
            )
            accion_detectada['tipo_accion'] = 'VACACIONES_CREADAS'
            accion_detectada['datos'] = {
                'id': solicitud.id,
                'fecha_inicio': solicitud.fecha_inicio.strftime('%Y-%m-%d'),
                'fecha_fin': solicitud.fecha_fin.strftime('%Y-%m-%d'),
                'dias_solicitados': solicitud.dias_solicitados,
                'saldo_restante': empleado.dias_vacaciones_disponibles,
                'dias_retenidos': empleado.dias_vacaciones_retenidos,
                'estado': solicitud.estado,
                'motivo': solicitud.motivo
            }
            return (f"Exito: Solicitud de vacaciones #{solicitud.id} registrada correctamente para las fechas "
                    f"{solicitud.fecha_inicio.strftime('%Y-%m-%d')} al {solicitud.fecha_fin.strftime('%Y-%m-%d')} "
                    f"({solicitud.dias_solicitados} dias habiles laborales). "
                    f"Los {solicitud.dias_solicitados} dias quedan retenidos temporalmente en espera de aprobacion por Recursos Humanos. "
                    f"Tu saldo disponible para nuevas solicitudes es de {empleado.dias_vacaciones_disponibles} dias.")
        except ValidationError as e:
            msg = e.message if hasattr(e, 'message') else str(e)
            return f"Error: {msg}"
        except Exception as e:
            return f"Error al procesar la solicitud de vacaciones: {str(e)}"

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
                f"Dias disfrutados/aprobados: {empleado.dias_vacaciones_tomados}, "
                f"Dias retenidos en solicitudes pendientes: {empleado.dias_vacaciones_retenidos}, "
                f"Dias disponibles actuales para solicitar: {empleado.dias_vacaciones_disponibles}. "
                f"Horario laboral registrado: {empleado.dias_laborales}.")

    def consultar_tickets_soporte() -> str:
        """
        Consulta el conteo oficial y estado de los tickets de soporte del colaborador actual
        (abiertos, en proceso, resueltos y cerrados), incluyendo folios y respuestas de RH.
        Utiliza esta herramienta cuando el colaborador pregunte cuantos tickets tiene o el estado de sus tickets.
        """
        todos = TicketRH.objects.filter(empleado=empleado).order_by('-fecha_creacion')
        accion_detectada['tipo_accion'] = 'INFO_TICKETS'
        if not todos.exists():
            return "Actualmente no tienes ningun ticket de soporte registrado (0 abiertos, 0 resueltos)."

        abiertos = todos.filter(estado='ABIERTO').count()
        en_proceso = todos.filter(estado='EN_PROCESO').count()
        resueltos = todos.filter(estado='RESUELTO').count()
        cerrados = todos.filter(estado='CERRADO').count()

        detalles = []
        for tk in todos[:10]:
            linea = f"- Folio: {tk.folio} | Asunto: {tk.asunto} | Estado: {tk.estado} | Prioridad: {tk.prioridad}"
            if tk.respuesta_rh:
                linea += f" | Respuesta de RH: \"{tk.respuesta_rh}\""
            detalles.append(linea)

        return (
            f"Conteo total de tickets: {todos.count()} "
            f"(Abiertos: {abiertos}, En proceso: {en_proceso}, Resueltos: {resueltos}, Cerrados: {cerrados}).\n"
            + "\n".join(detalles)
        )

    def es_consulta_sobre_tickets(texto_lc: str) -> bool:
        frases_consulta = [
            'cuantos tickets', 'cuántos tickets', 'tickets tengo', 'tengo abiertos',
            'tickets abiertos', 'tickets resueltos', 'tickets pendientes', 'tickets cerrados',
            'mis tickets', 'mi ticket', 'estado de mi', 'estado de mis', 'estatus de',
            'que paso con', 'qué pasó con', 'consultar ticket', 'ver mis tickets',
            'mostrar tickets', 'cuales tickets', 'cuáles tickets', 'respondieron',
            'respuesta de', 'decirme cuantos', 'dime cuantos', 'tiempo de respuesta',
            'cuanto tiempo tardan', 'cuánto tiempo tardan', 'cuanto tardan',
            'como cierro', 'cómo cierro', 'cancelar ticket', 'no abras ticket',
            'no abras un ticket', 'no quiero abrir'
        ]
        if any(f in texto_lc for f in frases_consulta):
            return True
        if 'ticket' in texto_lc and (
            '?' in texto_lc or '¿' in texto_lc or any(
                q in texto_lc for q in ['cuantos', 'cuántos', 'cuales', 'cuáles', 'como', 'cómo', 'dime', 'decirme', 'saber', 'cual es', 'cuál es']
            )
        ):
            if not any(c in texto_lc for c in ['crear ticket por', 'abrir ticket por', 'levantar ticket por']):
                return True
        return False

    def es_reporte_incidencia_real(texto_lc: str) -> bool:
        if es_consulta_sobre_tickets(texto_lc):
            return False
        patrones_duda_politica = [
            'hay algun problema', 'hay algún problema', 'hay problema',
            'habria problema', 'habría problema', 'es problema',
            'una pregunta', 'tengo una duda', 'puedo ', 'se puede ',
            'esta permitido', 'está permitido', 'que pasa si', 'qué pasa si'
        ]
        if any(p in texto_lc for p in patrones_duda_politica):
            return False
        if '?' in texto_lc or '¿' in texto_lc:
            if not any(c in texto_lc for c in ['crear ticket por', 'levantar ticket por', 'abrir ticket por']):
                return False
        palabras_incidencia = [
            'tengo un problema con', 'tengo un problema urgente', 'reportar ',
            'incidencia con', 'falla en', 'error en mi', 'no me llego',
            'no me llegó', 'no coincide mi', 'no se reflejo', 'no se reflejó'
        ]
        return any(w in texto_lc for w in palabras_incidencia)

    # Preparar memoria contextual de hasta 10 mensajes anteriores
    mensajes_recientes = list(historial)[-10:] if historial else []

    historial_str_list = []
    for m in mensajes_recientes:
        rol = "Colaborador" if m.remitente == 'user' else "Asistente RH"
        historial_str_list.append(f"[{rol}]: {m.texto}")
    historial_context = "\n".join(historial_str_list) if historial_str_list else "Sin mensajes previos en esta sesion."

    # Si el usuario consulta sobre formularios o calendario
    if any(w in mensaje_lc for w in ['abrir formulario', 'ver formulario', 'formulario de vacaciones', 'seleccionar en calendario']):
        return {
            'respuesta': f"Con gusto, {nombre_completo}. Cuentas con {empleado.dias_vacaciones_disponibles} dias disponibles. Puedes pedir tus vacaciones directamente aqui conmigo indicandome las fechas de inicio y fin (por ejemplo: 'Quiero vacaciones del 2026-11-20 al 2026-11-25') o consultar tu calendario en la seccion de Vacaciones.",
            'tipo_accion': 'INFO_GENERAL',
            'datos': {
                'disponibles': empleado.dias_vacaciones_disponibles,
                'totales': empleado.dias_vacaciones_totales
            }
        }

    # Base de conocimientos RAG y tickets previos
    faqs = BaseConocimientoRH.objects.filter(activa=True)
    faqs_str_list = [f"- P: {f.pregunta}\n  R: {f.respuesta} (Categoria: {f.categoria})" for f in faqs]
    faqs_context = "\n".join(faqs_str_list) if faqs_str_list else "No hay FAQs adicionales registradas."

    todos_tickets = TicketRH.objects.filter(empleado=empleado).order_by('-fecha_creacion')
    if todos_tickets.exists():
        cnt_abiertos = todos_tickets.filter(estado='ABIERTO').count()
        cnt_proceso = todos_tickets.filter(estado='EN_PROCESO').count()
        cnt_resueltos = todos_tickets.filter(estado='RESUELTO').count()
        cnt_cerrados = todos_tickets.filter(estado='CERRADO').count()
        resumen_conteo = (
            f"Resumen de conteo: {todos_tickets.count()} tickets en total "
            f"({cnt_abiertos} ABIERTOS, {cnt_proceso} EN_PROCESO, {cnt_resueltos} RESUELTOS, {cnt_cerrados} CERRADOS).\n"
        )
        tickets_context = resumen_conteo + "\n".join([
            f"- Folio: {t.folio} | Asunto: {t.asunto} | Estado: {t.estado} | Prioridad: {t.prioridad}"
            + (f" | RESPUESTA OFICIAL DE RH: \"{t.respuesta_rh}\"" if t.respuesta_rh else " | (En proceso de atencion)")
            for t in todos_tickets[:8]
        ])
    else:
        tickets_context = "No tienes tickets registrados actualmente (0 abiertos, 0 resueltos)."

    # Intentar procesamiento mediante Gemini con llamada de herramientas y contexto
    if es_api_key_gemini_valida(api_key):
        system_prompt = (
            f"Eres el Agente Conversacional Inteligente de Recursos Humanos de PluriOne S.A. de C.V. (Develop Talent & Technology), pero hablas y te comportas como un gran amigo, colega y companero de trabajo cercano y de confianza del colaborador.\n"
            f"Tu personalidad es alegre, calida, empatica, relajada, divertida y servicial, tratandolo siempre de 'tu', con confianza y buena onda, como un amigo de oficina, pero sin descuidar la resolucion precisa y confiable de sus tramites de Recursos Humanos.\n\n"
            f"CHISTES Y ADIVINANZAS:\n"
            f"- Tienes total libertad y autorizacion para contar chistes divertidos, chistosos y adivinanzas ingeniosas siempre que el usuario te lo pida o para amenizar la charla y hacer ameno el dia laboral. Puedes contar chistes sanos de oficina, de tecnologia o de la vida diaria.\n"
            f"- Si te piden un chiste o una adivinanza, contestale con gran animo y entusiasmo como buen amigo.\n\n"
            f"FECHA ACTUAL DEL SISTEMA: {hoy.strftime('%Y-%m-%d')} ({hoy.strftime('%A')})\n\n"
            f"DATOS Y SALDO DEL COLABORADOR ACTUAL:\n"
            f"- Nombre: {nombre_completo}\n"
            f"- Puesto: {empleado.puesto}\n"
            f"- Departamento: {empleado.departamento}\n"
            f"- Numero de Empleado: {empleado.numero_empleado}\n"
            f"- Horario Laboral Oficial: {empleado.dias_laborales}\n"
            f"- Dias Totales de Vacaciones: {empleado.dias_vacaciones_totales}\n"
            f"- Dias Disfrutados / Aprobados: {empleado.dias_vacaciones_tomados}\n"
            f"- Dias Retenidos en Solicitudes Pendientes: {empleado.dias_vacaciones_retenidos}\n"
            f"- Dias Disponibles Actuales para Solicitar: {empleado.dias_vacaciones_disponibles}\n\n"
            f"HISTORIAL RECIENTE DE LA CONVERSACION (Ultimos mensajes):\n"
            f"{historial_context}\n\n"
            f"TICKETS DE ATENCION Y SOPORTE REGISTRADOS:\n"
            f"{tickets_context}\n\n"
            f"BASE DE CONOCIMIENTOS DE POLITICAS Y DUDAS FRECUENTES (RAG):\n"
            f"{faqs_context}\n\n"
            f"REGLAS OBLIGATORIAS DE HERRAMIENTAS:\n"
            f"1. HERRAMIENTA `solicitar_vacaciones`: ES OBLIGATORIO llamarla cuando el usuario indique fechas de inicio y fin para vacaciones (ej: 'quiero vacaciones del 2026-11-20 al 2026-11-25', 'del 10 al 14 de diciembre', o si en mensajes previos preguntaste las fechas y el usuario ahora las proporciona). Las fechas deben ser formato AAAA-MM-DD. Si no especifico fechas de inicio y fin, preguntale con calidez que dias desea tomar, recordandole que deben ser a partir de hoy y en sus dias laborales ({empleado.dias_laborales}). Toma en cuenta que los dias en solicitudes pendientes se retienen temporalmente y el sistema bloqueara solicitudes con fechas ya en espera de aprobacion o que superen los dias disponibles actuales.\n"
            f"2. HERRAMIENTA `crear_ticket_soporte`: Llamala UNICAMENTE cuando el usuario reporte una incidencia real que requiera atencion de RH (ej: 'tengo un problema con el recibo de nomina', 'no se reflejo mi pago', etc.) y proporcione la descripcion del caso. PROHIBIDO llamar a `crear_ticket_soporte` si el usuario solo hace una pregunta sobre politicas o dudas generales (ej: '¿hay algun problema si como en horario laboral?', '¿una pregunta hay problema si...?') o si pregunta por el estado/cantidad de sus tickets.\n"
            f"3. HERRAMIENTA `consultar_tickets_soporte`: Utilizala cuando el colaborador pregunte cuantos tickets tiene abiertos/resueltos, pida ver el estado de sus tickets o pregunte que le respondio RH.\n"
            f"4. HERRAMIENTA `generar_constancia_laboral`: ES OBLIGATORIO llamarla cuando solicite una constancia laboral o carta patronal, detectando si requiere reflejar su salario mensual o no.\n"
            f"5. HERRAMIENTA `consultar_saldo_vacaciones`: Utilizala cuando pregunte por sus dias de vacaciones disponibles o su balance.\n"
            f"6. MEMORIA Y CAMBIO DE TEMA: Recuerda los mensajes anteriores para dar continuidad, pero si en un mensaje anterior el usuario habia mencionado abrir un ticket y en su nuevo mensaje cambia de tema, pide un chiste o hace una pregunta sobre politicas/horarios, responde de forma relajada a su duda o cuentale el chiste sin insistir en el ticket.\n"
            f"7. DOMINIO Y TEMAS FUERA DE CONTEXTO:\n"
            f"   - Tu especialidad son las consultas de Recursos Humanos, tramites laborales en PluriOne (Develop Talent & Technology), vacaciones, horarios, nomina, prestaciones, constancias laborales, politicas internas y tickets de soporte, ademas de pasar un buen rato charlando, contando chistes y adivinanzas con tu amigo.\n"
            f"   - Si el usuario te pide un chiste, una adivinanza o una broma sana, complacelo con gusto y gracia.\n"
            f"   - Si te hace preguntas excesivamente ajenas o tecnicas que no corresponden a la empresa (como resolver tareas complejas de matematicas, recetas o temas politicos externos), comentalo amistosamente como buen amigo: 'Oye amigo, en eso si me agarras en curva, pero con gusto te ayudo con tus vacaciones, la constancia, dudas de la chamba o te cuento otro chiste'.\n"
            f"   - Para preguntas sobre politicas y prestaciones de la empresa, basate en la BASE DE CONOCIMIENTOS (RAG) y los datos del colaborador. Si preguntan por una politica que no aparece en el RAG, no inventes datos ni montos; dile con sinceridad de cuates que no cuentas con ese dato exacto a la mano y recomiendale abrir un ticket para que el equipo de RH lo aclare.\n"
            f"8. TONO: Cercano, amigable, de amigo y companero de confianza, ameno y calido, sin usar emojis.\n"
        )

        try:
            from google import genai
            from google.genai import types

            client = genai.Client(
                api_key=api_key,
                http_options=types.HttpOptions(
                    timeout=15000,
                    retry_options=types.HttpRetryOptions(attempts=1)
                )
            )

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
                consultar_tickets_soporte,
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
                    err_str = str(model_err).lower()
                    print(f"Intento con {modelo} fallo: {model_err}, intentando siguiente modelo...")
                    if any(term in err_str for term in ['api_key_invalid', 'api key not valid', 'invalid_argument', 'permission_denied', 'unauthenticated', '401', '403']):
                        print("Clave de Gemini invalida o no autorizada. Cancelando reintentos.")
                        break
                    if any(term in err_str for term in ['timed out', 'timeout', 'connection', 'nameresolution', 'failed to connect']):
                        print("Error de conectividad de red con Google AI Studio. Cancelando reintentos.")
                        break
                    continue

            if response_text:
                tipo_final = accion_detectada['tipo_accion']
                datos_final = accion_detectada['datos']

                if tipo_final == 'INFO_GENERAL' and es_consulta_sobre_tickets(mensaje_lc):
                    tipo_final = 'INFO_TICKETS'

                return {
                    'respuesta': response_text,
                    'tipo_accion': tipo_final,
                    'datos': datos_final
                }
        except Exception as e:
            print("Error invocando Gemini API:", e)

    # Fallback inteligente con ejecucion de herramientas y memoria contextual (cuando Gemini no esta disponible)
    # 0. Deteccion de chistes y adivinanzas
    if any(w in mensaje_lc for w in ['chiste', 'chistes', 'cuentame un chiste', 'dime un chiste', 'otro chiste', 'echate un chiste']):
        import random
        chistes = [
            f"Ahi te va uno bueno, amigo {nombre_completo}: ¿Que le dice una impresora a otra? ¿Esa hoja es tuya o es impresion mia?",
            f"Escucha este, {nombre_completo}: ¿Por que los pajaros no usan redes sociales? Porque ya tienen Twitter natural.",
            f"Va uno de oficina, amigo: ¿Cual es el colmo de un electricista? Que en su trabajo no le den corriente.",
            f"Ahi te va otro, {nombre_completo}: ¿Que hace una abeja en el gimnasio? ¡Zum-ba!"
        ]
        return {
            'respuesta': random.choice(chistes),
            'tipo_accion': 'INFO_GENERAL',
            'datos': {}
        }

    if any(w in mensaje_lc for w in ['adivinanza', 'adivinanzas', 'adivina', 'ponme una adivinanza']):
        import random
        adivinanzas = [
            f"A ver si adivinas esta, amigo {nombre_completo}: Tengo agujas pero no se coser, tengo numeros pero no se leer, las horas te doy, ¿sabes quien soy? ... ¡El reloj!",
            f"Ahi te va una buena, {nombre_completo}: Oro parece, plata no es, el que no lo adivine, bien despistado es. ¿Que es? ... ¡El platano!",
            f"Pon atencion, amigo: Blanca por dentro, verde por fuera. Si quieres que te lo diga, espera. ¿Que es? ... ¡La pera!"
        ]
        return {
            'respuesta': random.choice(adivinanzas),
            'tipo_accion': 'INFO_GENERAL',
            'datos': {}
        }

    # 1. Deteccion de constancia laboral
    if any(w in mensaje_lc for w in ['constancia', 'carta laboral', 'constancia de trabajo', 'carta patronal']):
        if es_solicitud_constancia_real(mensaje_lc):
            if any(term in mensaje_lc for term in ['sin sueldo', 'sin salario', 'sin percepcion', 'sin percepciones']):
                incluir_sueldo = False
            else:
                incluir_sueldo = 'sueldo' in mensaje_lc or 'salario' in mensaje_lc
            generar_constancia_laboral(incluir_sueldo=incluir_sueldo)
            return {
                'respuesta': f"Hola {nombre_completo}, con gusto he generado tu constancia laboral oficial en formato PDF ({'con sueldo' if incluir_sueldo else 'sin sueldo'}). Puedes verla o descargarla a continuacion.",
                'tipo_accion': accion_detectada['tipo_accion'],
                'datos': accion_detectada['datos']
            }
        else:
            return {
                'respuesta': f"Hola {nombre_completo}, las constancias laborales son documentos oficiales membretados emitidos por Recursos Humanos con firma digital autorizada. Puedes generarla con o sin desglose salarial solicitandomelo (por ejemplo: 'Genera mi constancia laboral con sueldo') o bien desde el modulo de Constancia Laboral.",
                'tipo_accion': 'INFO_GENERAL',
                'datos': {}
            }

    # 2. Deteccion de fechas y solicitud de vacaciones
    f_ini, f_fin = extraer_rango_fechas_vacaciones(mensaje_usuario, hoy)
    es_tema_vacaciones = any(w in mensaje_lc for w in ['vacacion', 'vacaciones', 'descanso', 'dias'])
    ultimo_mensaje_bot = next((m.texto.lower() for m in reversed(mensajes_recientes) if m.remitente == 'bot'), '')
    estaba_esperando_fechas = any(term in ultimo_mensaje_bot for term in ['fecha', 'vacacion', 'indica'])

    if (es_tema_vacaciones or estaba_esperando_fechas) and f_ini and f_fin:
        res_tool = solicitar_vacaciones(f_ini.strftime('%Y-%m-%d'), f_fin.strftime('%Y-%m-%d'), motivo=mensaje_usuario)
        return {
            'respuesta': res_tool,
            'tipo_accion': accion_detectada['tipo_accion'],
            'datos': accion_detectada['datos']
        }

    if es_tema_vacaciones and any(w in mensaje_lc for w in ['pedir', 'solicitar', 'quiero', 'necesito', 'tomar']):
        return {
            'respuesta': f"Hola {nombre_completo}, dispones de {empleado.dias_vacaciones_disponibles} dias disponibles. ¿Para que fechas deseas solicitarlas? Por favor indica la fecha de inicio y fin (ejemplo: 'del 20 al 25 de noviembre'). Recuerda que deben ser a partir de hoy y en tus dias laborales ({empleado.dias_laborales}).",
            'tipo_accion': 'INFO_GENERAL',
            'datos': {'disponibles': empleado.dias_vacaciones_disponibles}
        }

    # 3. Deteccion de consulta de tickets vs creacion de ticket de soporte
    if es_consulta_sobre_tickets(mensaje_lc):
        resumen_tk = consultar_tickets_soporte()
        return {
            'respuesta': f"Hola {nombre_completo}, aqui tienes el estado actual de tus tickets de soporte:\n\n{resumen_tk}",
            'tipo_accion': 'INFO_TICKETS',
            'datos': {}
        }

    if es_reporte_incidencia_real(mensaje_lc) and len(mensaje_usuario) > 20:
        asunto_candidato = mensaje_usuario[:60]
        res_ticket = crear_ticket_soporte(asunto=asunto_candidato, descripcion=mensaje_usuario, prioridad='MEDIA')
        return {
            'respuesta': f"Hola {nombre_completo}, he levantado tu ticket de soporte de manera automatica.\n\n{res_ticket}",
            'tipo_accion': accion_detectada['tipo_accion'],
            'datos': accion_detectada['datos']
        }

    # 4. Consultas sobre datos laborales del colaborador
    # 4.1 Horario de trabajo / jornada / entrada y salida
    if any(w in mensaje_lc for w in ['horario', 'hora de entrada', 'hora de salida', 'a que hora entro', 'a que hora salgo', 'que dias trabajo', 'dias laborales', 'modalidad de trabajo', 'jornada laboral']):
        return {
            'respuesta': (
                f"Hola {nombre_completo}, tu jornada oficial registrada es de "
                f"{empleado.horario_entrada} a {empleado.horario_salida} hrs, "
                f"laborando los dias {empleado.dias_laborales} bajo modalidad {empleado.modalidad_trabajo}. "
                f"Recuerda que cuentas con 10 minutos de tolerancia al ingreso segun el reglamento interno."
            ),
            'tipo_accion': 'INFO_GENERAL',
            'datos': {
                'horario_entrada': empleado.horario_entrada,
                'horario_salida': empleado.horario_salida,
                'dias_laborales': empleado.dias_laborales,
                'modalidad': empleado.modalidad_trabajo
            }
        }

    # 4.2 Puesto / departamento / numero de empleado / credencial
    if any(w in mensaje_lc for w in ['puesto', 'mi cargo', 'departamento', 'area', 'área', 'numero de empleado', 'número de empleado', 'mi clave', 'credencial']):
        return {
            'respuesta': (
                f"Amigo {nombre_completo}, tu puesto registrado es {empleado.puesto} "
                f"en el departamento de {empleado.departamento}, con numero de empleado {empleado.numero_empleado}."
            ),
            'tipo_accion': 'INFO_GENERAL',
            'datos': {
                'puesto': empleado.puesto,
                'departamento': empleado.departamento,
                'numero_empleado': empleado.numero_empleado
            }
        }

    # 4.3 Salario / sueldo
    if any(w in mensaje_lc for w in ['sueldo', 'salario', 'cuanto gano', 'cuánto gano', 'percepcion', 'percepción mensual']):
        sueldo_val = f"${empleado.salario_mensual:,.2f} MXN" if empleado.salario_mensual else "No registrado"
        return {
            'respuesta': (
                f"Hola {nombre_completo}, tu salario mensual bruto registrado en el expediente institucional es de {sueldo_val}."
            ),
            'tipo_accion': 'INFO_GENERAL',
            'datos': {
                'salario_mensual': float(empleado.salario_mensual or 0)
            }
        }

    # 4.4 Antigüedad / fecha de ingreso
    if any(w in mensaje_lc for w in ['antiguedad', 'antigüedad', 'cuanto tiempo llevo', 'cuándo entré', 'cuando entre', 'fecha de ingreso', 'fecha de contratacion']):
        anios = empleado.antiguedad_anios or 1
        return {
            'respuesta': (
                f"Amigo {nombre_completo}, ingresaste a la empresa el {empleado.fecha_ingreso or '2023-03-01'}, "
                f"por lo que cuentas con {anios} {('año' if anios == 1 else 'años')} de antiguedad oficial en PluriOne."
            ),
            'tipo_accion': 'INFO_GENERAL',
            'datos': {
                'fecha_ingreso': str(empleado.fecha_ingreso),
                'antiguedad_anios': anios
            }
        }

    # 4.5 Saldo de vacaciones
    if any(w in mensaje_lc for w in ['saldo', 'cuantos dias', 'dias me quedan', 'mis vacaciones', 'balance de vacaciones']):
        return {
            'respuesta': (
                f"Hola {nombre_completo}, dispones de {empleado.dias_vacaciones_disponibles} dias disponibles para solicitar "
                f"de un total de {empleado.dias_vacaciones_totales} dias asignados "
                f"(has tomado {empleado.dias_vacaciones_tomados} dias y tienes {empleado.dias_vacaciones_retenidos} dias retenidos en solicitudes pendientes). "
                f"Tu horario laboral es {empleado.dias_laborales}."
            ),
            'tipo_accion': 'INFO_GENERAL',
            'datos': {
                'disponibles': empleado.dias_vacaciones_disponibles,
                'totales': empleado.dias_vacaciones_totales,
                'tomados': empleado.dias_vacaciones_tomados,
                'retenidos': empleado.dias_vacaciones_retenidos
            }
        }

    # 5. Busqueda en Base de Conocimientos RAG (politicas, reglamentos y FAQs de RH)
    faq_encontrada = buscar_en_base_conocimiento(mensaje_usuario)
    if faq_encontrada:
        resp_limpia = faq_encontrada.respuesta.strip()
        if len(resp_limpia) > 850:
            resp_limpia = resp_limpia[:850] + "..."
        return {
            'respuesta': (
                f"Con gusto te comparto la informacion oficial, amigo {nombre_completo}:\n\n"
                f"**{faq_encontrada.pregunta}** (Categoria: {faq_encontrada.categoria})\n\n"
                f"{resp_limpia}\n\n"
                f"¿Deseas tramitar alguna solicitud relacionada o te ayudo con algo mas?"
            ),
            'tipo_accion': 'INFO_GENERAL',
            'datos': {
                'faq_id': faq_encontrada.id,
                'categoria': faq_encontrada.categoria
            }
        }

    # 6. Saludos casuales, agradecimientos, despedidas y ayuda
    if any(w in mensaje_lc for w in ['gracias', 'muchas gracias', 'te agradezco', 'mil gracias']):
        return {
            'respuesta': f"¡De nada, {nombre_completo}! Para eso estamos los companeros. Cualquier otra duda de Recursos Humanos, vacaciones, constancias o si quieres otro chiste, aqui me tienes.",
            'tipo_accion': 'INFO_GENERAL',
            'datos': {}
        }

    if any(w in mensaje_lc for w in ['adios', 'adiós', 'hasta luego', 'nos vemos', 'bye', 'chao']):
        return {
            'respuesta': f"¡Hasta luego, amigo {nombre_completo}! Que tengas un excelente dia laboral. ¡Pasala genial!",
            'tipo_accion': 'INFO_GENERAL',
            'datos': {}
        }

    if any(w in mensaje_lc for w in ['quien eres', 'quién eres', 'que puedes hacer', 'qué puedes hacer', 'ayuda', 'como funcionas', 'cómo funcionas']):
        return {
            'respuesta': (
                f"¡Hola! Soy el Agente Conversacional de Recursos Humanos en PluriOne S.A. de C.V. (Develop Talent & Technology), pero hablo contigo como un amigo de oficina.\n\n"
                f"Puedo apoyarte en tiempo real con:\n"
                f"- **Vacaciones:** Consultar tu saldo y registrar solicitudes indicando fechas (ejemplo: 'Quiero vacaciones del 20 al 25 de noviembre').\n"
                f"- **Constancia Laboral:** Generar y descargar tu documento membretado en PDF al instante (con o sin sueldo).\n"
                f"- **Tickets de Soporte:** Reportar incidencias de nomina o prestaciones y consultar el estatus de tus folios.\n"
                f"- **Politicas y Reglamento:** Responder tus dudas sobre horarios, tolerancia, vestimenta, prestaciones y aguinaldo.\n"
                f"- **Entretenimiento:** ¡Contarte un chiste o una adivinanza cuando lo pidas!\n\n"
                f"¿En que te echo la mano hoy?"
            ),
            'tipo_accion': 'INFO_GENERAL',
            'datos': {}
        }

    palabras_mensaje = mensaje_lc.split()
    es_saludo_puro = any(s in mensaje_lc for s in ['hola', 'buen dia', 'buenos dias', 'buenas tardes', 'buenas noches', 'que tal', 'qué tal', 'que onda', 'qué onda', 'como estas', 'cómo estás'])
    if es_saludo_puro and len(palabras_mensaje) <= 4:
        return {
            'respuesta': f"¡Que onda, {nombre_completo}! ¿Como va tu dia? Aqui tu amigo de Recursos Humanos listo para apoyarte. Dime si necesitas checar vacaciones, tramitar tu constancia laboral, consultar tickets o revisar alguna politica de la empresa, ¡o si prefieres un chiste o adivinanza! ¿En que te echo la mano?",
            'tipo_accion': 'INFO_GENERAL',
            'datos': {}
        }

    return {
        'respuesta': f"¡Hola {nombre_completo}! Aqui tu amigo de Recursos Humanos en PluriOne listo para apoyarte. Dime si necesitas checar vacaciones, armar una constancia, consultar tus tickets, ver alguna politica de la empresa, ¡o si prefieres que te cuente un chiste o una adivinanza para despejar la mente! ¿En que te echo la mano hoy?",
        'tipo_accion': 'INFO_GENERAL',
        'datos': {}
    }
