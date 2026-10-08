from django.test import TestCase
from django.contrib.auth.models import User
from hr_services.models import Empleado
from .models import MensajeChat
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
            fecha_ingreso='2024-01-01',
            salario_mensual=30000,
            dias_vacaciones_totales=12,
            dias_vacaciones_tomados=2
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_persistencia_mensaje_chat(self):
        url = '/api/agent/chat/'
        response = self.client.post(url, {'mensaje': 'Hola, ¿cuántos días de vacaciones tengo?'})
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
