from datetime import date, timedelta
from django.test import TestCase
from django.contrib.auth.models import User
from hr_services.models import Empleado, SolicitudVacaciones, TicketRH, ConstanciaLaboral
from .models import MensajeChat
from .agent_graph import procesar_mensaje_agente, parsear_fecha_flexible
from rest_framework.test import APIClient
from rest_framework import status

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

        # Verificar que la solicitud queda PENDIENTE y el descuento se reserva para la aprobacion de RH
        self.assertEqual(sol.estado, 'PENDIENTE')
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.dias_vacaciones_tomados, 2)
        self.assertEqual(self.empleado.dias_vacaciones_disponibles, 10)

    def test_bloquear_vacaciones_retroactivas(self):
        fecha_pasada_ini = (date.today() - timedelta(days=10)).strftime('%Y-%m-%d')
        fecha_pasada_fin = (date.today() - timedelta(days=5)).strftime('%Y-%m-%d')

        mensaje = f"Solicito vacaciones del {fecha_pasada_ini} al {fecha_pasada_fin}"
        resultado = procesar_mensaje_agente(mensaje, self.empleado)

        self.assertTrue(any(w in resultado['respuesta'].lower() for w in ['anterior', 'retroactiv', 'pasad']))
        self.assertEqual(SolicitudVacaciones.objects.filter(empleado=self.empleado).count(), 0)

    def test_crear_ticket_automaticamente(self):
        mensaje = "Tengo un problema urgente: no se reflejo el pago de horas extras en mi recibo"
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

        # El saldo tomado sigue siendo 2 (no se descontó aún)
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.dias_vacaciones_tomados, 2)

        # 2. Aprobar la solicitud desde la vista de Recursos Humanos
        admin_user = User.objects.create_user(username='admin_test_rh', email='admin@develop.com.mx', is_staff=True)
        self.client.force_authenticate(user=admin_user)
        patch_res = self.client.patch(f'/api/hr/admin/vacaciones/{sol.id}/', {'estado': 'APROBADO'})
        self.assertEqual(patch_res.status_code, 200)

        # Ahora sí se descuentan los 5 días: 2 + 5 = 7 (NO 12 por doble descuento)
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.dias_vacaciones_tomados, 7)
        self.assertEqual(self.empleado.dias_vacaciones_disponibles, 5)

