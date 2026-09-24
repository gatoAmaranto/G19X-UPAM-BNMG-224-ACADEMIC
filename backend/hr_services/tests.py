from django.test import TestCase
from django.contrib.auth.models import User
from hr_services.models import Empleado, SolicitudVacaciones, TicketRH, BaseConocimientoRH

class HRServicesTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            first_name='Carlos',
            last_name='Gómez',
            email='carlos@develop.com.mx'
        )
        self.empleado = Empleado.objects.create(
            user=self.user,
            numero_empleado='EMP-9999',
            puesto='Ingeniero de Software',
            departamento='Desarrollo',
            fecha_ingreso='2024-01-01',
            salario_mensual=30000.00,
            dias_vacaciones_totales=12,
            dias_vacaciones_tomados=2
        )

    def test_dias_vacaciones_disponibles(self):
        self.assertEqual(self.empleado.dias_vacaciones_disponibles, 10)

    def test_creacion_ticket_folio(self):
        ticket = TicketRH.objects.create(
            empleado=self.empleado,
            asunto='Problema con acceso a correo',
            descripcion='No puedo ingresar a la cuenta corporativa.'
        )
        self.assertTrue(ticket.folio.startswith('TK-'))
        self.assertEqual(ticket.estado, 'ABIERTO')

    def test_perfil_endpoint(self):
        response = self.client.get('/api/hr/perfil/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('numero_empleado', response.json())

    def test_vacaciones_endpoint(self):
        response = self.client.get('/api/hr/vacaciones/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('saldo', response.json())
        self.assertEqual(response.json()['saldo']['disponibles'], 10)

    def test_chat_agente_endpoint(self):
        response = self.client.post(
            '/api/agent/chat/',
            data={'mensaje': '¿Cuántos días de vacaciones tengo?'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('respuesta', response.json())
        self.assertEqual(response.json()['tipo_accion'], 'VACACIONES_INFO')
