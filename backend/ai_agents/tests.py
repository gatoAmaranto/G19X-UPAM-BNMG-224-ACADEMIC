from datetime import date, timedelta
from unittest.mock import patch
from django.test import TestCase, override_settings
from django.contrib.auth.models import User
from hr_services.models import Empleado, SolicitudVacaciones, TicketRH, ConstanciaLaboral, BaseConocimientoRH
from .models import MensajeChat
from .agent_graph import procesar_mensaje_agente, obtener_faqs_relevantes_top_k
from hr_services.utils_laborales import parsear_fecha_flexible
from rest_framework.test import APIClient
from rest_framework import status

@override_settings(GEMINI_API_KEY='')
@patch.dict('os.environ', {'GEMINI_API_KEY': ''})
class ChatPersistenciaTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='test_colaborador',
            email='test@develop.com.mx'
        )
        self.empleado = Empleado.objects.create(
            user=self.user,
            numero_empleado='EMP-TEST-01',
            puesto='Desarrollador',
            departamento='TI',
            fecha_ingreso=date(2024, 1, 1),
            salario_mensual=30000,
            dias_vacaciones_totales=12,
            dias_vacaciones_tomados=2,
            dias_laborales='Lunes a Viernes'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_persistencia_mensaje_chat(self):
        url = '/api/agent/chat/'
        response = self.client.post(url, {'mensaje': 'Hola, cuantos dias de vacaciones tengo?'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verificar que se crearon los dos mensajes (usuario y bot)
        mensajes = MensajeChat.objects.filter(empleado=self.empleado)
        self.assertEqual(mensajes.count(), 2)

        msg_user = mensajes.filter(remitente='user').first()
        msg_bot = mensajes.filter(remitente='bot').first()

        self.assertIsNotNone(msg_user)
        self.assertIsNotNone(msg_bot)
        self.assertIn('vacaciones', msg_user.texto)

    def test_obtener_y_limpiar_historial_chat(self):
        # Crear mensajes previos
        MensajeChat.objects.create(
            empleado=self.empleado,
            remitente='user',
            texto='Mensaje 1'
        )
        MensajeChat.objects.create(
            empleado=self.empleado,
            remitente='bot',
            texto='Respuesta 1'
        )

        historial_url = '/api/agent/historial/'
        res_get = self.client.get(historial_url)
        self.assertEqual(res_get.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_get.data), 2)
        self.assertEqual(res_get.data[0]['texto'], 'Mensaje 1')

        # Probar limpieza de historial
        res_del = self.client.delete(historial_url)
        self.assertEqual(res_del.status_code, status.HTTP_200_OK)
        self.assertEqual(MensajeChat.objects.filter(empleado=self.empleado).count(), 0)

    def test_historial_retorna_mensajes_recientes_en_orden_cronologico(self):
        # Crear 70 mensajes ordenados
        for i in range(70):
            MensajeChat.objects.create(
                empleado=self.empleado,
                remitente='user' if i % 2 == 0 else 'bot',
                texto=f"Mensaje correlativo {i:03d}"
            )

        historial_url = '/api/agent/historial/'
        res = self.client.get(historial_url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        # Debe retornar los 70 mensajes completos
        self.assertEqual(len(res.data), 70)
        # El primero debe ser el mas antiguo del lote (000) y el ultimo el mas reciente (069)
        self.assertEqual(res.data[0]['texto'], 'Mensaje correlativo 000')
        self.assertEqual(res.data[-1]['texto'], 'Mensaje correlativo 069')

    def test_solicitar_vacaciones_automaticamente(self):
        # Buscar un proximo lunes a viernes en el futuro
        hoy = date.today()
        dias_hasta_lunes = (7 - hoy.weekday()) % 7
        if dias_hasta_lunes == 0:
            dias_hasta_lunes = 7
        proximo_lunes = hoy + timedelta(days=dias_hasta_lunes)
        proximo_viernes = proximo_lunes + timedelta(days=4)

        f_ini_str = proximo_lunes.strftime('%Y-%m-%d')
        f_fin_str = proximo_viernes.strftime('%Y-%m-%d')

        mensaje = f"Quiero solicitar vacaciones del {f_ini_str} al {f_fin_str}"
        resultado = procesar_mensaje_agente(mensaje, self.empleado)

        self.assertEqual(resultado['tipo_accion'], 'VACACIONES_CREADAS')
        self.assertEqual(resultado['datos']['dias_solicitados'], 5)

        # Verificar en base de datos
        sol = SolicitudVacaciones.objects.filter(empleado=self.empleado, fecha_inicio=proximo_lunes).first()
        self.assertIsNotNone(sol)
        self.assertEqual(sol.dias_solicitados, 5)

        # Verificar que la solicitud queda PENDIENTE y los 5 dias se retienen del saldo disponible
        self.assertEqual(sol.estado, 'PENDIENTE')
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.dias_vacaciones_tomados, 2)
        self.assertEqual(self.empleado.dias_vacaciones_retenidos, 5)
        self.assertEqual(self.empleado.dias_vacaciones_disponibles, 5)

    def test_bloquear_vacaciones_retroactivas(self):
        fecha_pasada_ini = (date.today() - timedelta(days=10)).strftime('%Y-%m-%d')
        fecha_pasada_fin = (date.today() - timedelta(days=5)).strftime('%Y-%m-%d')

        mensaje = f"Solicito vacaciones del {fecha_pasada_ini} al {fecha_pasada_fin}"
        resultado = procesar_mensaje_agente(mensaje, self.empleado)

        self.assertTrue(any(w in resultado['respuesta'].lower() for w in ['anterior', 'retroactiv', 'pasad', 'pasaron', 'paso', 'error']))
        self.assertEqual(SolicitudVacaciones.objects.filter(empleado=self.empleado).count(), 0)

    def test_crear_ticket_automaticamente(self):
        from unittest.mock import patch
        from django.conf import settings
        mensaje = "Tengo un problema urgente: no se reflejo el pago de horas extras en mi recibo"
        with patch.dict('os.environ', {'GEMINI_API_KEY': ''}), patch.object(settings, 'GEMINI_API_KEY', ''):
            resultado = procesar_mensaje_agente(mensaje, self.empleado)

        self.assertEqual(resultado['tipo_accion'], 'TICKET_CREADO')
        self.assertIn('folio', resultado['datos'])

        ticket = TicketRH.objects.filter(empleado=self.empleado).first()
        self.assertIsNotNone(ticket)
        self.assertEqual(ticket.estado, 'ABIERTO')
        self.assertIn('horas extras', ticket.descripcion)

    def test_generar_constancia_automatica(self):
        mensaje = "Por favor genera mi constancia laboral con sueldo"
        resultado = procesar_mensaje_agente(mensaje, self.empleado)

        self.assertEqual(resultado['tipo_accion'], 'CONSTANCIA_GENERADA')
        constancia = ConstanciaLaboral.objects.filter(empleado=self.empleado).first()
        self.assertIsNotNone(constancia)
        self.assertTrue(constancia.incluir_sueldo)

    def test_memoria_contexto_maximo_diez_mensajes(self):
        # Crear 15 mensajes previos
        for i in range(15):
            MensajeChat.objects.create(
                empleado=self.empleado,
                remitente='user' if i % 2 == 0 else 'bot',
                texto=f"Mensaje previo numero {i}"
            )

        # Enviar nuevo mensaje a traves de la API
        url = '/api/agent/chat/'
        response = self.client.post(url, {'mensaje': 'Hola asistente'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verificar que el mensaje se guardo correctamente
        self.assertEqual(MensajeChat.objects.filter(empleado=self.empleado).count(), 17)

    def test_parsear_fecha_flexible(self):
        self.assertEqual(parsear_fecha_flexible('2026-11-20'), date(2026, 11, 20))
        self.assertEqual(parsear_fecha_flexible('20/11/2026'), date(2026, 11, 20))
        self.assertEqual(parsear_fecha_flexible('20-11-2026'), date(2026, 11, 20))
        self.assertEqual(parsear_fecha_flexible('15 de diciembre de 2026'), date(2026, 12, 15))

    def test_consultar_tickets_no_crea_nuevo_ticket(self):
        TicketRH.objects.create(
            empleado=self.empleado,
            asunto='Cambio de horario',
            descripcion='Solicitud previa resuelta',
            estado='RESUELTO'
        )
        mensaje = "puedes decirme cuantos tickets tengo abiertos?"
        resultado = procesar_mensaje_agente(mensaje, self.empleado)

        # No debe crear un nuevo ticket
        self.assertNotEqual(resultado['tipo_accion'], 'TICKET_CREADO')
        self.assertEqual(TicketRH.objects.filter(empleado=self.empleado).count(), 1)

    def test_pregunta_con_palabra_problema_no_crea_ticket(self):
        m1 = MensajeChat.objects.create(
            empleado=self.empleado,
            remitente='user',
            texto='oye quiero abrir un ticket'
        )
        m2 = MensajeChat.objects.create(
            empleado=self.empleado,
            remitente='bot',
            texto='Por favor comparteme asunto y descripcion para crear el ticket.'
        )
        mensaje = "una pregunta hay problema si como en horario laboral"
        resultado = procesar_mensaje_agente(mensaje, self.empleado, historial=[m1, m2])

        self.assertNotEqual(resultado['tipo_accion'], 'TICKET_CREADO')
        self.assertEqual(TicketRH.objects.filter(empleado=self.empleado).count(), 0)

    def test_pregunta_sobre_constancia_no_genera_documento(self):
        # Una simple pregunta sobre constancias no debe generar un archivo PDF
        mensaje = "¿Qué es una constancia laboral y para qué sirve?"
        resultado = procesar_mensaje_agente(mensaje, self.empleado)

        self.assertNotEqual(resultado['tipo_accion'], 'CONSTANCIA_GENERADA')
        self.assertEqual(ConstanciaLaboral.objects.filter(empleado=self.empleado).count(), 0)

    def test_flujo_completo_no_doble_descuento_vacaciones(self):
        hoy = date.today()
        dias_hasta_lunes = (7 - hoy.weekday()) % 7
        if dias_hasta_lunes == 0:
            dias_hasta_lunes = 7
        proximo_lunes = hoy + timedelta(days=dias_hasta_lunes)
        proximo_viernes = proximo_lunes + timedelta(days=4)

        f_ini_str = proximo_lunes.strftime('%Y-%m-%d')
        f_fin_str = proximo_viernes.strftime('%Y-%m-%d')

        # 1. Crear solicitud por el agente conversacional
        mensaje = f"Quiero solicitar vacaciones del {f_ini_str} al {f_fin_str}"
        res_agente = procesar_mensaje_agente(mensaje, self.empleado)
        self.assertEqual(res_agente['tipo_accion'], 'VACACIONES_CREADAS')

        sol = SolicitudVacaciones.objects.filter(empleado=self.empleado, fecha_inicio=proximo_lunes).first()
        self.assertIsNotNone(sol)
        self.assertEqual(sol.estado, 'PENDIENTE')

        # El saldo tomado sigue siendo 2, pero los 5 días quedan retenidos temporalmente
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.dias_vacaciones_tomados, 2)
        self.assertEqual(self.empleado.dias_vacaciones_retenidos, 5)
        self.assertEqual(self.empleado.dias_vacaciones_disponibles, 5)

        # 2. Aprobar la solicitud desde la vista de Recursos Humanos
        admin_user = User.objects.create_user(username='admin_test_rh', email='admin@develop.com.mx', is_staff=True)
        self.client.force_authenticate(user=admin_user)
        patch_res = self.client.patch(f'/api/hr/admin/vacaciones/{sol.id}/', {'estado': 'APROBADO'})
        self.assertEqual(patch_res.status_code, 200)

        # Ahora sí se descuentan los 5 días tomados: 2 + 5 = 7, retenidos vuelve a 0 y disponibles se mantiene en 5
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.dias_vacaciones_tomados, 7)
        self.assertEqual(self.empleado.dias_vacaciones_retenidos, 0)
        self.assertEqual(self.empleado.dias_vacaciones_disponibles, 5)

    def test_bloquear_solicitud_vacaciones_solapadas_con_pendiente(self):
        hoy = date.today()
        dias_hasta_lunes = (7 - hoy.weekday()) % 7
        if dias_hasta_lunes == 0:
            dias_hasta_lunes = 7
        proximo_lunes = hoy + timedelta(days=dias_hasta_lunes)
        proximo_viernes = proximo_lunes + timedelta(days=4)

        f_ini_str = proximo_lunes.strftime('%Y-%m-%d')
        f_fin_str = proximo_viernes.strftime('%Y-%m-%d')

        # 1. Crear primera solicitud PENDIENTE
        res1 = procesar_mensaje_agente(f"Quiero vacaciones del {f_ini_str} al {f_fin_str}", self.empleado)
        self.assertEqual(res1['tipo_accion'], 'VACACIONES_CREADAS')

        # 2. Intentar solicitar en las mismas fechas o fechas solapadas
        res2 = procesar_mensaje_agente(f"Solicito vacaciones del {f_ini_str} al {f_fin_str}", self.empleado)
        self.assertTrue(any(w in res2['respuesta'].lower() for w in ['pendiente', 'aprobación', 'aprobacion', 'esperando', 'coincide', 'proceso']))

        # Solo debe existir 1 solicitud registrada
        self.assertEqual(SolicitudVacaciones.objects.filter(empleado=self.empleado).count(), 1)

    def test_retencion_de_dias_impide_solicitar_mas_del_saldo_disponible(self):
        # El empleado tiene 12 totales, 2 tomados = 10 disponibles
        hoy = date.today()
        dias_hasta_lunes = (7 - hoy.weekday()) % 7
        if dias_hasta_lunes == 0:
            dias_hasta_lunes = 7
        lunes1 = hoy + timedelta(days=dias_hasta_lunes)
        viernes1 = lunes1 + timedelta(days=4) # 5 días hábiles

        lunes2 = lunes1 + timedelta(days=7)
        viernes2 = lunes2 + timedelta(days=4) # 5 días hábiles

        lunes3 = lunes2 + timedelta(days=7)
        viernes3 = lunes3 + timedelta(days=4) # 5 días hábiles

        # Semana 1: Solicitar 5 días (queda PENDIENTE)
        res1 = procesar_mensaje_agente(f"Vacaciones del {lunes1.strftime('%Y-%m-%d')} al {viernes1.strftime('%Y-%m-%d')}", self.empleado)
        self.assertEqual(res1['tipo_accion'], 'VACACIONES_CREADAS')

        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.dias_vacaciones_retenidos, 5)
        self.assertEqual(self.empleado.dias_vacaciones_disponibles, 5)

        # Semana 2: Solicitar otros 5 días (queda PENDIENTE)
        res2 = procesar_mensaje_agente(f"Vacaciones del {lunes2.strftime('%Y-%m-%d')} al {viernes2.strftime('%Y-%m-%d')}", self.empleado)
        self.assertEqual(res2['tipo_accion'], 'VACACIONES_CREADAS')

        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.dias_vacaciones_retenidos, 10)
        self.assertEqual(self.empleado.dias_vacaciones_disponibles, 0)

        # Semana 3: Intentar pedir 5 días más -> Debe ser rechazado porque disponibles es 0 (10 retenidos)
        res3 = procesar_mensaje_agente(f"Vacaciones del {lunes3.strftime('%Y-%m-%d')} al {viernes3.strftime('%Y-%m-%d')}", self.empleado)
        self.assertTrue(any(w in res3['respuesta'].lower() for w in ['disponibles', 'retenidos', 'suficientes', 'saldo']))
        self.assertEqual(SolicitudVacaciones.objects.filter(empleado=self.empleado).count(), 2)

    def test_rechazo_de_solicitud_pendiente_libera_dias_retenidos(self):
        hoy = date.today()
        dias_hasta_lunes = (7 - hoy.weekday()) % 7
        if dias_hasta_lunes == 0:
            dias_hasta_lunes = 7
        proximo_lunes = hoy + timedelta(days=dias_hasta_lunes)
        proximo_viernes = proximo_lunes + timedelta(days=4)

        # Solicitar 5 días
        procesar_mensaje_agente(f"Vacaciones del {proximo_lunes.strftime('%Y-%m-%d')} al {proximo_viernes.strftime('%Y-%m-%d')}", self.empleado)
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.dias_vacaciones_retenidos, 5)
        self.assertEqual(self.empleado.dias_vacaciones_disponibles, 5)

        sol = SolicitudVacaciones.objects.filter(empleado=self.empleado).first()

        # RH rechaza la solicitud
        admin_user = User.objects.create_user(username='admin_test_rh_libera', email='admin_libera@develop.com.mx', is_staff=True)
        self.client.force_authenticate(user=admin_user)
        patch_res = self.client.patch(f'/api/hr/admin/vacaciones/{sol.id}/', {'estado': 'RECHAZADO'})
        self.assertEqual(patch_res.status_code, 200)

        # Los 5 días retenidos se liberan y vuelven a estar disponibles
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.dias_vacaciones_retenidos, 0)
        self.assertEqual(self.empleado.dias_vacaciones_disponibles, 10)

    @patch.dict('os.environ', {'GEMINI_API_KEY': ''})
    @override_settings(GEMINI_API_KEY='')
    def test_consulta_saldo_vacaciones_con_acentos(self):
        """
        Verifica que una consulta como '¿Cuántos días me quedan?' con acentos
        sea normalizada correctamente y devuelva el saldo de vacaciones en el respaldo local.
        """
        res = procesar_mensaje_agente("¿Cuántos días de vacaciones me quedan?", self.empleado)
        self.assertIn("dispones de 10 dias disponibles", res['respuesta'].lower())
        self.assertEqual(res['tipo_accion'], 'INFO_GENERAL')
        self.assertEqual(res['datos'].get('disponibles'), 10)

    @patch.dict('os.environ', {'GEMINI_API_KEY': ''})
    @override_settings(GEMINI_API_KEY='')
    def test_generar_constancia_sin_sueldo(self):
        """
        Verifica que al solicitar una constancia especificando 'sin sueldo',
        se respete la exclusión del salario ('sin sueldo' antes de 'sueldo').
        """
        res = procesar_mensaje_agente("Genera mi constancia laboral sin sueldo por favor", self.empleado)
        self.assertEqual(res['tipo_accion'], 'CONSTANCIA_GENERADA')
        self.assertIn("sin sueldo", res['respuesta'].lower())
        constancia = ConstanciaLaboral.objects.filter(empleado=self.empleado).last()
        self.assertIsNotNone(constancia)
        self.assertFalse(constancia.incluir_sueldo)

    def test_solicitud_cortes_me_puedes_generar_constancia(self):
        """
        Verifica que una solicitud formulada con cortesía como
        '¿Me puedes generar una constancia laboral con sueldo?'
        sea interpretada como una orden de generación y no se descarte por tener signos de interrogación.
        """
        res = procesar_mensaje_agente("¿Me puedes generar una constancia laboral con sueldo?", self.empleado)
        self.assertEqual(res['tipo_accion'], 'CONSTANCIA_GENERADA')
        self.assertIn("con sueldo", res['respuesta'].lower())
        constancia = ConstanciaLaboral.objects.filter(empleado=self.empleado).last()
        self.assertIsNotNone(constancia)
        self.assertTrue(constancia.incluir_sueldo)

    def test_recuperacion_faqs_top_k(self):
        """
        Verifica que el mecanismo de recuperación Top-K devuelva los documentos
        más relevantes para la consulta del colaborador sin saturar la ventana de contexto.
        """
        BaseConocimientoRH.objects.create(
            pregunta='¿Cómo solicito un permiso por paternidad por nacimiento de hijos?',
            respuesta='El permiso por paternidad se otorga conforme a la LFT por 5 días laborables.',
            categoria='Permisos'
        )
        BaseConocimientoRH.objects.create(
            pregunta='¿Cuál es la política de vestimenta y código de ropa?',
            respuesta='La política es business casual de lunes a jueves y casual los viernes.',
            categoria='Cultura'
        )
        faqs_recuperadas = obtener_faqs_relevantes_top_k('Quiero saber del permiso de paternidad por nacimiento', top_k=1)
        self.assertEqual(len(faqs_recuperadas), 1)
        self.assertIn('paternidad', faqs_recuperadas[0].pregunta.lower())

    def test_consulta_saldo_vacaciones_variaciones_lenguaje_natural(self):
        """
        Verifica que consultas coloquiales de saldo como 'cuantas vacaciones me quedan',
        'cunatas tengo disponibles' o 'Dime cuantas vacaciones tengo disponibles'
        devuelvan directamente el saldo disponible del colaborador y no una FAQ general.
        """
        consultas = [
            "Me puedes decir cuantas vacaciones me quedan",
            "pero cunatas tengo disponibles",
            "Dime cuantas vacaciones tengo disponibles",
            "Pero ahora mismo cuantos días puedo solicitar"
        ]
        for c in consultas:
            res = procesar_mensaje_agente(c, self.empleado)
            self.assertEqual(res['tipo_accion'], 'INFO_GENERAL')
            self.assertIn("dispones de", res['respuesta'].lower())
            self.assertIn(str(self.empleado.dias_vacaciones_disponibles), res['respuesta'])

    def test_confirmacion_coloquial_eso_queria_saber(self):
        """
        Verifica que expresiones de confirmación o agradecimiento como 'Eso queria saber'
        no disparen búsquedas falsas en FAQs por coincidencia de subcadenas ('eso' en 'proceso').
        """
        res = procesar_mensaje_agente("Eso queria saber", self.empleado)
        self.assertEqual(res['tipo_accion'], 'INFO_GENERAL')
        self.assertIn("con mucho gusto", res['respuesta'].lower())
        self.assertNotIn("tiempo maximo de resolucion", res['respuesta'].lower())

    def test_capacidades_que_puedes_hacer(self):
        """
        Verifica que la consulta sobre capacidades ('que puedes hacer') devuelva
        la descripción de servicios del asistente y no sea interceptada por una FAQ.
        """
        res = procesar_mensaje_agente("que puedes hacer", self.empleado)
        self.assertEqual(res['tipo_accion'], 'INFO_GENERAL')
        self.assertIn("vacaciones", res['respuesta'].lower())
        self.assertIn("constancia laboral", res['respuesta'].lower())
        self.assertIn("tickets de soporte", res['respuesta'].lower())

    def test_accidente_en_vacaciones(self):
        """
        Verifica que una consulta sobre incidentes o emergencias médicas durante vacaciones
        oriente sobre la suspensión legal por incapacidad del IMSS y no devuelva una FAQ no relacionada.
        """
        res = procesar_mensaje_agente("Que pasa si me accidento en vacaciones", self.empleado)
        self.assertEqual(res['tipo_accion'], 'INFO_GENERAL')
        self.assertIn("incapacidad", res['respuesta'].lower())
        self.assertIn("imss", res['respuesta'].lower())


@override_settings(GEMINI_API_KEY='')
@patch.dict('os.environ', {'GEMINI_API_KEY': ''})
class AgenteRegresionConversacionalTests(TestCase):
    """
    Suite de regresión integral para el motor conversacional de respaldo:
    garantiza que saludos, datos laborales, tickets, chistes, vacaciones
    y prevención de falsos positivos en RAG funcionen de forma determinística.
    """
    def setUp(self):
        self.user = User.objects.create_user(username='colab_regresion', password='123', first_name='Ana', last_name='López')
        self.empleado = Empleado.objects.create(
            user=self.user,
            numero_empleado='EMP-900',
            puesto='Ingeniera de Datos',
            departamento='Tecnología',
            dias_vacaciones_totales=14,
            dias_vacaciones_tomados=2,
            fecha_ingreso=date(2024, 1, 15),
            salario_mensual=35000,
            horario_entrada='09:00',
            horario_salida='18:00',
            dias_laborales='Lunes a Viernes',
            modalidad_trabajo='Híbrido',
        )
        BaseConocimientoRH.objects.create(
            pregunta='¿Cuál es el tiempo máximo de resolución de un ticket de RH?',
            respuesta='El proceso de atención inicial toma máximo 24 horas hábiles.',
            categoria='Soporte',
            activa=True,
        )

    def test_saludos_y_despedidas_no_disparan_faq(self):
        for saludo in ['Hola', 'Hola como estas', 'Buenos dias']:
            res = procesar_mensaje_agente(saludo, self.empleado)
            self.assertEqual(res['tipo_accion'], 'INFO_GENERAL')
            self.assertIn('ana', res['respuesta'].lower())
            self.assertNotIn('tiempo máximo', res['respuesta'].lower())

        res_adios = procesar_mensaje_agente('Hasta luego, nos vemos', self.empleado)
        self.assertIn('hasta luego', res_adios['respuesta'].lower())

    def test_chistes_y_adivinanzas(self):
        res_chiste = procesar_mensaje_agente('Cuéntame un chiste por favor', self.empleado)
        self.assertEqual(res_chiste['tipo_accion'], 'INFO_GENERAL')
        self.assertTrue(len(res_chiste['respuesta']) > 20)

        res_adiv = procesar_mensaje_agente('Ponme una adivinanza', self.empleado)
        self.assertEqual(res_adiv['tipo_accion'], 'INFO_GENERAL')
        self.assertTrue(len(res_adiv['respuesta']) > 20)

    def test_consultas_datos_laborales_colaborador(self):
        res_horario = procesar_mensaje_agente('¿Cuál es mi horario de trabajo?', self.empleado)
        self.assertIn('09:00', res_horario['respuesta'])
        self.assertIn('18:00', res_horario['respuesta'])

        res_puesto = procesar_mensaje_agente('¿Cuál es mi puesto y número de empleado?', self.empleado)
        self.assertIn('Ingeniera de Datos', res_puesto['respuesta'])
        self.assertIn('EMP-900', res_puesto['respuesta'])

        res_sueldo = procesar_mensaje_agente('¿Cuánto gano de salario?', self.empleado)
        self.assertIn('35,000.00', res_sueldo['respuesta'])

        res_antig = procesar_mensaje_agente('¿Cuánta antigüedad tengo en la empresa?', self.empleado)
        self.assertIn('antiguedad', res_antig['respuesta'].lower())

    def test_busqueda_faq_evita_falsos_positivos_por_subcadena(self):
        from ai_agents.agent_graph import buscar_en_base_conocimiento
        # 'eso' está dentro de 'proceso', pero no debe coincidir como palabra completa
        self.assertIsNone(buscar_en_base_conocimiento('Eso'))
        self.assertIsNone(buscar_en_base_conocimiento('Eso queria saber'))

    def test_duda_politica_no_crea_ticket_pero_incidencia_real_si(self):
        res_duda = procesar_mensaje_agente('¿Hay algún problema si como en mi escritorio en horario laboral?', self.empleado)
        self.assertNotEqual(res_duda['tipo_accion'], 'TICKET_CREADO')
        self.assertEqual(TicketRH.objects.filter(empleado=self.empleado).count(), 0)

        res_inc = procesar_mensaje_agente('Tengo un problema con mi recibo de nómina de esta quincena, no me llegó el bono', self.empleado)
        self.assertEqual(res_inc['tipo_accion'], 'TICKET_CREADO')
        self.assertEqual(TicketRH.objects.filter(empleado=self.empleado).count(), 1)

        res_consulta_tk = procesar_mensaje_agente('¿Cuántos tickets tengo abiertos?', self.empleado)
        self.assertEqual(res_consulta_tk['tipo_accion'], 'INFO_TICKETS')
        self.assertIn('Abiertos: 1', res_consulta_tk['respuesta'])



