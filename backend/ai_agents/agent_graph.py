import os
import re
import json
from datetime import datetime
from django.conf import settings
from hr_services.models import BaseConocimientoRH, SolicitudVacaciones, ConstanciaLaboral, TicketRH
from hr_services.utils_pdf import generar_pdf_constancia_laboral
from django.core.files.base import ContentFile

MODELOS_GEMINI = [
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
]

def procesar_mensaje_agente(mensaje_usuario, empleado):
    """
    Procesa la consulta del colaborador utilizando razonamiento en tiempo real mediante
    Google AI Studio Gemini API integrando el contexto completo del empleado y RAG.
    """
    api_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
    mensaje_lc = mensaje_usuario.lower().strip()

    # Recopilar contexto RAG de la Base de Conocimientos
    faqs = BaseConocimientoRH.objects.filter(activa=True)
    faqs_str_list = [f"• P: {f.pregunta}\n  R: {f.respuesta} (Categoría: {f.categoria})" for f in faqs]
    faqs_context = "\n".join(faqs_str_list) if faqs_str_list else "No hay FAQs adicionales registradas."

    nombre_completo = empleado.user.get_full_name() or empleado.user.username

    # Si el usuario explícitamente solicita abrir el formulario de vacaciones
    if any(w in mensaje_lc for w in ['abrir formulario', 'solicitar vacaciones', 'pedir vacaciones', 'nueva solicitud de vacaciones']):
        return {
            'respuesta': f"¡Con gusto, {nombre_completo}! Cuentas con **{empleado.dias_vacaciones_disponibles} días disponibles**.\n\n"
                         f"He abierto el formulario interactivo para que selecciones las fechas de tu solicitud.",
            'tipo_accion': 'ABRIR_FORMULARIO_VACACIONES',
            'datos': {
                'disponibles': empleado.dias_vacaciones_disponibles,
                'totales': empleado.dias_vacaciones_totales
            }
        }

    # Si hay API Key disponible, Gemini procesa y razona la intención del usuario
    if api_key:
        tickets_recientes = TicketRH.objects.filter(empleado=empleado).order_by('-fecha_creacion')[:5]
        tickets_context = "\n".join([
            f"- Folio: {t.folio} | Asunto: {t.asunto} | Estado: {t.estado} | Prioridad: {t.prioridad}"
            + (f" | RESPUESTA OFICIAL DE RH: \"{t.respuesta_rh}\"" if t.respuesta_rh else " | (En espera de respuesta de RH)")
            for t in tickets_recientes
        ]) if tickets_recientes.exists() else "No tienes tickets registrados actualmente."

        system_prompt = (
            f"Eres el Agente Conversacional Inteligente de Recursos Humanos de PluriOne S.A. de C.V. (Develop Talent & Technology).\n"
            f"Tu objetivo es atender al colaborador de forma amable, empática, natural y verdaderamente inteligente.\n\n"
            f"DATOS Y SALDO DEL COLABORADOR ACTUAL:\n"
            f"- Nombre: {nombre_completo}\n"
            f"- Puesto: {empleado.puesto}\n"
            f"- Departamento: {empleado.departamento}\n"
            f"- Número de Empleado: {empleado.numero_empleado}\n"
            f"- Días Totales de Vacaciones: {empleado.dias_vacaciones_totales}\n"
            f"- Días Disfrutados: {empleado.dias_vacaciones_tomados}\n"
            f"- Días Disponibles Actuales: {empleado.dias_vacaciones_disponibles}\n\n"
            f"TICKETS DE ATENCIÓN Y SOPORTE DEL COLABORADOR:\n"
            f"{tickets_context}\n\n"
            f"BASE DE CONOCIMIENTOS DE POLÍTICAS Y DUDAS FRECUENTES (RAG):\n"
            f"{faqs_context}\n\n"
            f"INSTRUCCIONES CLAVE DE RAZONAMIENTO:\n"
            f"1. Analiza el mensaje completo del colaborador antes de responder. NO utilices plantillas fijas ni rígidas.\n"
            f"2. Si el colaborador manifiesta intención de SOLICITAR DÍAS DE VACACIONES (ej: 'Quiero pedir 2 días de vacaciones' o 'Solicito vacaciones del 10 al 12 de nov'):\n"
            f"   - Valida si sus días disponibles ({empleado.dias_vacaciones_disponibles}) son suficientes.\n"
            f"   - Si especifica cuántos días quiere, confirma amablemente que cuenta con saldo suficiente e indícale que puede presionar el botón 'Solicitar Vacaciones' o seleccionar las fechas exactas.\n"
            f"3. Si solo desea CONSULTAR su saldo de vacaciones, bríndale la información de sus {empleado.dias_vacaciones_disponibles} días disponibles de forma fluida y amigable.\n"
            f"4. Si solicita una CONSTANCIA LABORAL, confirma amablemente que con gusto la estás generando en formato PDF e infórmale si la requiere con o sin sueldo.\n"
            f"5. Si hace preguntas sobre horarios, prestaciones o políticas, utiliza la información de la Base de Conocimientos RAG para responder con precisión.\n"
            f"6. Si el colaborador pregunta por el estado o respuesta de sus tickets (ej: 'qué pasó con mi ticket', 'qué respondieron a mi ticket', 'estado de mis reportes'):\n"
            f"   - Revisa la sección TICKETS DE ATENCIÓN Y SOPORTE DEL COLABORADOR.\n"
            f"   - Si el ticket tiene 'RESPUESTA OFICIAL DE RH', indícale con claridad y calidez qué fue lo que Recursos Humanos dictaminó y resolvió.\n"
            f"   - Si aún no tiene respuesta, infórmale con empatía que su ticket sigue abierto y en proceso de atención.\n"
            f"7. Mantén un tono formal pero cercano, representando con orgullo a Develop Talent & Technology.\n\n"
            f"MENSAJE DEL COLABORADOR: \"{mensaje_usuario}\""
        )

        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            response_text = None

            for modelo in MODELOS_GEMINI:
                try:
                    res = client.models.generate_content(
                        model=modelo,
                        contents=system_prompt,
                    )
                    if res and res.text:
                        response_text = res.text
                        break
                except Exception as model_err:
                    print(f"Intento con {modelo} falló: {model_err}, intentando siguiente modelo...")
                    continue

            if response_text:
                tipo_accion = 'LLM_GEMINI'
                datos = {}

                # Detectar intención de formulario de vacaciones
                if any(w in mensaje_lc for w in ['pedir vacaciones', 'solicitar vacaciones', 'nueva solicitud']):
                    tipo_accion = 'ABRIR_FORMULARIO_VACACIONES'
                    datos = {'disponibles': empleado.dias_vacaciones_disponibles}

                # Detectar intención de ticket de soporte
                elif any(w in mensaje_lc for w in ['crear ticket', 'abrir ticket', 'levantar ticket', 'nuevo ticket', 'reportar problema']):
                    tipo_accion = 'ABRIR_FORMULARIO_TICKET'
                    datos = {}

                # Detectar generación de constancia
                elif any(w in mensaje_lc for w in ['constancia', 'carta laboral', 'constancia de trabajo', 'carta patronal']):
                    try:
                        incluir_sueldo = 'sueldo' in mensaje_lc or 'salario' in mensaje_lc
                        constancia = ConstanciaLaboral.objects.create(
                            empleado=empleado,
                            dirigido_a="A quien corresponda",
                            incluir_sueldo=incluir_sueldo
                        )
                        pdf_buffer = generar_pdf_constancia_laboral(constancia)
                        filename = f"Constancia_{empleado.numero_empleado}_{constancia.id}.pdf"
                        constancia.archivo_pdf.save(filename, ContentFile(pdf_buffer.getvalue()), save=True)

                        tipo_accion = 'CONSTANCIA_GENERADA'
                        datos = {
                            'constancia_id': constancia.id,
                            'download_url': f"/api/hr/constancia/?download=true"
                        }
                    except Exception as pdf_err:
                        print("Error al guardar constancia PDF:", pdf_err)
                        tipo_accion = 'CONSTANCIA_GENERADA'
                        datos = {'download_url': f"/api/hr/constancia/?download=true"}

                return {
                    'respuesta': response_text,
                    'tipo_accion': tipo_accion,
                    'datos': datos
                }
        except Exception as e:
            print("Error invocando Gemini API:", e)

    # Fallback conversacional fluido
    if any(w in mensaje_lc for w in ['ticket', 'tickets', 'soporte']):
        tickets_rec = TicketRH.objects.filter(empleado=empleado).order_by('-fecha_creacion')[:3]
        if tickets_rec.exists():
            detalles = []
            for tk in tickets_rec:
                info = f"• Folio {tk.folio} ({tk.asunto}) — Estado: {tk.estado}"
                if tk.respuesta_rh:
                    info += f"\n  ↳ Respuesta de RH: {tk.respuesta_rh}"
                detalles.append(info)
            resumen_tickets = "\n\n".join(detalles)
            return {
                'respuesta': f"Hola {nombre_completo}, aquí tienes el estado de tus tickets de atención:\n\n{resumen_tickets}",
                'tipo_accion': 'INFO_TICKETS',
                'datos': {}
            }

    if any(w in mensaje_lc for w in ['vacacion', 'vacaciones']):
        return {
            'respuesta': f"Hola {nombre_completo}, actualmente dispones de **{empleado.dias_vacaciones_disponibles} días disponibles** de vacaciones. ¿Deseas solicitar fechas específicas?",
            'tipo_accion': 'ABRIR_FORMULARIO_VACACIONES',
            'datos': {'disponibles': empleado.dias_vacaciones_disponibles}
        }


    return {
        'respuesta': f"Hola {nombre_completo}, soy tu asistente de RH en PluriOne. ¿En qué puedo apoyarte hoy?",
        'tipo_accion': 'INFO_GENERAL',
        'datos': {}
    }
