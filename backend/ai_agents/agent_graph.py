import os
import json
from django.conf import settings
from hr_services.models import BaseConocimientoRH, SolicitudVacaciones, ConstanciaLaboral, TicketRH
from hr_services.utils_pdf import generar_pdf_constancia_laboral
from django.core.files.base import ContentFile

def procesar_mensaje_agente(mensaje_usuario, empleado):
    """
    Procesa la consulta del colaborador usando LangChain / Gemini API si la clave esta configurada,
    o el motor conversacional inteligente con fallback RAG si aun no se ha configurado la API Key.
    """
    api_key = getattr(settings, 'GEMINI_API_KEY', '') or os.getenv('GEMINI_API_KEY', '')
    mensaje_lc = mensaje_usuario.lower().strip()

    # Intent Detection & Routing

    # 1. Consulta de Vacaciones
    if any(w in mensaje_lc for w in ['vacacion', 'vacaciones', 'días disponibles', 'dias disponibles', 'saldo de días']):
        totales = empleado.dias_vacaciones_totales
        tomados = empleado.dias_vacaciones_tomados
        disponibles = empleado.dias_vacaciones_disponibles
        
        solicitudes = SolicitudVacaciones.objects.filter(empleado=empleado).order_by('-fecha_creacion')[:2]
        ultimas_str = ""
        if solicitudes.exists():
            ultimas_str = "\n\n**Últimas solicitudes:**\n" + "\n".join(
                [f"• {s.fecha_inicio} al {s.fecha_fin}: {s.get_estado_display()}" for s in solicitudes]
            )

        return {
            'respuesta': f"Hola {empleado.user.first_name or empleado.user.username}, actualmente cuentas con **{disponibles} días disponibles** de vacaciones.\n\n"
                         f"📊 **Desglose de saldo:**\n"
                         f"• Días totales correspondientes: {totales}\n"
                         f"• Días disfrutados: {tomados}\n"
                         f"• Días disponibles: {disponibles}{ultimas_str}\n\n"
                         f"¿Deseas registrar una nueva solicitud de vacaciones?",
            'tipo_accion': 'VACACIONES_INFO',
            'datos': {
                'totales': totales,
                'tomados': tomados,
                'disponibles': disponibles
            }
        }

    # 2. Generar Constancia Laboral
    if any(w in mensaje_lc for w in ['constancia', 'carta laboral', 'constancia de trabajo', 'carta patronal']):
        incluir_sueldo = 'sueldo' in mensaje_lc or 'salario' in mensaje_lc
        constancia = ConstanciaLaboral.objects.create(
            empleado=empleado,
            dirigido_a="A quien corresponda",
            incluir_sueldo=incluir_sueldo
        )
        pdf_buffer = generar_pdf_constancia_laboral(constancia)
        filename = f"Constancia_{empleado.numero_empleado}_{constancia.id}.pdf"
        constancia.archivo_pdf.save(filename, ContentFile(pdf_buffer.getvalue()))
        constancia.save()

        download_url = f"/api/hr/constancia/?download=true"

        return {
            'respuesta': f"¡Listo, {empleado.user.first_name}! He generado tu **Constancia Laboral** oficial en formato PDF.\n\n"
                         f"📄 **Detalles del Documento:**\n"
                         f"• Folio: CONST-{constancia.id:05d}\n"
                         f"• Incluye Sueldo: {'Sí' if incluir_sueldo else 'No'}\n"
                         f"• Fecha de Emisión: {constancia.fecha_emision.strftime('%d/%m/%Y')}\n\n"
                         f"Puedes descargarla directamente usando el botón que aparece a continuación.",
            'tipo_accion': 'CONSTANCIA_GENERADA',
            'datos': {
                'constancia_id': constancia.id,
                'download_url': download_url
            }
        }

    # 3. Creación de Ticket de Soporte
    if any(w in mensaje_lc for w in ['ticket', 'soporte', 'hablar con rh', 'reportar problema', 'queja']):
        ticket = TicketRH.objects.create(
            empleado=empleado,
            asunto=mensaje_usuario[:100],
            descripcion=mensaje_usuario,
            prioridad='MEDIA',
            estado='ABIERTO'
        )

        return {
            'respuesta': f"Entendido. He creado un ticket de atención para que un gestor de Recursos Humanos revise tu caso personalmente.\n\n"
                         f"🎟️ **Folio de Ticket:** `{ticket.folio}`\n"
                         f"• Estado: {ticket.get_estado_display()}\n"
                         f"• Prioridad: {ticket.get_prioridad_display()}\n\n"
                         f"Te notificaremos en cuanto el equipo de RH responda a tu solicitud.",
            'tipo_accion': 'TICKET_CREADO',
            'datos': {
                'folio': ticket.folio,
                'asunto': ticket.asunto
            }
        }

    # 4. Búsqueda RAG en Base de Conocimiento (FAQ)
    faqs = BaseConocimientoRH.objects.filter(activa=True)
    mejor_coincidencia = None

    for faq in faqs:
        pregunta_lc = faq.pregunta.lower()
        # Coincidencia de palabras clave
        palabras_clave = [p for p in pregunta_lc.split() if len(p) > 3]
        if any(kw in mensaje_lc for kw in palabras_clave):
            mejor_coincidencia = faq
            break

    if mejor_coincidencia:
        return {
            'respuesta': f"📌 **{mejor_coincidencia.pregunta}**\n\n{mejor_coincidencia.respuesta}\n\n"
                         f"*Categoría: {mejor_coincidencia.categoria}*",
            'tipo_accion': 'FAQ_RAG',
            'datos': {
                'faq_id': mejor_coincidencia.id,
                'categoria': mejor_coincidencia.categoria
            }
        }

    # Intent con Google AI Studio Gemini API (google-genai SDK) si la clave está presente
    if api_key:
        prompt = (
            f"Eres el Agente Conversacional de Recursos Humanos de PluriOne S.A. de C.V. (Develop Talent & Technology).\n"
            f"Estás atendiendo al colaborador {empleado.user.get_full_name()} ({empleado.puesto}).\n"
            f"Responde de forma amable, profesional y concisa a la siguiente duda:\n\n{mensaje_usuario}"
        )
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
            if response and response.text:
                return {
                    'respuesta': response.text,
                    'tipo_accion': 'LLM_GEMINI',
                    'datos': {}
                }
        except Exception as e:
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=api_key)
                response = llm.invoke(prompt)
                return {
                    'respuesta': response.content,
                    'tipo_accion': 'LLM_GEMINI',
                    'datos': {}
                }
            except Exception:
                pass

    # Mensaje por defecto cuando no se detecta intención ni API Key
    return {
        'respuesta': f"Hola {empleado.user.first_name or empleado.user.username}. Soy el Agente de Autoservicio de Recursos Humanos de Develop Talent & Technology.\n\n"
                     f"Puedo ayudarte con las siguientes tareas:\n"
                     f"1. 📅 **Consultar tu saldo de vacaciones**\n"
                     f"2. 📄 **Generar tu constancia laboral en PDF**\n"
                     f"3. ❓ **Responder dudas sobre políticas y beneficios de RH**\n"
                     f"4. 🎟️ **Crear un ticket de soporte con el equipo de RH**\n\n"
                     f"¿En qué te puedo apoyar hoy?",
        'tipo_accion': 'INFO_GENERAL',
        'datos': {}
    }
