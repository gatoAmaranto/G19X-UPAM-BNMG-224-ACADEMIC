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

    def test_admin_aprobar_vacaciones(self):
        solicitud = SolicitudVacaciones.objects.create(
            empleado=self.empleado,
            fecha_inicio='2026-11-01',
            fecha_fin='2026-11-03',
            dias_solicitados=3,
            estado='PENDIENTE'
        )
        response = self.client.patch(
            f'/api/hr/admin/vacaciones/{solicitud.id}/',
            data={'estado': 'APROBADO'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        solicitud.refresh_from_db()
        self.assertEqual(solicitud.estado, 'APROBADO')
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.dias_vacaciones_tomados, 5)

    def test_admin_crear_vacaciones(self):
        response = self.client.post(
            '/api/hr/admin/vacaciones/',
            data={
                'empleado_id': self.empleado.id,
                'fecha_inicio': '2026-12-01',
                'fecha_fin': '2026-12-05',
                'dias_solicitados': 5,
                'motivo': 'Periodo decembrino institucional',
                'estado': 'APROBADO'
            },
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['estado'], 'APROBADO')
        self.empleado.refresh_from_db()
        self.assertEqual(self.empleado.dias_vacaciones_tomados, 7)

    def test_admin_responder_ticket(self):
        ticket = TicketRH.objects.create(
            empleado=self.empleado,
            asunto='Acceso a VPN',
            descripcion='Solicito credenciales de VPN'
        )
        response = self.client.patch(
            f'/api/hr/admin/tickets/{ticket.id}/',
            data={'respuesta_rh': 'Acceso concedido vía email.', 'estado': 'RESUELTO'},
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        ticket.refresh_from_db()
        self.assertEqual(ticket.estado, 'RESUELTO')
        self.assertEqual(ticket.respuesta_rh, 'Acceso concedido vía email.')

    def test_admin_crear_faq(self):
        response = self.client.post(
            '/api/hr/admin/faq/',
            data={
                'categoria': 'Prestaciones',
                'pregunta': '¿Cuándo se entrega el aguinaldo?',
                'respuesta': 'Se entrega antes del 20 de diciembre de cada año.'
            },
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(BaseConocimientoRH.objects.count(), 1)

    def test_admin_upload_document(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        document_content = b"Reglamento Interno de Trabajo\n\nTodos los colaboradores deben registrar su asistencia a las 9:00 AM.\n\nEl vestuario recomendado es casual de negocios durante la jornada laboral."
        uploaded_file = SimpleUploadedFile("reglamento.txt", document_content, content_type="text/plain")
        
        response = self.client.post(
            '/api/hr/admin/faq/upload/',
            data={'archivo': uploaded_file}
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn('registros_creados', response.json())
        self.assertGreater(response.json()['registros_creados'], 0)

    def test_upload_and_delete_avatar(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        # 1x1 transparent GIF image
        gif_bytes = b'GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;'
        avatar = SimpleUploadedFile("avatar_test.gif", gif_bytes, content_type="image/gif")

        response = self.client.post(
            '/api/hr/perfil/avatar/',
            data={'foto_perfil': avatar}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsNotNone(data.get('foto_perfil_url'))
        self.assertIn('avatar_test', data.get('foto_perfil_url'))

        # Test deleting avatar
        del_response = self.client.delete('/api/hr/perfil/avatar/')
        self.assertEqual(del_response.status_code, 200)
        self.assertIsNone(del_response.json().get('foto_perfil_url'))

    def test_perfil_con_horario_laboral(self):
        response = self.client.get('/api/hr/perfil/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data.get('horario_entrada'), '09:00')
        self.assertEqual(data.get('horario_salida'), '18:00')
        self.assertEqual(data.get('dias_laborales'), 'Lunes a Viernes')
        self.assertEqual(data.get('modalidad_trabajo'), 'Híbrido')

    def test_calendario_crud_y_filtros(self):
        # 1. Crear tarea
        post_res = self.client.post(
            '/api/hr/calendario/',
            data={
                'titulo': 'Revisión de sprint',
                'descripcion': 'Junta semanal de alineación técnica',
                'fecha': '2026-10-15',
                'hora': '10:00',
                'tipo': 'TAREA',
                'color': 'blue'
            },
            content_type='application/json'
        )
        self.assertEqual(post_res.status_code, 201)
        tarea_id = post_res.json()['id']
        self.assertEqual(post_res.json()['titulo'], 'Revisión de sprint')
        self.assertFalse(post_res.json()['completada'])

        # 2. Listar y filtrar por fecha
        list_res = self.client.get('/api/hr/calendario/?fecha=2026-10-15')
        self.assertEqual(list_res.status_code, 200)
        self.assertEqual(len(list_res.json()), 1)

        # 3. Marcar como completada
        patch_res = self.client.patch(
            f'/api/hr/calendario/{tarea_id}/',
            data={'completada': True},
            content_type='application/json'
        )
        self.assertEqual(patch_res.status_code, 200)
        self.assertTrue(patch_res.json()['completada'])

        # 4. Eliminar tarea
        del_res = self.client.delete(f'/api/hr/calendario/{tarea_id}/')
        self.assertEqual(del_res.status_code, 204)
        get_res = self.client.get('/api/hr/calendario/')
        self.assertEqual(len(get_res.json()), 0)


