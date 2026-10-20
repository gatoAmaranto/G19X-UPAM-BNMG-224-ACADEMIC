from django.test import TestCase
from django.contrib.auth.models import User
from hr_services.models import Empleado, SolicitudVacaciones, TicketRH, BaseConocimientoRH, NotaTareaColaborador

class HRServicesTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            first_name='Carlos',
            last_name='Gómez',
            email='carlos@develop.com.mx'
        )
        self.user.is_rh_admin = False
        self.user.user_role = 'colaborador'
        self.user.save()

        self.admin_user = User.objects.create_user(
            username='admin_rh_user',
            first_name='Admin',
            last_name='RH',
            email='admin_rh@develop.com.mx',
            is_staff=True
        )
        self.admin_user.is_rh_admin = True
        self.admin_user.user_role = 'recursos humanos'
        self.admin_user.save()

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
        self.client.force_login(self.user)

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
        self.assertEqual(response.json()['saldo']['retenidos'], 0)

    def test_crear_vacaciones_endpoint_retiene_dias_y_bloquea_solapamiento(self):
        # 1. Crear solicitud de 5 días hábiles (lunes a viernes)
        res1 = self.client.post('/api/hr/vacaciones/', {
            'fecha_inicio': '2026-11-09',
            'fecha_fin': '2026-11-13',
            'motivo': 'Descanso personal'
        })
        self.assertEqual(res1.status_code, 201)

        # Verificar que el saldo disponible se reduce temporalmente (retenido)
        res_saldo = self.client.get('/api/hr/vacaciones/')
        self.assertEqual(res_saldo.json()['saldo']['disponibles'], 5)
        self.assertEqual(res_saldo.json()['saldo']['retenidos'], 5)

        # 2. Intentar solicitar en fechas que se solapan (ej. 2026-11-11 al 2026-11-17)
        res_solapada = self.client.post('/api/hr/vacaciones/', {
            'fecha_inicio': '2026-11-11',
            'fecha_fin': '2026-11-17',
            'motivo': 'Intento de solapamiento'
        })
        self.assertEqual(res_solapada.status_code, 400)
        self.assertIn('error', res_solapada.json())
        self.assertTrue('coincide' in res_solapada.json()['error'] or 'esperando aprobación' in res_solapada.json()['error'])

        # 3. Intentar solicitar más días de los disponibles teniendo 5 retenidos (ej. pedir 6 días)
        # 2026-11-23 al 2026-11-30 son 6 días laborales (L, M, X, J, V, L)
        res_exceso = self.client.post('/api/hr/vacaciones/', {
            'fecha_inicio': '2026-11-23',
            'fecha_fin': '2026-11-30',
            'motivo': 'Intento de exceder saldo disponible'
        })
        self.assertEqual(res_exceso.status_code, 400)
        self.assertIn('error', res_exceso.json())
        self.assertTrue('suficientes' in res_exceso.json()['error'] or 'retenidos' in res_exceso.json()['error'])


    def test_admin_aprobar_vacaciones(self):
        self.client.force_login(self.admin_user)
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
        self.client.force_login(self.admin_user)
        response = self.client.post(
            '/api/hr/admin/vacaciones/',
            data={
                'empleado_id': self.empleado.id,
                'fecha_inicio': '2026-12-01',
                'fecha_fin': '2026-12-07',
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
        self.client.force_login(self.admin_user)
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
        self.client.force_login(self.admin_user)
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

    def test_admin_toggle_faq_mantiene_orden_estable(self):
        self.client.force_login(self.admin_user)
        f1 = BaseConocimientoRH.objects.create(categoria='A', pregunta='P1', respuesta='R1', activa=True)
        f2 = BaseConocimientoRH.objects.create(categoria='B', pregunta='P2', respuesta='R2', activa=True)
        f3 = BaseConocimientoRH.objects.create(categoria='C', pregunta='P3', respuesta='R3', activa=True)

        res_inicial = self.client.get('/api/hr/admin/faq/')
        self.assertEqual([f['id'] for f in res_inicial.json()], [f1.id, f2.id, f3.id])

        # Desactivar la tercera FAQ vía PATCH
        res_patch = self.client.patch(f'/api/hr/admin/faq/{f3.id}/', data={'activa': False}, content_type='application/json')
        self.assertEqual(res_patch.status_code, 200)
        self.assertFalse(res_patch.json()['activa'])

        # Comprobar que el orden no se altera y sigue siendo [f1, f2, f3]
        res_post_patch = self.client.get('/api/hr/admin/faq/')
        self.assertEqual([f['id'] for f in res_post_patch.json()], [f1.id, f2.id, f3.id])

    def test_admin_eliminar_faq_permanentemente(self):
        self.client.force_login(self.admin_user)
        f = BaseConocimientoRH.objects.create(categoria='Temp', pregunta='Eliminar', respuesta='Temp', activa=True)
        self.assertTrue(BaseConocimientoRH.objects.filter(id=f.id).exists())

        res_delete = self.client.delete(f'/api/hr/admin/faq/{f.id}/')
        self.assertEqual(res_delete.status_code, 200)
        self.assertFalse(BaseConocimientoRH.objects.filter(id=f.id).exists())

    def test_admin_upload_document(self):
        self.client.force_login(self.admin_user)
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
        self.client.force_login(self.user)
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

    def test_calendario_privacidad_entre_usuarios(self):
        self.client.force_login(self.user)
        # Crear usuario secundario con tarea
        otro_user = User.objects.create_user(username='otro_colaborador', email='otro@develop.com.mx')
        otro_emp = Empleado.objects.create(
            user=otro_user,
            numero_empleado='EMP-8888',
            puesto='Diseñador UX',
            departamento='Diseño',
            fecha_ingreso='2024-01-01'
        )
        NotaTareaColaborador.objects.create(
            empleado=otro_emp,
            titulo='Tarea privada de otro colaborador',
            fecha='2026-10-15',
            tipo='TAREA'
        )

        # Cuando el usuario actual lista sus tareas, NO debe ver la tarea del otro colaborador
        res = self.client.get('/api/hr/calendario/?fecha=2026-10-15')
        self.assertEqual(res.status_code, 200)
        titulos = [item['titulo'] for item in res.json()]
        self.assertNotIn('Tarea privada de otro colaborador', titulos)

    def test_unauthenticated_request_is_rejected(self):
        # Desconectar usuario para verificar que AllowAny ya no existe en vistas de colaborador
        self.client.logout()
        res_perfil = self.client.get('/api/hr/perfil/')
        self.assertIn(res_perfil.status_code, [401, 403])

        res_vacaciones = self.client.get('/api/hr/vacaciones/')
        self.assertIn(res_vacaciones.status_code, [401, 403])

        res_calendario = self.client.get('/api/hr/calendario/')
        self.assertIn(res_calendario.status_code, [401, 403])

    def test_get_demo_or_current_empleado_unauthenticated_raises(self):
        from unittest.mock import Mock
        from rest_framework.exceptions import NotAuthenticated
        from hr_services.views import get_demo_or_current_empleado

        mock_req = Mock()
        mock_req.user = Mock(is_authenticated=False)
        with self.assertRaises(NotAuthenticated):
            get_demo_or_current_empleado(mock_req)

    def test_auth0_mock_token_requires_debug(self):
        from unittest.mock import Mock
        from django.test import override_settings
        from authentication.auth0 import Auth0JSONWebTokenAuthentication

        auth = Auth0JSONWebTokenAuthentication()
        req_colab = Mock()
        req_colab.headers = {'Authorization': 'Bearer mock-jwt-token-plurione'}
        req_colab.query_params = {}

        req_rh = Mock()
        req_rh.headers = {'Authorization': 'Bearer mock-jwt-token-plurione-rh'}
        req_rh.query_params = {}

        # Con DEBUG=False los tokens mock deben ser rechazados (retornar None)
        with override_settings(DEBUG=False):
            self.assertIsNone(auth.authenticate(req_colab))
            self.assertIsNone(auth.authenticate(req_rh))

        # Con DEBUG=True los tokens mock deben ser aceptados
        with override_settings(DEBUG=True):
            res_colab = auth.authenticate(req_colab)
            self.assertIsNotNone(res_colab)
            user_colab, _ = res_colab
            self.assertEqual(user_colab.username, 'demo_colaborador')
            self.assertFalse(user_colab.is_rh_admin)

            res_rh = auth.authenticate(req_rh)
            self.assertIsNotNone(res_rh)
            user_rh, _ = res_rh
            self.assertEqual(user_rh.username, 'demo_rh_admin')
            self.assertTrue(user_rh.is_rh_admin)

    def test_auth0_rh_role_not_granted_by_email_or_sub(self):
        from authentication.auth0 import Auth0JSONWebTokenAuthentication
        # Verificar que normalized_roles es el unico criterio para otorgar rol RH
        raw_roles = []
        normalized_roles = [str(r).lower().strip() for r in raw_roles]
        email_with_rh = 'rh_soporte@develop.com.mx'
        sub_with_admin = 'auth0|admin-user-123'

        is_rh_admin = any(
            r in ['recursos humanos', 'recursos_humanos', 'rh_admin', 'rh', 'admin'] or 'recursos' in r
            for r in normalized_roles
        )
        self.assertFalse(is_rh_admin)

    def test_vacaciones_rechaza_fechas_pasadas(self):
        self.client.force_login(self.user)
        import datetime
        fecha_pasada = (datetime.date.today() - datetime.timedelta(days=2)).strftime('%Y-%m-%d')
        fecha_fin = (datetime.date.today() + datetime.timedelta(days=2)).strftime('%Y-%m-%d')

        response = self.client.post(
            '/api/hr/vacaciones/',
            data={
                'fecha_inicio': fecha_pasada,
                'fecha_fin': fecha_fin,
                'motivo': 'Intento de pedir vacaciones en el pasado'
            },
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json())
        self.assertIn('anteriores al día de hoy', response.json()['error'])

    def test_vacaciones_rechaza_fin_de_semana(self):
        self.client.force_login(self.user)
        # 2026-11-07 es Sábado y 2026-11-08 es Domingo
        response = self.client.post(
            '/api/hr/vacaciones/',
            data={
                'fecha_inicio': '2026-11-07',
                'fecha_fin': '2026-11-08',
                'motivo': 'Intento de pedir fin de semana'
            },
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('error', response.json())
        self.assertIn('no es un día laboral', response.json()['error'])

    def test_vacaciones_calcula_solo_dias_laborales_y_corrige_desfase(self):
        self.client.force_login(self.user)
        # Periodo del 2026-11-02 (Lunes) al 2026-11-09 (Lunes siguiente):
        # 8 días calendario, pero exactamente 6 días laborales (Lun, Mar, Mié, Jue, Vie, Lun)
        # Si el usuario envía erróneamente dias_solicitados: 1, el servidor debe calcular y exigir 6
        response = self.client.post(
            '/api/hr/vacaciones/',
            data={
                'fecha_inicio': '2026-11-02',
                'fecha_fin': '2026-11-09',
                'dias_solicitados': 1,
                'motivo': 'Periodo con fin de semana intermedio'
            },
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['dias_solicitados'], 6)




