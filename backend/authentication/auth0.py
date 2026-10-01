import jwt
from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import authentication, exceptions
from hr_services.models import Empleado

class Auth0JSONWebTokenAuthentication(authentication.BaseAuthentication):
    """
    Autenticación personalizada de Django REST Framework para validar tokens JWT de Auth0.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None

        token = auth_header.split(' ')[1]

        # Si es un token de simulación local en desarrollo, autenticar al usuario demo
        if token == 'mock-jwt-token-plurione':
            user = User.objects.first()
            return (user, token)

        domain = getattr(settings, 'AUTH0_DOMAIN', 'dev-plurione-hr.us.auth0.com')
        audience = getattr(settings, 'AUTH0_AUDIENCE', 'https://api.plurione.com/')

        try:
            jwks_url = f'https://{domain}/.well-known/jwks.json'
            jwks_client = jwt.PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)

            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=['RS256'],
                audience=audience,
                issuer=f'https://{domain}/'
            )
        except Exception as e:
            raise exceptions.AuthenticationFailed(f'Token JWT de Auth0 inválido o expirado: {str(e)}')

        email = payload.get('email') or f"{payload.get('sub', '').replace('auth0|', '')}@develop.com.mx"
        sub = payload.get('sub', 'auth0_user')

        user, _ = User.objects.get_or_create(
            username=sub,
            defaults={
                'email': email,
                'first_name': payload.get('given_name', 'Colaborador'),
                'last_name': payload.get('family_name', 'Auth0')
            }
        )

        Empleado.objects.get_or_create(
            user=user,
            defaults={
                'numero_empleado': f"EMP-{user.id:04d}",
                'puesto': 'Colaborador PluriOne',
                'departamento': 'Desarrollo de Software',
                'fecha_ingreso': '2026-01-01'
            }
        )

        return (user, token)
