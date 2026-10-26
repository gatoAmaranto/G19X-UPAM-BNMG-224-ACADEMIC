from unittest.mock import patch, MagicMock
from django.test import TestCase, RequestFactory
from django.contrib.auth.models import User
from authentication.auth0 import Auth0JSONWebTokenAuthentication
from hr_services.models import Empleado


class Auth0RoleExtractionTests(TestCase):
    def setUp(self):
        self.auth = Auth0JSONWebTokenAuthentication()
        self.factory = RequestFactory()

    @patch('jwt.PyJWKClient')
    @patch('jwt.decode')
    def test_filtro_roles_ignora_claims_arbitrarios_con_palabra_role(self, mock_jwt_decode, mock_jwk_client):
        """
        Verifica que claims arbitrarios que contengan 'role' como subcadena
        (ej. role_description, payroll_role, my_role_name) NO sean interpretados
        como roles de Auth0, evitando escalamiento indebido a rol de Recursos Humanos.
        """
        mock_jwt_decode.return_value = {
            'sub': 'auth0|test-user-colab-1',
            'email': 'colab@develop.com.mx',
            'role_description': 'recursos humanos',
            'payroll_role': 'admin',
            'assigned_role_name': 'recursos humanos'
        }
        mock_jwk_client.return_value.get_signing_key_from_jwt.return_value = MagicMock(key='dummy-key')

        request = self.factory.get('/api/hr/perfil/', HTTP_AUTHORIZATION='Bearer token-de-prueba')
        user, token = self.auth.authenticate(request)

        self.assertIsNotNone(user)
        self.assertFalse(user.is_rh_admin)
        self.assertFalse(user.is_staff)
        self.assertEqual(user.user_role, 'colaborador')

    @patch('jwt.PyJWKClient')
    @patch('jwt.decode')
    def test_filtro_roles_acepta_namespace_oficial_con_sufijo_roles(self, mock_jwt_decode, mock_jwk_client):
        """
        Verifica que los claims con namespace de Auth0 Action finalizados en '/roles'
        sean correctamente procesados e identifiquen al rol de Recursos Humanos.
        """
        mock_jwt_decode.return_value = {
            'sub': 'auth0|test-user-rh-1',
            'email': 'rh@develop.com.mx',
            'https://dev-n4ra6mt0qf5e4h61.us.auth0.com/roles': ['recursos humanos']
        }
        mock_jwk_client.return_value.get_signing_key_from_jwt.return_value = MagicMock(key='dummy-key')

        request = self.factory.get('/api/hr/perfil/', HTTP_AUTHORIZATION='Bearer token-de-prueba')
        user, token = self.auth.authenticate(request)

        self.assertIsNotNone(user)
        self.assertTrue(user.is_rh_admin)
        self.assertTrue(user.is_staff)
        self.assertEqual(user.user_role, 'recursos humanos')

    @patch('jwt.PyJWKClient')
    @patch('jwt.decode')
    def test_filtro_roles_acepta_claim_exacto_roles(self, mock_jwt_decode, mock_jwk_client):
        """
        Verifica que el claim estándar 'roles' también sea procesado correctamente.
        """
        mock_jwt_decode.return_value = {
            'sub': 'auth0|test-user-rh-2',
            'email': 'rh2@develop.com.mx',
            'roles': ['recursos humanos']
        }
        mock_jwk_client.return_value.get_signing_key_from_jwt.return_value = MagicMock(key='dummy-key')

        request = self.factory.get('/api/hr/perfil/', HTTP_AUTHORIZATION='Bearer token-de-prueba')
        user, token = self.auth.authenticate(request)

        self.assertIsNotNone(user)
        self.assertTrue(user.is_rh_admin)
        self.assertTrue(user.is_staff)
        self.assertEqual(user.user_role, 'recursos humanos')
