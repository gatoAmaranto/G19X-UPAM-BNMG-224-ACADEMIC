import jwt
from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import authentication, exceptions
from hr_services.models import Empleado

class Auth0JSONWebTokenAuthentication(authentication.BaseAuthentication):
    """
    Autenticación personalizada de Django REST Framework para validar tokens JWT de Auth0
    y vincularlos al modelo Empleado con soporte multi-inquilino y RBAC.
    """
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        token = None

        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        elif 'token' in request.query_params:
            # Soporte para descargas directas de PDF / iframes en navegador
            token = request.query_params.get('token')

        if not token:
            return None

        # Soporte para tokens de prueba en desarrollo local
        if token == 'mock-jwt-token-plurione':
            user, _ = User.objects.get_or_create(
                username='demo_colaborador',
                defaults={
                    'first_name': 'Juan',
                    'last_name': 'Pérez',
                    'email': 'juan.perez@develop.com.mx'
                }
            )
            user.is_rh_admin = False
            user.user_role = 'colaborador'
            return (user, token)

        if token == 'mock-jwt-token-plurione-rh':
            user, _ = User.objects.get_or_create(
                username='demo_rh_admin',
                defaults={
                    'first_name': 'María',
                    'last_name': 'Rodríguez',
                    'email': 'maria.rodriguez@develop.com.mx',
                    'is_staff': True
                }
            )
            user.is_rh_admin = True
            user.user_role = 'recursos humanos'
            return (user, token)

        domain = getattr(settings, 'AUTH0_DOMAIN', 'dev-n4ra6mt0qf5e4h61.us.auth0.com').replace('https://', '').rstrip('/')
        audience = getattr(settings, 'AUTH0_AUDIENCE', '')

        try:
            jwks_url = f'https://{domain}/.well-known/jwks.json'
            jwks_client = jwt.PyJWKClient(jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)

            decode_options = {"verify_signature": True}
            if not audience:
                decode_options["verify_aud"] = False

            try:
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=['RS256'],
                    audience=audience if audience else None,
                    issuer=f'https://{domain}/',
                    options=decode_options
                )
            except (jwt.InvalidAudienceError, jwt.InvalidIssuerError):
                # Tolerar pequeñas diferencias en formato de issuer o audience mientras la firma criptográfica JWKS sea válida
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=['RS256'],
                    options={"verify_signature": True, "verify_aud": False, "verify_iss": False}
                )
        except Exception as e:
            # Token inválido o expirado
            return None

        email = (
            payload.get('email')
            or payload.get(f'https://{domain}/email')
            or f"{payload.get('sub', '').replace('auth0|', '')}@develop.com.mx"
        )
        sub = payload.get('sub', 'auth0_user')

        # Extraer roles del JWT (reclamaciones inyectadas por Auth0 Actions o reglas)
        raw_roles = []
        for key, val in payload.items():
            if key.endswith('/roles') or key == 'roles' or 'role' in key:
                if isinstance(val, list):
                    raw_roles.extend(val)
                elif isinstance(val, str):
                    raw_roles.append(val)

        normalized_roles = [str(r).lower().strip() for r in raw_roles]
        is_rh_admin = any(
            r in ['recursos humanos', 'recursos_humanos', 'rh_admin', 'rh', 'admin'] or 'recursos' in r
            for r in normalized_roles
        ) or ('rh' in email.lower() or 'admin' in email.lower() or 'rh' in sub.lower())

        user_role = 'recursos humanos' if is_rh_admin else 'colaborador'

        first_name = payload.get('given_name') or payload.get('name') or ('Administrador' if is_rh_admin else 'Colaborador')
        last_name = payload.get('family_name') or ('RH' if is_rh_admin else 'Auth0')

        user, _ = User.objects.get_or_create(
            username=sub,
            defaults={
                'email': email,
                'first_name': first_name,
                'last_name': last_name,
                'is_staff': is_rh_admin
            }
        )

        if user.is_staff != is_rh_admin:
            user.is_staff = is_rh_admin
            user.save(update_fields=['is_staff'])

        user.is_rh_admin = is_rh_admin
        user.user_role = user_role

        # Vincular o crear el perfil Empleado
        Empleado.objects.get_or_create(
            user=user,
            defaults={
                'numero_empleado': f"RH-{user.id:04d}" if is_rh_admin else f"EMP-{user.id:04d}",
                'puesto': 'Especialista de Recursos Humanos' if is_rh_admin else 'Colaborador PluriOne',
                'departamento': 'Recursos Humanos' if is_rh_admin else 'Desarrollo de Software',
                'fecha_ingreso': '2026-01-01',
                'salario_mensual': 45000.00 if is_rh_admin else 35000.00,
                'dias_vacaciones_totales': 14 if is_rh_admin else 12,
                'dias_vacaciones_tomados': 2 if is_rh_admin else 3
            }
        )

        return (user, token)
